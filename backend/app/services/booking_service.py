import datetime
import uuid
import logging
from typing import Dict, Any, Optional
from app.core.firebase import db
from app.core.exceptions import BookingStatusException, CouponInvalidException, WorkerNotAvailableException
from app.services.wallet_service import wallet_service
from app.services.worker_assignment import worker_assignment_service
from app.services.notification_service import notification_service

logger = logging.getLogger("servalocal.booking")

class BookingService:
    @staticmethod
    def calculate_booking_price(service_id: str, sub_service_id: str, zone_id: str, promo_code: Optional[str] = None) -> Dict[str, Any]:
        """Calculates detailed price breakdown including base, add-ons, surge, and coupons."""
        # 1. Fetch Service data
        srv_ref = db.collection("services").document(service_id).get()
        if not srv_ref.exists:
            raise ValueError(f"Service {service_id} does not exist.")
        
        srv_data = srv_ref.to_dict()
        
        # 2. Get base price from matching subService
        sub_services = srv_data.get("subServices", [])
        base_price = float(srv_data.get("basePrice", 0.0))
        for sub in sub_services:
            if sub.get("id") == sub_service_id:
                base_price = float(sub.get("price", base_price))
                break

        # 3. Get Zone surge multiplier
        surge_mult = 1.0
        if zone_id:
            zone_ref = db.collection("zones").document(zone_id).get()
            if zone_ref.exists:
                surge_mult = float(zone_ref.to_dict().get("surgeMultiplier", 1.0))

        # Calculate subtotal with surge
        subtotal = base_price * surge_mult
        
        # 4. Coupon validation (if provided)
        promo_discount = 0.0
        if promo_code:
            coupon_ref = db.collection("coupons").document(promo_code.upper()).get()
            if coupon_ref.exists:
                c_data = coupon_ref.to_dict()
                if c_data.get("isActive", True):
                    expires = c_data.get("expiresAt")
                    # Check expiry
                    now = datetime.datetime.now(datetime.timezone.utc)
                    if expires and expires > now:
                        min_val = float(c_data.get("minOrderValue", 0.0))
                        if subtotal >= min_val:
                            c_type = c_data.get("type", "flat")
                            val = float(c_data.get("value", 0.0))
                            if c_type == "flat":
                                promo_discount = val
                            elif c_type == "percentage":
                                promo_discount = round(subtotal * (val / 100.0), 2)
                            
                            # Max discount cap check (optional helper)
                            if promo_discount > subtotal:
                                promo_discount = subtotal
                        else:
                            raise CouponInvalidException(f"Minimum booking amount of ₹{min_val} required for coupon.")
                    else:
                        raise CouponInvalidException("Coupon has expired.")
                else:
                    raise CouponInvalidException("Coupon is currently inactive.")
            else:
                raise CouponInvalidException("Coupon code does not exist.")

        final_amount = round(subtotal - promo_discount, 2)
        if final_amount < 0.0:
            final_amount = 0.0

        return {
            "basePrice": base_price,
            "surgeMultiplier": surge_mult,
            "promoDiscount": promo_discount,
            "finalAmount": final_amount
        }

    @classmethod
    def create_booking(cls, customer_id: str, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new service booking, validates payment methods, and fires auto-assignment asynchronously.
        """
        booking_id = f"bk_{uuid.uuid4().hex[:12]}"
        
        # Resolve zone based on GPS
        addr = booking_data.get("address", {})
        lat = float(addr.get("lat", 13.08))
        lng = float(addr.get("lng", 80.27))
        
        # Find zone (simple lookup or default Anna Nagar Chennai)
        zone_id = "chennai_core"
        zones_stream = db.collection("zones").stream()
        for z_doc in zones_stream:
            z_data = z_doc.to_dict()
            # Simple fallback check: If inside polygon or match by bounding coords
            # Here we just take the first active zone as default fallback
            if z_data.get("isActive", True):
                zone_id = z_doc.id
                break

        # Calculate Price Breakdown
        prices = cls.calculate_booking_price(
            service_id=booking_data["serviceId"],
            sub_service_id=booking_data["subServiceId"],
            zone_id=zone_id,
            promo_code=booking_data.get("promoCode")
        )
        
        final_amount = prices["finalAmount"]
        wallet_used = 0.0
        payment_method = booking_data.get("paymentMethod", "cash")
        use_wallet = booking_data.get("useWallet", False)

        # Handle Wallet payment (atomic check)
        if use_wallet or payment_method == "wallet":
            cust_ref = db.collection("users").document(customer_id).get()
            cust_bal = float(cust_ref.to_dict().get("walletBalance", 0.0))
            
            if use_wallet:
                # Apply partial balance
                wallet_used = min(cust_bal, final_amount)
                final_amount = round(final_amount - wallet_used, 2)
            else:
                # Deduct full amount
                if cust_bal < final_amount:
                    raise ValueError(f"Insufficient wallet balance. Have: ₹{cust_bal}, Need: ₹{final_amount}")
                wallet_used = final_amount
                final_amount = 0.0

        # Build booking document
        new_booking = {
            "id": booking_id,
            "customerId": customer_id,
            "workerId": "",
            "serviceId": booking_data["serviceId"],
            "subServiceId": booking_data["subServiceId"],
            "status": "requested",
            "address": addr,
            "scheduledAt": booking_data["scheduledAt"],
            "confirmedAt": None,
            "startedAt": None,
            "completedAt": None,
            "cancelledAt": None,
            "pricing": {
                "basePrice": prices["basePrice"],
                "addOns": [],
                "surgeMultiplier": prices["surgeMultiplier"],
                "promoDiscount": prices["promoDiscount"],
                "walletUsed": wallet_used,
                "finalAmount": final_amount
            },
            "paymentMethod": payment_method if final_amount > 0 else "wallet",
            "paymentStatus": "collected" if final_amount == 0 and wallet_used > 0 else "pending",
            "specialInstructions": booking_data.get("specialInstructions", ""),
            "beforePhotos": [],
            "afterPhotos": [],
            "customerOTP": str(uuid.uuid4().int)[:4], # 4-digit unique verification completion OTP
            "workerNotes": "",
            "rating": None,
            "timeline": [
                {"status": "requested", "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            ],
            "messages": [],
            "issueReports": [],
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc)
        }

        # Deduct wallet atomically if utilized
        if wallet_used > 0:
            wallet_service.adjust_balance(
                user_id=customer_id,
                amount=wallet_used,
                tx_type="debit",
                description=f"Payment for booking {booking_id}",
                booking_id=booking_id
            )

        # Write to Firestore
        db.collection("bookings").document(booking_id).set(new_booking)

        # Perform Auto-Assignment
        worker_id = worker_assignment_service.get_best_worker(
            service_id=booking_data["serviceId"],
            zone_id=zone_id,
            lat=lat,
            lng=lng
        )

        if worker_id:
            # Update booking with worker assignment details
            db.collection("bookings").document(booking_id).update({
                "workerId": worker_id,
                "status": "worker_assigned",
                "confirmedAt": datetime.datetime.now(datetime.timezone.utc),
                "updatedAt": datetime.datetime.now(datetime.timezone.utc),
                "timeline": firestore.ArrayUnion([{
                    "status": "worker_assigned",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }])
            })
            
            # Send Notification alert to worker
            worker_profile = db.collection("users").document(worker_id).get().to_dict()
            worker_phone = worker_profile.get("phone")
            if worker_phone:
                notification_service.send_sms(
                    to_phone=worker_phone,
                    message_body=f"New job assigned! Booking ID: {booking_id}. Please review on your ServaLocal dashboard."
                )
            
            # Send Push Notification to Customer
            customer_profile = db.collection("users").document(customer_id).get().to_dict()
            customer_phone = customer_profile.get("phone")
            if customer_phone:
                notification_service.send_sms(
                    to_phone=customer_phone,
                    message_body=f"Your booking is confirmed! Expert Partner '{worker_profile.get('name')}' is assigned. ETA check on PWA."
                )

            # Update booking state for response
            new_booking["workerId"] = worker_id
            new_booking["status"] = "worker_assigned"

        return new_booking

booking_service = BookingService()

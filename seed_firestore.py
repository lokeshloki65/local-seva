import os
import json
import datetime
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

def init_firebase():
    """Initializes Firebase Admin SDK based on environment credentials."""
    # Check if firebase_admin is already initialized
    try:
        firebase_admin.get_app()
    except ValueError:
        service_account_env = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_env:
            try:
                # If it's a JSON string, load it
                creds_dict = json.loads(service_account_env)
                cred = credentials.Certificate(creds_dict)
                firebase_admin.initialize_app(cred)
            except Exception as e:
                print(f"Failed to load credentials from env JSON: {e}. Falling back to default credentials.")
                firebase_admin.initialize_app()
        else:
            # Fallback to local service account file if it exists, or default ADC credentials
            if os.path.exists("service-account.json"):
                cred = credentials.Certificate("service-account.json")
                firebase_admin.initialize_app(cred)
            else:
                print("No service account configuration found in env or local folder. Initializing with default Application Default Credentials.")
                firebase_admin.initialize_app()

def seed_data():
    db = admin_firestore.client()
    print("Successfully connected to Firestore. Starting seeding process...")

    # 1. CATEGORIES
    categories = [
        {"id": "cleaning", "name": "Deep Cleaning", "iconURL": "Sparkles", "order": 1, "isActive": True},
        {"id": "plumbing", "name": "Plumbing", "iconURL": "Wrench", "order": 2, "isActive": True},
        {"id": "electrical", "name": "Electrical Support", "iconURL": "Zap", "order": 3, "isActive": True},
        {"id": "ac_repair", "name": "AC & Appliance Repair", "iconURL": "Wind", "order": 4, "isActive": True},
        {"id": "painting", "name": "Painting Services", "iconURL": "Paintbrush", "order": 5, "isActive": True},
        {"id": "pest_control", "name": "Pest Control", "iconURL": "ShieldAlert", "order": 6, "isActive": True},
        {"id": "beauty", "name": "Salon & Beauty at Home", "iconURL": "Heart", "order": 7, "isActive": True},
        {"id": "appliance_repair", "name": "Smart Home & TV Repair", "iconURL": "Tv", "order": 8, "isActive": True},
        {"id": "carpentry", "name": "Carpentry Work", "iconURL": "Hammer", "order": 9, "isActive": True},
        {"id": "gardening", "name": "Gardening & Landscaping", "iconURL": "Flower", "order": 10, "isActive": True}
    ]

    for cat in categories:
        db.collection("categories").document(cat["id"]).set(cat)
    print(f"Seeded {len(categories)} service categories.")

    # 2. SERVICES & SUB-SERVICES
    services = [
        # Cleaning
        {
            "id": "full_house_clean",
            "categoryId": "cleaning",
            "name": "Full Home Deep Cleaning",
            "description": "Thorough sanitization and heavy-duty dust, stain, and grime removal for all rooms, bathroom, and kitchen.",
            "basePrice": 3499.0,
            "priceRange": {"min": 2999.0, "max": 7999.0},
            "estimatedDuration": 240,
            "imageURL": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
            "isActive": True,
            "subServices": [
                {"id": "1bhk", "name": "1 BHK deep clean", "price": 2999.0},
                {"id": "2bhk", "name": "2 BHK deep clean", "price": 3999.0},
                {"id": "3bhk", "name": "3 BHK deep clean", "price": 5499.0}
            ],
            "addOns": [
                {"id": "balcony", "name": "Balcony deep clean addon", "price": 499.0},
                {"id": "fridge", "name": "Refrigerator interior deep clean", "price": 399.0}
            ],
            "faqs": [
                {"question": "Do I need to supply cleaning liquids?", "answer": "No, our professionals bring premium chemical solvents and vacuum equipment."}
            ],
            "inclusions": ["Kitchen grease removal", "Bathroom floor scrubbing", "Window glass polishing"],
            "exclusions": ["Moving heavy loaded wardrobes", "Facade/external cleaning"],
            "availableZones": ["chennai_core", "omr_highway", "madurai_central"],
            "surgeMultiplier": 1.0,
            "createdAt": datetime.datetime.now(datetime.timezone.utc)
        },
        # Plumbing
        {
            "id": "tap_repair",
            "categoryId": "plumbing",
            "name": "Leaking Tap & Mixer Repair",
            "description": "Fix minor leaks, replacement of washbasin tap spindles, or complete mixer installations.",
            "basePrice": 199.0,
            "priceRange": {"min": 149.0, "max": 599.0},
            "estimatedDuration": 45,
            "imageURL": "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
            "isActive": True,
            "subServices": [
                {"id": "gasket_replace", "name": "Spindle gasket replacement", "price": 149.0},
                {"id": "tap_install", "name": "New luxury tap installation", "price": 349.0}
            ],
            "addOns": [
                {"id": "teflon_tape", "name": "Premium pipe sealant wrapping", "price": 49.0}
            ],
            "faqs": [
                {"question": "Are spare parts included in the price?", "answer": "No, the service includes labor only. Spare parts are billed extra based on standard rates."}
            ],
            "inclusions": ["Leak diagnostics", "Spindle servicing", "15-day service warranty"],
            "exclusions": ["Concealed wall pipeline repairs"],
            "availableZones": ["chennai_core", "omr_highway", "madurai_central"],
            "surgeMultiplier": 1.0,
            "createdAt": datetime.datetime.now(datetime.timezone.utc)
        },
        # Electrical
        {
            "id": "switchboard_fix",
            "categoryId": "electrical",
            "name": "Switchboard Repair & Modular Installation",
            "description": "Repair faulty switch buttons, replace internal wiring, or install brand-new modular switches.",
            "basePrice": 149.0,
            "priceRange": {"min": 99.0, "max": 499.0},
            "estimatedDuration": 30,
            "imageURL": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80",
            "isActive": True,
            "subServices": [
                {"id": "switch_replace", "name": "Replace single switch/socket", "price": 99.0},
                {"id": "complete_board", "name": "Assemble complete new modular board", "price": 449.0}
            ],
            "addOns": [
                {"id": "heavy_mcb", "name": "Add MCB safety breaker support", "price": 299.0}
            ],
            "faqs": [
                {"question": "Will power be shut off?", "answer": "Yes, for safety, our engineer will briefly toggle the main mains breaker during the install."}
            ],
            "inclusions": ["Safe copper loop test", "Button replacement", "Earthing safety verification"],
            "exclusions": ["Full house rewiring"],
            "availableZones": ["chennai_core", "omr_highway", "madurai_central"],
            "surgeMultiplier": 1.0,
            "createdAt": datetime.datetime.now(datetime.timezone.utc)
        },
        # AC Repair
        {
            "id": "ac_servicing",
            "categoryId": "ac_repair",
            "name": "AC Jet Service & Gas Refill",
            "description": "Pressure pump water jet wash of indoor/outdoor unit coils for higher cooling efficiency.",
            "basePrice": 599.0,
            "priceRange": {"min": 499.0, "max": 2500.0},
            "estimatedDuration": 90,
            "imageURL": "https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=600&q=80",
            "isActive": True,
            "subServices": [
                {"id": "jet_wash", "name": "Split AC deep jet service", "price": 599.0},
                {"id": "gas_charge", "name": "Freon R32/R410 full gas top-up", "price": 1800.0}
            ],
            "addOns": [
                {"id": "drain_pipe", "name": "Unclog drain pipe & extension", "price": 199.0}
            ],
            "faqs": [
                {"question": "How often should I service my AC?", "answer": "A water jet clean is recommended every 6 months to maintain high energy star performance."}
            ],
            "inclusions": ["Coil pressure wash", "Air filter cleanup", "Amperage and cooling check"],
            "exclusions": ["Compressor coil welding / leak repairs"],
            "availableZones": ["chennai_core", "omr_highway", "madurai_central"],
            "surgeMultiplier": 1.0,
            "createdAt": datetime.datetime.now(datetime.timezone.utc)
        }
    ]

    # Let's expand list dynamically to ensure at least 30+ services across remaining categories as required
    remaining_cats = ["painting", "pest_control", "beauty", "appliance_repair", "carpentry", "gardening"]
    for i, cat in enumerate(remaining_cats):
        # We will add 5 services for each to easily reach 30+ services overall
        for j in range(1, 6):
            srv_id = f"{cat}_service_{j}"
            services.append({
                "id": srv_id,
                "categoryId": cat,
                "name": f"{cat.capitalize()} Specialist Job #{j}",
                "description": f"Top-tier professional servicing for all {cat} requirements. Executed by verified experts.",
                "basePrice": float(200 * j + 150),
                "priceRange": {"min": float(150 * j), "max": float(1000 * j)},
                "estimatedDuration": 60 * j,
                "imageURL": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
                "isActive": True,
                "subServices": [
                    {"id": f"sub_{j}_1", "name": "Standard Option", "price": float(200 * j + 150)},
                    {"id": f"sub_{j}_2", "name": "Premium Tier Option", "price": float(350 * j + 200)}
                ],
                "addOns": [
                    {"id": f"add_{j}_1", "name": "Express completion delivery", "price": 99.0}
                ],
                "faqs": [
                    {"question": "What is the warranty?", "answer": "All platform jobs come with a verified 30-day workmanship assurance."}
                ],
                "inclusions": ["Labor charge", "Post-work cleanup", "Quality checks"],
                "exclusions": ["Procurement of high-value equipment/materials"],
                "availableZones": ["chennai_core", "omr_highway", "madurai_central"],
                "surgeMultiplier": 1.0,
                "createdAt": datetime.datetime.now(datetime.timezone.utc)
            })

    for srv in services:
        db.collection("services").document(srv["id"]).set(srv)
    print(f"Seeded {len(services)} services.")

    # 3. ZONES
    zones = [
        {
            "id": "chennai_core",
            "name": "Chennai Central Core",
            "city": "Chennai",
            "polygon": [
                {"lat": 13.0827, "lng": 80.2707},
                {"lat": 13.0400, "lng": 80.2500},
                {"lat": 13.0200, "lng": 80.2000},
                {"lat": 13.0900, "lng": 80.1800}
            ],
            "isActive": True,
            "surgeMultiplier": 1.2,
            "workerIds": ["worker_1", "worker_2", "worker_3", "worker_7"]
        },
        {
            "id": "omr_highway",
            "name": "OMR Tech Corridor",
            "city": "Chennai",
            "polygon": [
                {"lat": 13.0100, "lng": 80.2200},
                {"lat": 12.9000, "lng": 80.2300},
                {"lat": 12.8000, "lng": 80.2200},
                {"lat": 12.9500, "lng": 80.1500}
            ],
            "isActive": True,
            "surgeMultiplier": 1.0,
            "workerIds": ["worker_4", "worker_5", "worker_6", "worker_8"]
        },
        {
            "id": "madurai_central",
            "name": "Madurai Heritage Area",
            "city": "Madurai",
            "polygon": [
                {"lat": 9.9252, "lng": 78.1198},
                {"lat": 9.9000, "lng": 78.1500},
                {"lat": 9.9500, "lng": 78.1800},
                {"lat": 9.9600, "lng": 78.1000}
            ],
            "isActive": True,
            "surgeMultiplier": 1.1,
            "workerIds": ["worker_9", "worker_10"]
        }
    ]
    for zone in zones:
        db.collection("zones").document(zone["id"]).set(zone)
    print("Seeded serviceable geographic zones.")

    # 4. USERS (3 Admins, 10 Workers, 5 Customers)
    users = []

    # Admins
    for a in range(1, 4):
        users.append({
            "uid": f"admin_{a}",
            "email": f"admin{a}@servalocal.com",
            "phone": f"+91999990000{a}",
            "name": f"Master Admin {a}",
            "photoURL": f"https://api.dicebear.com/7.x/adventurer/svg?seed=admin{a}",
            "role": "admin" if a < 3 else "superadmin",
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
            "isActive": True,
            "preferredLanguage": "en",
            "fcmTokens": [],
            "notificationPreferences": {"email": True, "sms": True, "push": True}
        })

    # Workers
    skills_pool = [
        ["full_house_clean"],
        ["tap_repair", "carpentry_service_1"],
        ["switchboard_fix", "appliance_repair_service_1"],
        ["ac_servicing"],
        ["painting_service_1", "painting_service_2"],
        ["pest_control_service_1"],
        ["beauty_service_1", "beauty_service_2"],
        ["appliance_repair_service_2", "electrical_service_2"],
        ["carpentry_service_2", "carpentry_service_3"],
        ["gardening_service_1", "gardening_service_2"]
    ]
    cities_pool = ["Chennai", "Chennai", "Chennai", "Chennai", "Chennai", "Chennai", "Chennai", "Chennai", "Madurai", "Madurai"]
    zones_pool = [
        ["chennai_core"], ["chennai_core"], ["chennai_core"],
        ["omr_highway"], ["omr_highway"], ["omr_highway"],
        ["chennai_core", "omr_highway"], ["omr_highway"],
        ["madurai_central"], ["madurai_central"]
    ]

    for w in range(1, 11):
        users.append({
            "uid": f"worker_{w}",
            "email": f"worker{w}@servalocal.com",
            "phone": f"+91987654321{w-1}",
            "name": f"Expert Partner {w}",
            "photoURL": f"https://api.dicebear.com/7.x/avataaars/svg?seed=worker{w}",
            "role": "worker",
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
            "isActive": True,
            "preferredLanguage": "en" if w % 2 == 0 else "ta",
            "skills": skills_pool[w-1],
            "serviceZones": zones_pool[w-1],
            "isOnline": True if w <= 7 else False,
            "isApproved": True if w < 10 else False,  # worker 10 is pending approval
            "rating": round(3.5 + (w * 0.15), 2) if w < 10 else 0.0,
            "totalJobsCompleted": 10 * w,
            "level": "Expert" if w > 7 else ("Professional" if w > 3 else "Rookie"),
            "xpPoints": 300 * w,
            "badges": ["Speedy Response", "5-Star Streak"] if w > 5 else ["Quick Learner"],
            "bankDetails": {
                "accountNumber": f"1234567890123{w}",
                "ifscCode": "SBIN0001234",
                "bankName": "State Bank of India",
                "upiId": f"worker{w}@okaxis"
            },
            "currentLocation": {"lat": 13.08 + (w*0.005), "lng": 80.27 + (w*0.003)} if w <= 8 else {"lat": 9.92 + (w*0.001), "lng": 78.12 + (w*0.001)},
            "fcmTokens": [],
            "notificationPreferences": {"email": True, "sms": True, "push": True}
        })

    # Customers
    wallet_balances = [1500.0, 50.0, 0.0, 4500.0, 250.0]
    loyalty_points_list = [150, 10, 0, 500, 20]
    sub_plans = ["Silver", "Free", "Free", "Platinum", "Gold"]

    for c in range(1, 6):
        users.append({
            "uid": f"customer_{c}",
            "email": f"customer{c}@gmail.com",
            "phone": f"+91912345678{c-1}",
            "name": f"Valued Customer {c}",
            "photoURL": f"https://api.dicebear.com/7.x/miniavs/svg?seed=customer{c}",
            "role": "customer",
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
            "isActive": True,
            "preferredLanguage": "ta" if c == 1 else ("hi" if c == 4 else "en"),
            "savedAddresses": [
                {
                    "id": f"addr_{c}_1",
                    "label": "Home",
                    "formatted": f"Flat No {10+c}, Apollo Apartments, Anna Nagar, Chennai - 600040",
                    "lat": 13.0850,
                    "lng": 80.2100,
                    "flatNo": f"10{c}",
                    "landmark": "Near Apollo Pharmacy"
                },
                {
                    "id": f"addr_{c}_2",
                    "label": "Work",
                    "formatted": f"Floor {c}, Tidel Park, OMR Road, Tharamani, Chennai - 600113",
                    "lat": 12.9890,
                    "lng": 80.2450,
                    "flatNo": f"Bay {c*10}",
                    "landmark": "Block C"
                }
            ],
            "walletBalance": wallet_balances[c-1],
            "loyaltyPoints": loyalty_points_list[c-1],
            "subscriptionPlan": sub_plans[c-1],
            "referralCode": f"SERVA{c}00",
            "referredBy": "SERVA100" if c > 1 else "",
            "fcmTokens": [],
            "notificationPreferences": {"email": True, "sms": True, "push": True}
        })

    for u in users:
        db.collection("users").document(u["uid"]).set(u)
    print(f"Seeded {len(users)} users (admins, workers, customers).")

    # 5. SUBSCRIPTIONS
    subscriptions = [
        {
            "id": "sub_customer_1",
            "userId": "customer_1",
            "plan": "Silver",
            "status": "active",
            "activatedAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10),
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=20),
            "activatedBy": "admin_1",
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10)
        },
        {
            "id": "sub_customer_4",
            "userId": "customer_4",
            "plan": "Platinum",
            "status": "active",
            "activatedAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=5),
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=25),
            "activatedBy": "admin_2",
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=5)
        },
        {
            "id": "sub_customer_5",
            "userId": "customer_5",
            "plan": "Gold",
            "status": "active",
            "activatedAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=29),
            "activatedBy": "admin_1",
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
        }
    ]
    for sub in subscriptions:
        db.collection("subscriptions").document(sub["id"]).set(sub)
    print("Seeded active subscription plans.")

    # 6. COUPON CODES
    coupons = [
        {
            "id": "WELCOME100",
            "code": "WELCOME100",
            "type": "flat",
            "value": 100.0,
            "minOrderValue": 499.0,
            "usageLimit": 1000,
            "usedCount": 42,
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=90),
            "isActive": True
        },
        {
            "id": "FESTIVE20",
            "code": "FESTIVE20",
            "type": "percentage",
            "value": 20.0,
            "minOrderValue": 999.0,
            "usageLimit": 500,
            "usedCount": 110,
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30),
            "isActive": True
        },
        {
            "id": "SUPERCREDIT",
            "code": "SUPERCREDIT",
            "type": "flat",
            "value": 250.0,
            "minOrderValue": 1499.0,
            "usageLimit": 100,
            "usedCount": 99,
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),  # expired
            "isActive": False
        },
        {
            "id": "OMRSPECIAL",
            "code": "OMRSPECIAL",
            "type": "percentage",
            "value": 15.0,
            "minOrderValue": 599.0,
            "usageLimit": 200,
            "usedCount": 15,
            "expiresAt": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=45),
            "isActive": True
        }
    ]
    for coupon in coupons:
        db.collection("coupons").document(coupon["id"]).set(coupon)
    print("Seeded discount coupon codes.")

    # 7. BOOKINGS & TRANSACTIONS & REVIEWS (20 Sample Bookings)
    booking_statuses = [
        "completed", "completed", "completed", "completed", "completed",
        "completed", "completed", "completed", "completed", "completed",
        "confirmed", "worker_assigned", "en_route", "in_progress", "requested",
        "cancelled", "cancelled", "disputed", "requested", "completed"
    ]
    customers_map = ["customer_1", "customer_2", "customer_3", "customer_4", "customer_5"]
    workers_map = ["worker_1", "worker_2", "worker_3", "worker_4", "worker_5", "worker_6", "worker_7", "worker_8", "worker_9", "worker_4"]
    services_map = ["full_house_clean", "tap_repair", "switchboard_fix", "ac_servicing"]

    for b in range(1, 21):
        status = booking_statuses[b-1]
        cust_id = customers_map[(b-1) % len(customers_map)]
        # Match worker appropriate for service skill
        srv_idx = (b-1) % len(services_map)
        srv_id = services_map[srv_idx]

        if srv_id == "full_house_clean":
            wrk_id = "worker_1"
            base_p = 3499.0
        elif srv_id == "tap_repair":
            wrk_id = "worker_2"
            base_p = 199.0
        elif srv_id == "switchboard_fix":
            wrk_id = "worker_3"
            base_p = 149.0
        else:
            wrk_id = "worker_4"
            base_p = 599.0

        promo_d = 50.0 if b % 3 == 0 else 0.0
        wallet_u = 100.0 if b % 2 == 0 else 0.0
        surge_m = 1.2 if b % 4 == 0 else 1.0
        final_amt = round((base_p * surge_m) - promo_d - wallet_u, 2)
        if final_amt < 0:
            final_amt = 0.0

        bk_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=(21-b))

        booking = {
            "id": f"booking_id_{b:03d}",
            "customerId": cust_id,
            "workerId": wrk_id if status != "requested" else "",
            "serviceId": srv_id,
            "subServiceId": "1bhk" if srv_id == "full_house_clean" else "gasket_replace",
            "status": status,
            "address": {
                "formatted": "100ft Bye Pass Road, Velachery, Chennai, Tamil Nadu - 600042",
                "lat": 12.9784,
                "lng": 80.2205,
                "flatNo": "Tower A, 5th Floor",
                "landmark": "Near Velachery Metro"
            },
            "scheduledAt": bk_time + datetime.timedelta(hours=2),
            "confirmedAt": bk_time + datetime.timedelta(minutes=15) if status != "requested" else None,
            "startedAt": bk_time + datetime.timedelta(hours=2) if status in ["in_progress", "completed"] else None,
            "completedAt": bk_time + datetime.timedelta(hours=3, minutes=30) if status == "completed" else None,
            "cancelledAt": bk_time + datetime.timedelta(minutes=45) if status == "cancelled" else None,
            "pricing": {
                "basePrice": base_p,
                "addOns": [{"id": "balcony", "name": "Balcony Deep Clean", "price": 499.0}] if srv_id == "full_house_clean" else [],
                "surgeMultiplier": surge_m,
                "promoDiscount": promo_d,
                "walletUsed": wallet_u,
                "finalAmount": final_amt
            },
            "paymentMethod": "wallet" if b % 2 == 0 else "cash",
            "paymentStatus": "collected" if status == "completed" else "pending",
            "specialInstructions": "Please arrive on time. Knock gently as baby is sleeping.",
            "beforePhotos": ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80"] if status == "completed" else [],
            "afterPhotos": ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80"] if status == "completed" else [],
            "customerOTP": "8841",
            "workerNotes": "Cleaned up all grease areas. Extremely polite customer.",
            "rating": {
                "score": 5.0 if b % 2 == 0 else 4.0,
                "review": "Excellent punctuality and clean execution!",
                "tags": ["On time", "Professional", "Good quality"],
                "reviewedAt": bk_time + datetime.timedelta(hours=4)
            } if status == "completed" else None,
            "timeline": [
                {"status": "requested", "timestamp": bk_time.isoformat()},
                {"status": "confirmed", "timestamp": (bk_time + datetime.timedelta(minutes=5)).isoformat()}
            ],
            "messages": [],
            "issueReports": [
                {
                    "id": f"issue_{b}",
                    "description": "Worker arrived 15 minutes late but did fine work.",
                    "photoURL": "",
                    "createdAt": (bk_time + datetime.timedelta(hours=4)).isoformat()
                }
            ] if status == "disputed" else [],
            "createdAt": bk_time,
            "updatedAt": bk_time
        }

        # Write booking
        db.collection("bookings").document(booking["id"]).set(booking)

        # 8. Seed Transactions for wallet bookings or top-ups
        if wallet_u > 0:
            tx = {
                "id": f"tx_bk_{b}",
                "userId": cust_id,
                "type": "debit",
                "amount": wallet_u,
                "description": f"Paid toward booking {booking['id']}",
                "bookingId": booking["id"],
                "createdAt": bk_time
            }
            db.collection("transactions").document(tx["id"]).set(tx)

        # Add referral credit transaction for customer 1
        if b == 1:
            ref_tx = {
                "id": "tx_ref_001",
                "userId": "customer_1",
                "type": "credit",
                "amount": 250.0,
                "description": "Referral bonus for inviting customer_2",
                "bookingId": "",
                "createdAt": bk_time - datetime.timedelta(days=2)
            }
            db.collection("transactions").document(ref_tx["id"]).set(ref_tx)

        # 9. Seed Reviews collection
        if status == "completed" and booking["rating"]:
            rev = {
                "id": f"rev_{b}",
                "bookingId": booking["id"],
                "customerId": cust_id,
                "workerId": wrk_id,
                "score": booking["rating"]["score"],
                "review": booking["rating"]["review"],
                "tags": booking["rating"]["tags"],
                "photos": booking["afterPhotos"],
                "createdAt": booking["rating"]["reviewedAt"]
            }
            db.collection("reviews").document(rev["id"]).set(rev)

    # 10. Seed Worker Payouts
    for w in range(1, 6):
        payout = {
            "id": f"payout_w_{w}",
            "workerId": f"worker_{w}",
            "amount": 4500.0 * w,
            "periodStart": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=14),
            "periodEnd": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7),
            "status": "sent" if w < 4 else "pending",
            "markedSentBy": "admin_1" if w < 4 else "",
            "markedSentAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=6) if w < 4 else None,
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=5)
        }
        db.collection("workerPayouts").document(payout["id"]).set(payout)

    print("Seeded bookings, reviews, wallet transactions, and worker payouts.")

    # 11. Seed Admin Audit Logs
    logs = [
        {
            "id": "audit_001",
            "adminUid": "admin_1",
            "action": "approve_worker",
            "targetType": "worker",
            "targetId": "worker_1",
            "details": {"previousStatus": "pending", "newStatus": "verified"},
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=20)
        },
        {
            "id": "audit_002",
            "adminUid": "admin_2",
            "action": "topup_wallet",
            "targetType": "customer",
            "targetId": "customer_4",
            "details": {"amount": 4000.0, "reason": "VIP Corporate Loyalty Credit"},
            "createdAt": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=4)
        }
    ]
    for log in logs:
        db.collection("auditLogs").document(log["id"]).set(log)

    print("Seeded admin audit logs successfully!")
    print("Database seeding completed beautifully.")

if __name__ == "__main__":
    init_firebase()
    seed_data()

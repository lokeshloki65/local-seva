from google.cloud import firestore
import uuid
import datetime
import logging
from app.core.firebase import db
from app.core.exceptions import WalletOverdraftException

logger = logging.getLogger("servalocal.wallet")

class WalletService:
    @staticmethod
    def adjust_balance(user_id: str, amount: float, tx_type: str, description: str, booking_id: str = "") -> float:
        """
        Atomically adjusts user's wallet balance using a Firestore transaction.
        Checks for overdraft in case of debits.
        Returns the new updated balance.
        """
        transaction = db.transaction()
        user_ref = db.collection("users").document(user_id)
        
        @firestore.transactional
        def update_in_transaction(tx, u_ref):
            snapshot = u_ref.get(transaction=tx)
            if not snapshot.exists:
                raise ValueError(f"User {user_id} does not exist.")
            
            user_data = snapshot.to_dict()
            current_balance = float(user_data.get("walletBalance", 0.0))
            
            if tx_type == "debit":
                if current_balance < amount:
                    raise WalletOverdraftException(
                        f"Insufficient funds. Required: ₹{amount}, Available: ₹{current_balance}"
                    )
                new_balance = round(current_balance - amount, 2)
            elif tx_type == "credit":
                new_balance = round(current_balance + amount, 2)
            else:
                raise ValueError("Invalid transaction type. Must be 'credit' or 'debit'.")
            
            # 1. Update walletBalance in users document
            tx.update(u_ref, {"walletBalance": new_balance, "updatedAt": datetime.datetime.now(datetime.timezone.utc)})
            
            # 2. Write to transactions collection
            tx_id = f"tx_{uuid.uuid4().hex[:12]}"
            tx_ref = db.collection("transactions").document(tx_id)
            tx_record = {
                "id": tx_id,
                "userId": user_id,
                "type": tx_type,
                "amount": amount,
                "description": description,
                "bookingId": booking_id,
                "createdAt": datetime.datetime.now(datetime.timezone.utc)
            }
            tx.set(tx_ref, tx_record)
            
            # 3. Award loyalty points if it was a booking debit
            if tx_type == "debit" and booking_id:
                # 1 loyalty point per ₹10 spent
                points_earned = int(amount // 10)
                if points_earned > 0:
                    current_points = int(user_data.get("loyaltyPoints", 0))
                    tx.update(u_ref, {"loyaltyPoints": current_points + points_earned})
            
            return new_balance

        try:
            new_bal = update_in_transaction(transaction, user_ref)
            logger.info(f"Wallet transaction successful. User: {user_id}, {tx_type.upper()}: ₹{amount}. New Balance: ₹{new_bal}")
            return new_bal
        except Exception as e:
            logger.error(f"Wallet transaction aborted: {e}")
            raise e

wallet_service = WalletService()

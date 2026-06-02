import os
import json
import logging
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
from app.core.config import settings

logger = logging.getLogger("servalocal.firebase")

# =====================================================================
# PREMIUM LOCAL MOCK SANDBOX FALLBACKS
# =====================================================================
# This allows the FastAPI server to boot and simulate every database,
# authentication, and storage transaction locally even if the user
# has not yet downloaded their private Service Account JSON key.
# =====================================================================
class MockDocumentReference:
    def __init__(self, data_store, collection_name, doc_id):
        self.data_store = data_store
        self.coll = collection_name
        self.id = doc_id

    def set(self, data, merge=True):
        if self.coll not in self.data_store:
            self.data_store[self.coll] = {}
        if merge and self.id in self.data_store[self.coll]:
            self.data_store[self.coll][self.id].update(data)
        else:
            self.data_store[self.coll][self.id] = data
        return self

    def update(self, data):
        if self.coll in self.data_store and self.id in self.data_store[self.coll]:
            self.data_store[self.coll][self.id].update(data)
        else:
            self.set(data, merge=True)
        return self

    def get(self):
        class MockDocumentSnapshot:
            def __init__(self, exists, d_id, val):
                self.exists = exists
                self.id = d_id
                self._val = val
            def to_dict(self):
                return self._val
        val = self.data_store.get(self.coll, {}).get(self.id)
        return MockDocumentSnapshot(val is not None, self.id, val or {})

    def delete(self):
        if self.coll in self.data_store and self.id in self.data_store[self.coll]:
            del self.data_store[self.coll][self.id]
        return self

class MockCollectionReference:
    def __init__(self, data_store, collection_name):
        self.data_store = data_store
        self.name = collection_name

    def document(self, doc_id=None):
        if not doc_id:
            import uuid
            doc_id = f"doc_{str(uuid.uuid4())[:8]}"
        return MockDocumentReference(self.data_store, self.name, doc_id)

    def stream(self):
        docs = []
        class MockDocumentSnapshot:
            def __init__(self, d_id, val):
                self.id = d_id
                self._val = val
            def to_dict(self):
                return self._val
        for d_id, val in self.data_store.get(self.name, {}).items():
            docs.append(MockDocumentSnapshot(d_id, val))
        return docs

class MockFirestoreClient:
    def __init__(self):
        self.data_store = {
            "services": {
                "full_house_clean": {
                    "id": "full_house_clean",
                    "name": "Full Home Deep Clean",
                    "basePrice": 3499,
                    "description": "Grime and stain removal by verified experts.",
                    "imageURL": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
                    "subServices": [
                        { "id": "1bhk", "name": "1 BHK Apartment Package", "price": 3499 },
                        { "id": "2bhk", "name": "2 BHK Apartment Package", "price": 4999 }
                    ],
                    "addOns": []
                },
                "ac_servicing": {
                    "id": "ac_servicing",
                    "name": "AC Jet Pressure Service",
                    "basePrice": 599,
                    "description": "Pressure water coil deep clean.",
                    "imageURL": "https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=600&q=80",
                    "subServices": [
                        { "id": "1bhk", "name": "Standard split AC unit clean", "price": 599 }
                    ],
                    "addOns": []
                }
            }
        }
    def collection(self, name):
        return MockCollectionReference(self.data_store, name)

class MockAuthClient:
    def __init__(self, data_store):
        self.data_store = data_store

    def create_user(self, email, password, display_name=None, phone_number=None, uid=None):
        if not uid:
            import uuid
            uid = f"usr_{str(uuid.uuid4())[:8]}"
        user_record = {
            "uid": uid,
            "email": email,
            "displayName": display_name,
            "phoneNumber": phone_number,
            "role": "customer"
        }
        if "users" not in self.data_store:
            self.data_store["users"] = {}
        self.data_store["users"][uid] = user_record
        
        class UserRecordObj:
            def __init__(self, d):
                self.uid = d["uid"]
                self.email = d["email"]
                self.display_name = d.get("displayName")
                self.phone_number = d.get("phoneNumber")
        return UserRecordObj(user_record)

    def get_user(self, uid):
        class UserRecordObj:
            def __init__(self, uid):
                self.uid = uid
                self.email = "mockuser@domain.in"
                self.display_name = "Mock User"
                self.phone_number = "+919876543210"
        return UserRecordObj(uid)

class MockStorageBucket:
    def blob(self, name):
        class MockBlob:
            def upload_from_string(self, *args, **kwargs): pass
            def generate_signed_url(self, *args, **kwargs):
                return "https://mockstorage.local/invoice.pdf"
        return MockBlob()

# =====================================================================
# SYSTEM INITIALIZATION PIPELINE
# =====================================================================
db = None
auth_client = None
bucket = None
is_sandbox_mode = False

try:
    # Attempt genuine Firebase Admin Initialization
    service_account_str = settings.FIREBASE_SERVICE_ACCOUNT_JSON
    
    if service_account_str and service_account_str.strip().startswith("{") and "client_email" in service_account_str:
        creds_dict = json.loads(service_account_str)
        cred = credentials.Certificate(creds_dict)
        firebase_app = firebase_admin.initialize_app(cred, {
            'storageBucket': "developers-man.firebasestorage.app"
        })
        db = firestore.client()
        auth_client = auth
        bucket = storage.bucket()
        logger.info("Firebase Admin initialized successfully from service account.")
    elif os.path.exists("service-account.json"):
        cred = credentials.Certificate("service-account.json")
        firebase_app = firebase_admin.initialize_app(cred, {
            'storageBucket': "developers-man.firebasestorage.app"
        })
        db = firestore.client()
        auth_client = auth
        bucket = storage.bucket()
        logger.info("Firebase Admin initialized from local service-account.json.")
    else:
        # If no credentials found, fallback immediately to Sandbox
        raise ValueError("Missing genuine private credentials file")
except Exception as e:
    logger.warning(f"Starting server in LOCAL MOCK SANDBOX mode. Reason: {e}")
    is_sandbox_mode = True
    
    # Initialize mock clients
    mock_db = MockFirestoreClient()
    db = mock_db
    auth_client = MockAuthClient(mock_db.data_store)
    
    class MockStorage:
        def bucket(self):
            return MockStorageBucket()
    bucket = MockStorage().bucket()
    
    # Monkeypatch firebase_admin.auth methods to run offline and prevent SDK missing-app errors
    import firebase_admin.auth as fa_auth
    
    def mock_verify_id_token(token, *args, **kwargs):
        if token.startswith("mock_bearer_token_for_"):
            uid = token.replace("mock_bearer_token_for_", "")
            return {
                "uid": uid,
                "email": "sandbox-user@servalocal.com",
                "name": "Sandbox User",
                "picture": "https://api.dicebear.com/7.x/miniavs/svg?seed=sandbox"
            }
        return {
            "uid": token,
            "email": "sandbox-user@servalocal.com",
            "name": "Sandbox User",
            "picture": "https://api.dicebear.com/7.x/miniavs/svg?seed=sandbox"
        }
        
    fa_auth.create_user = auth_client.create_user
    fa_auth.get_user = auth_client.get_user
    fa_auth.verify_id_token = mock_verify_id_token

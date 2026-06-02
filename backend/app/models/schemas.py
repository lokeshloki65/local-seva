from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any
from datetime import datetime

# ==========================================
# Authentication & User Management
# ==========================================
class PhoneSendOTP(BaseModel):
    phone: str = Field(..., example="+919876543210")

class PhoneVerifyOTP(BaseModel):
    phone: str = Field(..., example="+919876543210")
    otp: str = Field(..., min_length=4, max_length=6, example="1234")

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    phone: str
    role: str = Field("customer", description="customer, worker, admin")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    preferredLanguage: Optional[str] = None
    photoURL: Optional[str] = None
    notificationPreferences: Optional[dict[str, bool]] = None
    savedAddresses: Optional[list[dict[str, Any]]] = None
    bankDetails: Optional[dict[str, str]] = None
    skills: Optional[list[str]] = None
    serviceZones: Optional[list[str]] = None

# ==========================================
# Services & Categories
# ==========================================
class SubService(BaseModel):
    id: str
    name: str
    price: float

class AddOn(BaseModel):
    id: str
    name: str
    price: float

class ServiceCreateUpdate(BaseModel):
    name: str
    categoryId: str
    description: str
    basePrice: float
    priceRange: dict[str, float]
    estimatedDuration: int
    imageURL: str
    isActive: bool = True
    subServices: list[SubService] = []
    addOns: list[AddOn] = []
    faqs: list[dict[str, str]] = []
    inclusions: list[str] = []
    exclusions: list[str] = []
    availableZones: list[str] = []
    surgeMultiplier: float = 1.0

# ==========================================
# Booking & Rescheduling
# ==========================================
class AddressSchema(BaseModel):
    formatted: str
    lat: float
    lng: float
    flatNo: Optional[str] = None
    landmark: Optional[str] = None

class BookingPricing(BaseModel):
    basePrice: float
    addOns: list[dict[str, Any]] = []
    surgeMultiplier: float = 1.0
    promoDiscount: float = 0.0
    walletUsed: float = 0.0
    finalAmount: float

class BookingCreate(BaseModel):
    serviceId: str
    subServiceId: str
    scheduledAt: datetime
    address: AddressSchema
    specialInstructions: Optional[str] = None
    paymentMethod: str = Field("cash", description="wallet or cash")
    promoCode: Optional[str] = None
    useWallet: bool = False

class BookingReschedule(BaseModel):
    newScheduledAt: datetime

class BookingCancel(BaseModel):
    reason: str

class BookingReview(BaseModel):
    score: float = Field(..., ge=1.0, le=5.0)
    review: str
    tags: list[str] = []
    photos: list[str] = []

class BookingIssue(BaseModel):
    description: str
    photoURL: Optional[str] = None

# ==========================================
# Admin Operations
# ==========================================
class AdminWalletAdjust(BaseModel):
    amount: float
    type: str = Field("credit", description="credit or debit")
    reason: str

class AdminSubscriptionAssign(BaseModel):
    plan: str = Field("Silver", description="Silver, Gold, Platinum")

class AdminAssignWorker(BaseModel):
    workerId: str

class BroadcastNotification(BaseModel):
    title: str
    body: str
    targetGroup: str = Field("all", description="all, customers, workers, zone")
    zoneId: Optional[str] = None

# ==========================================
# AI Assistant & Features
# ==========================================
class AIChatQuery(BaseModel):
    message: str
    context: Optional[dict[str, Any]] = None

class AISearchIntent(BaseModel):
    naturalQuery: str

# ==========================================
# Video Consultation
# ==========================================
class BookVideoCall(BaseModel):
    scheduledAt: datetime
    bookingId: Optional[str] = None

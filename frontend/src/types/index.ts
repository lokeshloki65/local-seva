// Shared TypeScript Declarations for ServaLocal

export type UserRole = 'customer' | 'worker' | 'admin' | 'superadmin';

export interface SavedAddress {
  id: string;
  label: string; // 'Home', 'Work', 'Other'
  formatted: string;
  lat: number;
  lng: number;
  flatNo?: string;
  landmark?: string;
}

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  phone: string;
  name: string;
  photoURL: string;
  role: UserRole;
  isActive: boolean;
  preferredLanguage: 'en' | 'ta' | 'hi';
  createdAt: string;
  updatedAt: string;
  
  // Role Specific Attributes
  // Customer:
  savedAddresses?: SavedAddress[];
  walletBalance?: number;
  loyaltyPoints?: number;
  subscriptionPlan?: 'Free' | 'Silver' | 'Gold' | 'Platinum';
  referralCode?: string;
  referredBy?: string;
  
  // Worker:
  skills?: string[];
  serviceZones?: string[];
  isOnline?: boolean;
  isApproved?: boolean;
  rating?: number;
  totalJobsCompleted?: number;
  level?: 'Rookie' | 'Professional' | 'Expert' | 'Master' | 'Legend';
  xpPoints?: number;
  badges?: string[];
  bankDetails?: BankDetails;
  currentLocation?: { lat: number; lng: number };
  
  // Push / notification configs
  fcmTokens?: string[];
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface SubService {
  id: string;
  name: string;
  price: number;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ServiceItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  priceRange: { min: number; max: number };
  estimatedDuration: number; // in minutes
  imageURL: string;
  isActive: boolean;
  subServices: SubService[];
  addOns: AddOn[];
  faqs: FAQItem[];
  inclusions: string[];
  exclusions: string[];
  availableZones: string[];
  surgeMultiplier: number;
  createdAt?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  iconURL: string; // Dynamic icon name string
  order: number;
  isActive: boolean;
}

export interface BookingPricingSummary {
  basePrice: number;
  addOns: { id: string; name: string; price: number }[];
  surgeMultiplier: number;
  promoDiscount: number;
  walletUsed: number;
  finalAmount: number;
}

export interface BookingRating {
  score: number;
  review: string;
  tags: string[];
  reviewedAt: string;
}

export interface TimelineEvent {
  status: string;
  timestamp: string;
  reason?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface IssueReport {
  id: string;
  description: string;
  photoURL?: string;
  reporterId: string;
  createdAt: string;
}

export interface BookingDetails {
  id: string;
  customerId: string;
  workerId: string;
  serviceId: string;
  subServiceId: string;
  status: 'requested' | 'confirmed' | 'worker_assigned' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  address: SavedAddress;
  scheduledAt: string;
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  pricing: BookingPricingSummary;
  paymentMethod: 'wallet' | 'cash';
  paymentStatus: 'pending' | 'collected' | 'waived';
  specialInstructions?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  customerOTP: string;
  workerNotes?: string;
  rating?: BookingRating;
  timeline: TimelineEvent[];
  messages: ChatMessage[];
  issueReports: IssueReport[];
  createdAt: string;
  updatedAt: string;
}

export interface ZoneItem {
  id: string;
  name: string;
  city: string;
  polygon: { lat: number; lng: number }[];
  isActive: boolean;
  surgeMultiplier: number;
  workerIds: string[];
}

export interface CouponItem {
  id: string;
  code: string;
  type: 'flat' | 'percentage';
  value: number;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  bookingId?: string;
  createdAt: string;
}

export interface PayoutRecord {
  id: string;
  workerId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'sent';
  markedSentBy?: string;
  markedSentAt?: string;
  createdAt: string;
}

export interface VideoCallRecord {
  id: string;
  customerId: string;
  workerId: string;
  bookingId?: string;
  scheduledAt: string;
  roomUrl: string;
  status: 'scheduled' | 'active' | 'completed';
  createdAt: string;
}

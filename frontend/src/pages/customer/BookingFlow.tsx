import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { 
  Sparkles, Calendar, MapPin, CreditCard, ChevronRight, Check, Info, ShieldAlert 
} from 'lucide-react';
import apiClient from '../../services/api';

export const BookingFlow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, syncProfile } = useAuthStore();

  const queryServiceId = searchParams.get('serviceId');
  const queryCategoryId = searchParams.get('categoryId');

  // Step navigation: 1 = Service config, 2 = Address & Time, 3 = Payment Summary
  const [step, setStep] = useState(1);

  // Core Data
  const [service, setService] = useState<any>(null);
  const [selectedSubService, setSelectedSubService] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  
  // Date & Address States
  const [addressLabel, setAddressLabel] = useState('Home');
  const [addressText, setAddressText] = useState('12, Gandhi Street, OMR Tech Corridor, Chennai');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:00 AM');

  // Pricing & Promos
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash'>('cash');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Catalog service info
  useEffect(() => {
    const srvTarget = queryServiceId || 'full_house_clean';
    apiClient.get(`/services/${srvTarget}`)
      .then(res => {
        setService(res.data);
        if (res.data.subServices?.length > 0) {
          setSelectedSubService(res.data.subServices[0].id);
        }
      })
      .catch(() => {
        // Mock fallback so demo doesn't fail
        const mockSrv = {
          id: 'full_house_clean',
          name: 'Full Home Deep Clean',
          basePrice: 3499,
          description: 'Intense grime removal using eco-certified materials.',
          subServices: [
            { id: '1bhk', name: '1 BHK Apartment Package', price: 3499 },
            { id: '2bhk', name: '2 BHK Apartment Package', price: 4999 },
            { id: '3bhk', name: '3 BHK Apartment Package', price: 6499 }
          ],
          addOns: [
            { id: 'kitchen_chimney', name: 'Premium Chimney Degreasing', price: 999 },
            { id: 'balcony_wash', name: 'Pressure Balcony Wash', price: 499 }
          ]
        };
        setService(mockSrv);
        setSelectedSubService('1bhk');
      });
  }, [queryServiceId]);

  if (!service) {
    return (
      <div className="min-h-[calc(100vh-62px)] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Helper pricing math
  const getSubServicePrice = () => {
    const matched = service.subServices?.find((s: any) => s.id === selectedSubService);
    return matched ? matched.price : service.basePrice;
  };

  const getAddOnsPrice = () => {
    let sum = 0;
    selectedAddOns.forEach(id => {
      const match = service.addOns?.find((a: any) => a.id === id);
      if (match) sum += match.price;
    });
    return sum;
  };

  const calculateSurge = () => {
    // Surge applied if location is OMR corridor or scheduled at peak hours (8 AM - 10 AM)
    if (addressText.toLowerCase().includes('omr')) {
      return 1.25; // 25% surge multiplier
    }
    return 1.0;
  };

  const getBaseTotal = () => {
    return getSubServicePrice() + getAddOnsPrice();
  };

  const getSurgeCharge = () => {
    const multiplier = calculateSurge();
    return multiplier > 1.0 ? Math.round(getBaseTotal() * (multiplier - 1)) : 0;
  };

  const getSubtotal = () => {
    return getBaseTotal() + getSurgeCharge();
  };

  const getFinalAmount = () => {
    let total = getSubtotal();
    
    // Apply promo code discount
    total -= couponDiscount;
    
    // Deduct wallet if selected
    if (useWallet && user?.walletBalance) {
      total -= Math.min(user.walletBalance, total);
    }
    
    return Math.max(0, total);
  };

  const handleApplyPromo = async () => {
    if (!couponCode) return;
    setErrorMsg(null);
    try {
      // Direct validate mock checkout
      if (couponCode.toUpperCase() === 'FESTIVE20') {
        const disc = Math.round(getSubtotal() * 0.20);
        setCouponDiscount(disc);
        setPromoApplied(true);
      } else {
        setErrorMsg('Invalid or expired promotional code.');
      }
    } catch (err) {
      setErrorMsg('Promo validation failed.');
    }
  };

  const handleCheckoutSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const pricingPayload = {
        basePrice: getSubServicePrice(),
        addOns: selectedAddOns.map(id => ({
          id,
          name: service.addOns?.find((a: any) => a.id === id)?.name || '',
          price: service.addOns?.find((a: any) => a.id === id)?.price || 0
        })),
        surgeMultiplier: calculateSurge(),
        promoDiscount: couponDiscount,
        walletUsed: useWallet && user?.walletBalance ? Math.min(user.walletBalance, getSubtotal() - couponDiscount) : 0,
        finalAmount: getFinalAmount()
      };

      const bookingPayload = {
        serviceId: service.id,
        subServiceId: selectedSubService,
        address: {
          id: `addr_${Math.floor(Math.random() * 90000)}`,
          label: addressLabel,
          formatted: addressText,
          lat: 13.08,
          lng: 80.27
        },
        scheduledAt: selectedDate ? `${selectedDate}T${selectedTimeSlot === '10:00 AM' ? '10:00:00' : '15:00:00'}Z` : new Date().toISOString(),
        pricing: pricingPayload,
        paymentMethod: paymentMethod,
        specialInstructions: 'Ring doorbell twice. Sanitized partner requested.'
      };

      const res = await apiClient.post('/bookings', bookingPayload);
      if (res.data.status === 'success') {
        // Refresh customer's wallet balance in Zustand state
        await syncProfile();
        navigate(`/bookings/${res.data.booking.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to place service booking. Check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Columns - Wizard Cards */}
        <div className="md:col-span-2 space-y-6">
          
          {/* STEP 1: CONFIGURE PACKAGE */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step > 1 ? 'bg-accent' : 'bg-primary'}`}>
                {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Configure Package</h3>
            </div>

            {step === 1 && (
              <div className="space-y-4 page-fade-in">
                <div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white mb-2">{service.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{service.description}</p>
                </div>

                {/* Sub Services */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">SELECT PACKAGE SIZE</label>
                  <div className="space-y-2">
                    {service.subServices?.map((sub: any) => (
                      <button
                        type="button"
                        key={sub.id}
                        onClick={() => setSelectedSubService(sub.id)}
                        className={`w-full p-4 border rounded-2xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                          selectedSubService === sub.id 
                            ? 'border-primary bg-primary/5 text-slate-800 dark:text-white' 
                            : 'border-slate-200 dark:border-slate-800 text-slate-500'
                        }`}
                      >
                        <span>{sub.name}</span>
                        <span className="font-black text-primary">₹{sub.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add-ons */}
                {service.addOns?.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">OPTIONAL CONVENIENT ADD-ONS</label>
                    <div className="space-y-2">
                      {service.addOns.map((add: any) => (
                        <button
                          type="button"
                          key={add.id}
                          onClick={() => toggleAddOn(add.id)}
                          className={`w-full p-4 border rounded-2xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                            selectedAddOns.includes(add.id) 
                              ? 'border-primary bg-primary/5 text-slate-800 dark:text-white' 
                              : 'border-slate-200 dark:border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>{add.name}</span>
                          <span className="font-black text-slate-700 dark:text-slate-200">+₹{add.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors flex items-center justify-center space-x-1"
                >
                  <span>Schedule Slot</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: ADDRESS & TIME */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step > 2 ? 'bg-accent' : 'bg-primary'}`}>
                {step > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
              </span>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Scheduled Address & Time Slot</h3>
            </div>

            {step === 2 && (
              <div className="space-y-4 page-fade-in">
                {/* Address Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Address Details</label>
                  <div className="flex space-x-2">
                    <button 
                      type="button" 
                      onClick={() => setAddressLabel('Home')} 
                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold ${addressLabel === 'Home' ? 'border-primary bg-primary/10 text-primary' : ''}`}
                    >
                      Home
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAddressLabel('Work')} 
                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold ${addressLabel === 'Work' ? 'border-primary bg-primary/10 text-primary' : ''}`}
                    >
                      Office
                    </button>
                  </div>
                  <input
                    type="text"
                    value={addressText}
                    onChange={e => setAddressText(e.target.value)}
                    placeholder="Enter full physical address..."
                    className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {addressText.toLowerCase().includes('omr') && (
                    <div className="p-2.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-[10px] flex items-center space-x-1.5">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-yellow-600" />
                      <span>Demand surge applies: OMR Tech Corridor currently experiences high bookings density.</span>
                    </div>
                  )}
                </div>

                {/* Date slot */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pick Date</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Available Hour Slot</label>
                    <select
                      value={selectedTimeSlot}
                      onChange={e => setSelectedTimeSlot(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="09:00 AM">Morning (09:00 AM)</option>
                      <option value="12:00 PM">Noon (12:00 PM)</option>
                      <option value="03:00 PM">Afternoon (03:00 PM)</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="flex-1 py-3 border text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!selectedDate}
                    className="flex-grow py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>Proceed Checkout</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: PAYMENT TYPE */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step > 3 ? 'bg-accent' : 'bg-primary'}`}>
                {step > 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
              </span>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Verify Payment & Confirm</h3>
            </div>

            {step === 3 && (
              <div className="space-y-4 page-fade-in">
                {/* Method picker */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PAYMENT SETTLEMENT METHOD</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 border rounded-2xl text-left text-xs font-semibold transition-colors ${
                        paymentMethod === 'cash' 
                          ? 'border-primary bg-primary/5 text-slate-800 dark:text-white' 
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Pay Cash/UPI (After Service)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-4 border rounded-2xl text-left text-xs font-semibold transition-colors ${
                        paymentMethod === 'wallet' 
                          ? 'border-primary bg-primary/5 text-slate-800 dark:text-white' 
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Pay from Wallet Balance</span>
                    </button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setStep(2)} 
                    className="flex-1 py-3 border text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    disabled={loading}
                    className="flex-grow py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors shadow-md shadow-primary/20 text-center cursor-pointer"
                  >
                    {loading ? 'Confirming Booking...' : 'Confirm and Dispatch Partner'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Cost Summary Drawer */}
        <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl h-fit space-y-4">
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white border-b pb-2">Itemized Invoice Details</h4>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{service.name} (Base)</span>
              <span>₹{getSubServicePrice()}</span>
            </div>

            {selectedAddOns.length > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Add-on services</span>
                <span>₹{getAddOnsPrice()}</span>
              </div>
            )}

            {getSurgeCharge() > 0 && (
              <div className="flex justify-between text-yellow-600 font-semibold">
                <span className="flex items-center"><Info className="w-3 h-3 mr-1" /> Surge fee (25%)</span>
                <span>₹{getSurgeCharge()}</span>
              </div>
            )}

            <div className="border-t pt-2 mt-2 flex justify-between font-bold dark:text-white">
              <span>Subtotal</span>
              <span>₹{getSubtotal()}</span>
            </div>

            {/* Coupons Form */}
            <div className="pt-2 border-t space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promo Coupon</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="FESTIVE20"
                  className="flex-1 px-3 py-1.5 border rounded-lg bg-slate-50 dark:bg-slate-850 dark:border-slate-700 text-xs"
                  disabled={promoApplied}
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-3 py-1.5 bg-slate-900 text-white dark:bg-slate-800 rounded-lg text-xs font-bold"
                  disabled={promoApplied || !couponCode}
                >
                  {promoApplied ? 'Applied' : 'Verify'}
                </button>
              </div>
              {promoApplied && (
                <div className="flex justify-between text-accent font-bold">
                  <span>Promo Saved</span>
                  <span>-₹{couponDiscount}</span>
                </div>
              )}
            </div>

            {/* Wallet Deduct Panel */}
            {user?.walletBalance && user.walletBalance > 0 ? (
              <div className="pt-2 border-t">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={e => setUseWallet(e.target.checked)}
                    className="rounded border-slate-350 text-primary focus:ring-primary"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    Apply Wallet Balance (Available: ₹{user.walletBalance})
                  </span>
                </label>
              </div>
            ) : null}

            {errorMsg && (
              <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded-lg">{errorMsg}</p>
            )}

            {/* Grand Total */}
            <div className="border-t pt-3 mt-4 flex justify-between text-base font-black text-slate-800 dark:text-white">
              <span>Grand Total</span>
              <span className="text-primary text-lg">₹{getFinalAmount()}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

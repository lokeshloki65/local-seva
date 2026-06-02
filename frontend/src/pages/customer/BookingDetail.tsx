import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { socketService } from '../../services/socket';
import { 
  Sparkles, FileText, Send, AlertTriangle, Star, CheckCircle, 
  MapPin, Clock, MessageSquare, Phone, RefreshCw, StarHalf
} from 'lucide-react';
import apiClient from '../../services/api';

export const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [booking, setBooking] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [loading, setLoading] = useState(true);

  // Chat States
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Review States
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Dispute States
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeLogged, setDisputeLogged] = useState(false);

  // Load Initial Booking Data
  const loadBooking = async () => {
    if (!id) return;
    try {
      const res = await apiClient.get(`/bookings/${id}`);
      setBooking(res.data);
      setChatHistory(res.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
    
    // Subscribe to live updates in booking room
    if (id) {
      socketService.joinRoom(`booking:${id}`);
    }

    // Set up Socket listeners
    const handleStatusUpdate = (data: any) => {
      if (data.bookingId === id) {
        setBooking((prev: any) => prev ? { ...prev, status: data.status } : null);
      }
    };

    const handleMessageReceived = (msg: any) => {
      setChatHistory(prev => [...prev, msg]);
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    socketService.socket?.on('booking:status_update', handleStatusUpdate);
    socketService.socket?.on('booking:message_received', handleMessageReceived);

    return () => {
      if (id) {
        socketService.leaveRoom(`booking:${id}`);
      }
      socketService.socket?.off('booking:status_update', handleStatusUpdate);
      socketService.socket?.off('booking:message_received', handleMessageReceived);
    };
  }, [id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeTab]);

  const handleSendChatMessage = () => {
    if (!chatMessage.trim() || !id || !user) return;
    socketService.emitChatMessage(id, user.uid, user.name, chatMessage);
    setChatMessage('');
  };

  const handleDownloadInvoice = () => {
    if (!id) return;
    window.open(`http://localhost:8000/api/v1/bookings/${id}/invoice`, '_blank');
  };

  const handleCancelBooking = async () => {
    if (!id) return;
    try {
      await apiClient.put(`/bookings/${id}/cancel`, { reason: 'Schedule conflicts' });
      loadBooking();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReview = async () => {
    if (!id) return;
    try {
      await apiClient.post(`/bookings/${id}/review`, {
        score: ratingScore,
        review: reviewText,
        tags: reviewTags,
        photos: []
      });
      setReviewSubmitted(true);
      loadBooking();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitDispute = async () => {
    if (!id || !disputeDesc) return;
    try {
      await apiClient.post(`/bookings/${id}/issue`, {
        description: disputeDesc,
        photoURL: ""
      });
      setDisputeLogged(true);
      setShowDisputeModal(false);
      loadBooking();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTag = (tag: string) => {
    setReviewTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (loading || !booking) {
    return (
      <div className="min-h-[calc(100vh-62px)] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Visual Helper: Timeline
  const steps = [
    { key: 'requested', label: 'Booked' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'en_route', label: 'Partner En Route' },
    { key: 'in_progress', label: 'Job Started' },
    { key: 'completed', label: 'Finished' }
  ];

  const getCurrentStepIndex = () => {
    const status = booking.status;
    if (status === 'cancelled') return -1;
    return steps.findIndex(s => s.key === status);
  };

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Chat */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Timeline tracking header */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                BOOKING ID: {booking.id}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {booking.status.toUpperCase()}
              </span>
            </div>

            {/* Stepper Widget */}
            {booking.status !== 'cancelled' && (
              <div className="flex items-center justify-between relative pt-3">
                <div className="absolute top-6 left-4 right-4 h-0.5 bg-slate-100 dark:bg-slate-800 z-0" />
                {steps.map((st, i) => {
                  const active = i <= getCurrentStepIndex();
                  return (
                    <div key={st.key} className="flex flex-col items-center z-10 relative">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        active 
                          ? 'border-primary bg-primary text-white shadow-md shadow-primary/20' 
                          : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
                      }`}>
                        {active ? <CheckCircle className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 mt-2 text-center">{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TABS SELECTOR */}
          <div className="flex border-b">
            <button 
              onClick={() => setActiveTab('details')}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-colors ${
                activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
              }`}
            >
              Service Progress Card
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-colors ${
                activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
              }`}
            >
              Chat with Partner
            </button>
          </div>

          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-6 page-fade-in">
              {/* Job Info */}
              <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
                <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Service Specifications</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">SERVICE OFFERING</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {booking.serviceId.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">PACKAGE SIZE</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{booking.subServiceId.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block mb-0.5">SLOT TIME</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {new Date(booking.scheduledAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block mb-0.5">LOCATION</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 block truncate w-32">
                        {booking.address.formatted}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verification Code Box (OTP) */}
                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                  <div className="p-4 bg-gradient-to-r from-primary/5 to-orange-500/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <h6 className="font-extrabold text-xs text-slate-800 dark:text-white">Completion PIN Verification</h6>
                      <p className="text-[10px] text-slate-400">Share this code with the partner ONLY when the job is fully done.</p>
                    </div>
                    <div className="px-4 py-2 border border-primary bg-white rounded-xl text-lg font-black text-primary tracking-widest shadow-md">
                      {booking.customerOTP}
                    </div>
                  </div>
                )}
              </div>

              {/* POST REVIEW BOX */}
              {booking.status === 'completed' && !reviewSubmitted && !booking.rating && (
                <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4 page-fade-in">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
                    <h4 className="font-extrabold text-sm dark:text-white">Rate the service & Earn 20 Loyalty Points</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="flex space-x-2 justify-center py-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          type="button" 
                          onClick={() => setRatingScore(star)}
                          className="p-1"
                        >
                          <Star className={`w-8 h-8 ${star <= ratingScore ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select tags</label>
                      <div className="flex flex-wrap gap-2">
                        {['Punctual', 'Clean work', 'Polite', 'Budget friendly', 'Quality gear'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold ${
                              reviewTags.includes(tag) ? 'border-primary bg-primary/10 text-primary' : 'text-slate-500'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed feedback</label>
                      <textarea
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        placeholder="Write something about the partner's cleanup and technique..."
                        className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={3}
                      />
                    </div>

                    <button
                      onClick={handleSubmitReview}
                      className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors shadow-md"
                    >
                      Submit Review & Claim Points
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE CHAT */}
          {activeTab === 'chat' && (
            <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm h-[400px] flex flex-col justify-between page-fade-in">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {chatHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">No messages logged yet. Begin conversation below!</p>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start space-x-2 ${msg.senderId === user?.uid ? 'flex-row-reverse space-x-reverse' : ''}`}
                    >
                      <div className={`max-w-[70%] px-3 py-2.5 rounded-2xl text-xs shadow-sm ${
                        msg.senderId === user?.uid 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                      }`}>
                        <span className="font-extrabold text-[9px] block text-white/80 mb-0.5">{msg.senderName}</span>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatScrollRef} />
              </div>

              <div className="pt-3 border-t flex items-center space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder="Type a message to the partner..."
                  className="flex-1 px-3 py-2 border rounded-xl text-xs bg-slate-50 dark:bg-slate-850 dark:border-slate-700 dark:text-white focus:outline-none"
                />
                <button 
                  onClick={handleSendChatMessage}
                  className="p-2 bg-primary text-white rounded-xl hover:bg-orange-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Worker Profile & Dispute Overrides */}
        <div className="space-y-6">
          {/* Worker partner card */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl text-center space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 text-left dark:text-white">Assigned Service Partner</h4>
            
            {booking.workerId ? (
              <div className="space-y-3">
                <div className="w-20 h-20 rounded-full border overflow-hidden bg-slate-100 mx-auto">
                  <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=worker" alt="Partner" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h5 className="font-extrabold text-base text-slate-800 dark:text-white">Mohamed Asif</h5>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest block">EXPERT PARTNER</span>
                </div>
                
                <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">4.85 rating</span>
                  <span>(120+ jobs)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <a href="tel:+919876543210" className="p-2 border rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 hover:bg-slate-50">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Call Partner</span>
                  </a>
                  <button 
                    onClick={handleDownloadInvoice}
                    className="p-2 border rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 hover:bg-slate-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Bill PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-6">
                <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Searching matching proximity partners within Chennai Core zone...</p>
              </div>
            )}
          </div>

          {/* Quality dispute button */}
          {booking.status !== 'cancelled' && (
            <div className="p-6 bg-slate-900 border rounded-3xl text-white space-y-3">
              <h5 className="font-extrabold text-sm flex items-center"><AlertTriangle className="w-4 h-4 mr-1 text-red-400" /> Need Support?</h5>
              <p className="text-[10px] text-slate-400">If your partner didn't arrive or you are unhappy with the quality of clean, report a dispute immediately for review.</p>
              
              {!disputeLogged ? (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
                >
                  Raise Dispute Issue
                </button>
              ) : (
                <div className="p-2 bg-red-950/20 text-red-400 rounded-xl text-xs text-center border border-red-900/30">
                  Dispute logged successfully. Support SLA: 2 hours.
                </div>
              )}
            </div>
          )}

          {/* Reschedule/Cancel triggers */}
          {booking.status === 'requested' || booking.status === 'confirmed' ? (
            <button 
              onClick={handleCancelBooking}
              className="w-full py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold"
            >
              Cancel Booking (Free Refund)
            </button>
          ) : null}
        </div>

      </div>

      {/* DISPUTE DIALOG MODAL */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-base dark:text-white">Report Quality or Arrival Issue</h4>
            <p className="text-xs text-slate-400">Please describe in detail what went wrong. Photos can be uploaded at audit stages.</p>
            
            <textarea
              value={disputeDesc}
              onChange={e => setDisputeDesc(e.target.value)}
              placeholder="Partner did not wipe the kitchen counters / left before cleaning was finished..."
              className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-slate-800 dark:text-white"
              rows={4}
            />

            <div className="flex space-x-2 pt-2">
              <button 
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 py-2 border rounded-xl text-xs font-bold"
              >
                Back
              </button>
              <button 
                onClick={handleSubmitDispute}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

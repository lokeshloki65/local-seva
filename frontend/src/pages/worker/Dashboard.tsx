import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { socketService } from '../../services/socket';
import { 
  Sparkles, Award, Wallet, Calendar, Check, X, MapPin, 
  Clock, ShieldCheck, TrendingUp, Compass, KeyRound
} from 'lucide-react';
import apiClient from '../../services/api';

export const WorkerDashboard: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [incomingJobs, setIncomingJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [completionOTP, setCompletionOTP] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      // 1. Fetch dashboard stats
      const statsRes = await apiClient.get('/worker/dashboard');
      setStats(statsRes.data);
      
      // If there is an active job, set it
      if (statsRes.data.nextJob) {
        setActiveJob(statsRes.data.nextJob);
      } else {
        setActiveJob(null);
      }

      // 2. Fetch incoming jobs queue
      const incomingRes = await apiClient.get('/worker/jobs/incoming');
      setIncomingJobs(incomingRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    
    // Set up Socket listeners for real-time job dispatch notifications
    if (user) {
      socketService.joinRoom(`worker:${user.uid}`);
    }

    const handleNewJobRequest = () => {
      loadDashboardData();
    };

    socketService.socket?.on('worker:new_job_request', handleNewJobRequest);

    return () => {
      if (user) {
        socketService.leaveRoom(`worker:${user.uid}`);
      }
      socketService.socket?.off('worker:new_job_request', handleNewJobRequest);
    };
  }, [user]);

  const handleToggleOnline = async () => {
    if (!user) return;
    const nextState = !user.isOnline;
    try {
      await apiClient.put('/worker/availability', { isOnline: nextState });
      updateUser({ isOnline: nextState });
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptJob = async (bookingId: string) => {
    try {
      await apiClient.post(`/worker/jobs/${bookingId}/accept`);
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineJob = async (bookingId: string) => {
    try {
      await apiClient.post(`/worker/jobs/${bookingId}/decline`);
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepStatusUpdate = async (bookingId: string, nextStatus: string) => {
    try {
      await apiClient.put(`/worker/jobs/${bookingId}/status`, { status: nextStatus });
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteJobSubmit = async () => {
    if (!activeJob || !completionOTP) return;
    setVerifyError(null);
    try {
      const res = await apiClient.put(`/bookings/${activeJob.id}/complete`, {
        otp: completionOTP,
        workerNotes: workerNotes,
        afterPhotos: []
      });
      if (res.data.status === 'success') {
        setShowVerifyModal(false);
        setCompletionOTP('');
        setWorkerNotes('');
        loadDashboardData();
      }
    } catch (err: any) {
      setVerifyError(err.response?.data?.detail || 'Incorrect OTP code validation.');
    }
  };

  if (loading || !stats) {
    return (
      <div className="min-h-[calc(100vh-62px)] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6 space-y-6">
      
      {/* 1. HEADER COCKPIT STATUS CARD */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-center md:text-left">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary flex items-center justify-center text-primary font-bold text-xl shadow-lg">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg">Partner Cockpit Dashboard</h3>
            <p className="text-xs text-slate-400">Level: <span className="font-extrabold text-primary">{stats.level}</span> | XP Balance: <span className="font-bold text-yellow-400">{stats.xpPoints} XP</span></p>
          </div>
        </div>

        {/* Availability Switch */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-300">Shift status:</span>
          <button
            onClick={handleToggleOnline}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-md ${
              user?.isOnline 
                ? 'bg-accent text-white shadow-accent/20' 
                : 'bg-red-500 text-white shadow-red-500/20'
            }`}
          >
            {user?.isOnline ? 'Online (Shift active)' : 'Offline (In-active)'}
          </button>
        </div>
      </div>

      {/* 2. STATS GRID WIDGETS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">TODAY'S INCOME</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">₹{stats.todayEarnings}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">JOBS DONE TODAY</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">{stats.todayJobsCompleted} jobs</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">STAR RATING</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">{stats.rating.toFixed(2)} ★</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">XP MULTIPLIER</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">1.0x Base</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Active & Incoming Jobs column */}
        <div className="md:col-span-2 space-y-6">
          
          {/* A. ACTIVE JOB TIMELINE */}
          {activeJob ? (
            <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-md space-y-4 page-fade-in">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                  <h4 className="font-extrabold text-sm dark:text-white">Current Active Job (In Progress)</h4>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase">ID: {activeJob.id}</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-xs">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-slate-400 block mb-0.5">CUSTOMER ADDRESS</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{activeJob.address.formatted}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Status switches */}
                  {activeJob.status === 'confirmed' && (
                    <button
                      onClick={() => handleStepStatusUpdate(activeJob.id, 'en_route')}
                      className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer text-center"
                    >
                      Mark: Travel En Route
                    </button>
                  )}
                  {activeJob.status === 'en_route' && (
                    <button
                      onClick={() => handleStepStatusUpdate(activeJob.id, 'in_progress')}
                      className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors cursor-pointer text-center"
                    >
                      Mark: Arrived & Started
                    </button>
                  )}
                  {activeJob.status === 'in_progress' && (
                    <button
                      onClick={() => setShowVerifyModal(true)}
                      className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Complete Job (Verify PIN)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white dark:bg-slate-900 border rounded-3xl text-center text-slate-400">
              <Compass className="w-8 h-8 mx-auto text-slate-300 animate-spin" />
              <p className="text-xs mt-2">Waiting for next active dispatch slot to trigger...</p>
            </div>
          )}

          {/* B. DISPATCH TICKETS QUEUE */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Incoming Job Dispatch Tickets
            </h3>

            {incomingJobs.length === 0 ? (
              <p className="text-xs text-slate-400 bg-white p-6 border rounded-3xl text-center">
                No tickets in pending queue. Toggle online status to stream matches.
              </p>
            ) : (
              incomingJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4 page-fade-in"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-black text-primary">
                      {job.serviceId.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">EST: {job.pricing.basePrice} INR</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Customer is located at {job.address.formatted}. Slot: {new Date(job.scheduledAt).toLocaleTimeString()}.
                  </p>

                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={() => handleDeclineJob(job.id)}
                      className="flex-1 py-2 border rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 flex items-center justify-center space-x-1"
                    >
                      <X className="w-4 h-4" />
                      <span>Decline</span>
                    </button>
                    <button
                      onClick={() => handleAcceptJob(job.id)}
                      className="flex-grow py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 flex items-center justify-center space-x-1"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept Ticket (+5 XP)</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Achievements & Streak Cards */}
        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Active Achievements & Streaks</h4>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-yellow-100 rounded-xl">
                  <Sparkles className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-slate-800 dark:text-white">Perfect Attendance Badge</h6>
                  <p className="text-[9px] text-slate-400">Complete 5 jobs consecutively without any declines.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-slate-800 dark:text-white">Loyalty Legend</h6>
                  <p className="text-[9px] text-slate-400">Maintained above 4.8 star metrics over 30 cycles.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* COMPLETION PIN VERIFICATION DIALOG */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-base dark:text-white">Enter Customer Completion PIN</h4>
            <p className="text-xs text-slate-400">Ask the customer for the 4-digit code displayed on their active booking progress screen to authorize job closure.</p>
            
            {verifyError && (
              <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded-lg">{verifyError}</p>
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={completionOTP}
                onChange={e => setCompletionOTP(e.target.value)}
                placeholder="4-Digit PIN Code"
                maxLength={4}
                className="w-full px-4 py-3 border rounded-xl text-center text-lg font-black tracking-widest focus:outline-none"
              />
              <textarea
                value={workerNotes}
                onChange={e => setWorkerNotes(e.target.value)}
                placeholder="Write any partner execution notes..."
                className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-slate-850"
                rows={3}
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button 
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 py-2 border rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleCompleteJobSubmit}
                className="flex-grow py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600"
              >
                Verify & Complete (+50 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

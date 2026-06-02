import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { 
  Sparkles, TrendingUp, Calendar, Users, Hammer, MapPin, 
  Send, AlertTriangle, ShieldCheck, RefreshCw, Star, Ban 
} from 'lucide-react';
import apiClient from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reassign States
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [targetWorkerId, setTargetWorkerId] = useState('');

  // Wallet adjustment States
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [adjustCustomerId, setAdjustCustomerId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(100);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('Customer Care Goodwill credit');

  // Push Broadcast states
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'workers' | 'customers'>('all');
  const [broadcastLogged, setBroadcastLogged] = useState(false);

  const loadAdminData = async () => {
    try {
      // 1. Fetch dashboard metrics
      const statsRes = await apiClient.get('/admin/dashboard/stats');
      setStats(statsRes.data);

      // 2. Fetch all bookings
      const bookingsRes = await apiClient.get('/admin/bookings');
      setBookings(bookingsRes.data);

      // 3. Fetch workers
      const workersRes = await apiClient.get('/admin/workers');
      setWorkers(workersRes.data);

      // 4. Fetch customers
      const customersRes = await apiClient.get('/admin/customers');
      setCustomers(customersRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleApproveWorker = async (workerId: string) => {
    try {
      await apiClient.put(`/admin/workers/${workerId}/approve`);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuspendWorker = async (workerId: string) => {
    try {
      await apiClient.put(`/admin/workers/${workerId}/suspend`);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanCustomer = async (customerId: string) => {
    try {
      await apiClient.put(`/admin/customers/${customerId}/ban`);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassignWorkerSubmit = async () => {
    if (!selectedBookingId || !targetWorkerId) return;
    try {
      await apiClient.put(`/admin/bookings/${selectedBookingId}/assign-worker`, {
        workerId: targetWorkerId
      });
      setShowReassignModal(false);
      setSelectedBookingId(null);
      setTargetWorkerId('');
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustWalletSubmit = async () => {
    if (!adjustCustomerId) return;
    try {
      await apiClient.put(`/admin/customers/${adjustCustomerId}/wallet`, {
        amount: adjustAmount,
        type: adjustType,
        reason: adjustReason
      });
      setShowWalletModal(false);
      setAdjustCustomerId(null);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcastPushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastBody) return;
    try {
      await apiClient.post('/admin/broadcast', {
        title: broadcastTitle,
        body: broadcastBody,
        targetGroup: broadcastTarget
      });
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastLogged(true);
      setTimeout(() => setBroadcastLogged(false), 3000);
    } catch (err) {
      console.error(err);
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
      
      {/* 1. HEADER TITLE */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">Global Command Control Center</h2>
          <p className="text-xs text-slate-400">ServaLocal Operations Command console</p>
        </div>
        <button 
          onClick={loadAdminData}
          className="p-2 border bg-white rounded-xl shadow-sm hover:bg-slate-50 text-slate-500"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 2. STATS KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">DAILY GMV VOLUMES</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">₹{stats.todayGMV}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">COMMISSION NET REVENUE</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">₹{stats.platformRevenueToday}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ONLINE WORKERS NOW</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">{stats.activeOnlineWorkers} partners</h4>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm text-center space-y-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">TOTAL REGISTERED USERS</span>
          <h4 className="text-lg font-black text-slate-800 dark:text-white">{stats.totalRegisteredCustomers} clients</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time bookings list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BOOKINGS TABLE */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm border-b pb-2 dark:text-white">Live Bookings Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b text-slate-400">
                    <th className="pb-2">Booking Code</th>
                    <th className="pb-2">Service</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{bk.id}</td>
                      <td className="py-2.5">{bk.serviceId.replace('_', ' ').toUpperCase()}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700">
                          {bk.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5">₹{bk.pricing.finalAmount}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => { setSelectedBookingId(bk.id); setShowReassignModal(true); }}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold"
                        >
                          Manual Reassign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* VETTING QUEUE */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm border-b pb-2 dark:text-white">Workforce Vetting and Verification</h3>
            <div className="space-y-3">
              {workers.filter(w => !w.isApproved).map(w => (
                <div key={w.uid} className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{w.name}</p>
                    <p className="text-[10px] text-slate-400">Applied Skills: {w.skills?.join(', ')}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleApproveWorker(w.uid)}
                      className="px-3 py-1 bg-accent text-white rounded-lg font-bold"
                    >
                      Approve Partner
                    </button>
                  </div>
                </div>
              ))}
              {workers.filter(w => !w.isApproved).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No worker applications pending vetting.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: push broadcasts & customer profiles */}
        <div className="space-y-6">
          
          {/* PUSH BROADCAST */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">FCM Push topic Broadcaster</h4>
            
            {broadcastLogged && (
              <p className="p-2.5 bg-green-50 text-green-700 rounded-xl text-[10px]">Administrative Broadcast sent successfully!</p>
            )}

            <form onSubmit={handleBroadcastPushSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Broadcast Target</label>
                <select
                  value={broadcastTarget}
                  onChange={e => setBroadcastTarget(e.target.value as any)}
                  className="w-full px-3 py-1.5 border rounded-xl text-xs dark:bg-slate-800"
                >
                  <option value="all">Broad target (All users)</option>
                  <option value="workers">Worker partners only</option>
                  <option value="customers">Customers only</option>
                </select>
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Notification Header Alert"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-xl text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <textarea
                  placeholder="Dispatched warning details / promotional codes details..."
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-xl text-xs"
                  rows={3}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:bg-orange-600 transition-colors"
              >
                Send FCM Broadcast
              </button>
            </form>
          </div>

          {/* CUSTOMER WALLET ADJUSTMENTS */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Customer registry</h4>
            <div className="max-h-60 overflow-y-auto space-y-3">
              {customers.map(cust => (
                <div key={cust.uid} className="flex items-center justify-between border-b pb-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">{cust.name}</span>
                    <span className="text-[10px] text-slate-400 block">Bal: ₹{cust.walletBalance?.toFixed(2)}</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => { setAdjustCustomerId(cust.uid); setShowWalletModal(true); }}
                      className="px-2 py-0.5 bg-slate-100 text-slate-800 hover:bg-primary/10 rounded font-bold text-[10px]"
                    >
                      Adj
                    </button>
                    <button
                      onClick={() => handleBanCustomer(cust.uid)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* REASSIGN OVERRIDE DIALOG */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-base dark:text-white font-black">Manual Assignment override</h4>
            <p className="text-xs text-slate-400">Specify target worker ID below to assign. All background logic transitions instantly.</p>
            
            <select
              value={targetWorkerId}
              onChange={e => setTargetWorkerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-slate-800"
            >
              <option value="">Select qualified partner</option>
              {workers.filter(w => w.isApproved).map(w => (
                <option key={w.uid} value={w.uid}>{w.name} (★{w.rating})</option>
              ))}
            </select>

            <div className="flex space-x-2 pt-2">
              <button 
                onClick={() => { setShowReassignModal(false); setSelectedBookingId(null); }}
                className="flex-1 py-2 border rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleReassignWorkerSubmit}
                disabled={!targetWorkerId}
                className="flex-grow py-2 bg-primary text-white rounded-xl text-xs font-bold"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLET ADJUSTMENT DIALOG */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-base dark:text-white font-black">Adjust Customer Wallet Balance</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setAdjustType('credit')} 
                className={`py-1.5 rounded-lg border text-xs font-bold ${adjustType === 'credit' ? 'border-primary bg-primary/10 text-primary' : ''}`}
              >
                Credit (Add)
              </button>
              <button 
                onClick={() => setAdjustType('debit')} 
                className={`py-1.5 rounded-lg border text-xs font-bold ${adjustType === 'debit' ? 'border-primary bg-primary/10 text-primary' : ''}`}
              >
                Debit (Deduct)
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="number"
                value={adjustAmount}
                onChange={e => setAdjustAmount(Number(e.target.value))}
                placeholder="Adjust Amount (INR)"
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
              <input
                type="text"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Goodwill reimbursement..."
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button 
                onClick={() => { setShowWalletModal(false); setAdjustCustomerId(null); }}
                className="flex-1 py-2 border rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdjustWalletSubmit}
                className="flex-grow py-2 bg-primary text-white rounded-xl text-xs font-bold"
              >
                Apply Wallet Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

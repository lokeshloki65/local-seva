import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Wallet, Sparkles, Send, Landmark, ArrowRightLeft, CreditCard } from 'lucide-react';
import apiClient from '../../services/api';

export const WalletPage: React.FC = () => {
  const { user, syncProfile } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Topup States
  const [topupAmount, setTopupAmount] = useState(500);
  const [topupLoading, setTopupLoading] = useState(false);

  // Loyalty states
  const [redeeming, setRedeeming] = useState(false);
  const [loyaltyMessage, setLoyaltyMessage] = useState<string | null>(null);

  const fetchWalletData = async () => {
    try {
      // Refresh user profile for balances
      await syncProfile();
      
      // Fetch user's transaction ledger history
      const txRes = await apiClient.get('/users/me/transactions');
      setTransactions(txRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topupAmount <= 0) return;
    
    setTopupLoading(true);
    try {
      // Admin API simulation adjusts user wallet balance atomically
      await apiClient.put(`/admin/customers/${user?.uid}/wallet`, {
        amount: topupAmount,
        type: 'credit',
        reason: 'Client standard credit topup purchase'
      });
      setTopupAmount(500);
      fetchWalletData();
    } catch (err) {
      console.error(err);
    } finally {
      setTopupLoading(false);
    }
  };

  const handleRedeemLoyalty = async () => {
    if (!user || (user.loyaltyPoints || 0) < 100) return;
    setRedeeming(true);
    setLoyaltyMessage(null);
    try {
      const res = await apiClient.post('/users/me/loyalty-points/redeem');
      if (res.data.status === 'success') {
        setLoyaltyMessage(`Successfully redeemed! +₹${res.data.redeemedAmount} added to balance.`);
        fetchWalletData();
      }
    } catch (err: any) {
      setLoyaltyMessage(err.response?.data?.detail || 'Loyalty redemption aborted.');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-62px)] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6 space-y-6">
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Columns - Balances & Topup */}
        <div className="md:col-span-2 space-y-6">
          
          {/* WALLET BALANCE HEADER CARD */}
          <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between h-44">
            <div className="absolute top-0 right-0 w-44 h-44 bg-primary/20 rounded-full blur-2xl z-0" />
            
            <div className="flex items-center justify-between z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                SERVALOCAL SECURE WALLET
              </span>
              <Wallet className="w-6 h-6 text-primary animate-pulse" />
            </div>

            <div className="z-10">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">AVAILABLE BALANCE</span>
              <h2 className="text-3xl font-black tracking-tight leading-none text-white">
                ₹{user?.walletBalance?.toFixed(2) || '0.00'}
              </h2>
            </div>
          </div>

          {/* SIMULATED PAYMENT TOPUP FORM */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Replenish Wallet Balance</h4>
            <form onSubmit={handleTopupSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOP-UP AMOUNT (INR)</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={e => setTopupAmount(Number(e.target.value))}
                    placeholder="500"
                    min={100}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={topupLoading}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors"
              >
                {topupLoading ? 'Processing Top-up...' : 'Purchase Wallet Credits'}
              </button>
            </form>
          </div>

          {/* TRANSACTION LEDGER TABLE */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Chronological Ledger Statements</h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b text-slate-400">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                        {tx.description}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          tx.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className={`py-2.5 text-right font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-450">No ledger transactions logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column - Loyalty point redemptions */}
        <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl h-fit space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-bounce" />
            <h4 className="font-extrabold text-sm dark:text-white">Loyalty Coin Hub</h4>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-slate-500">
            <p>Earn loyalty points automatically for completing slot checkouts and ratings! Redeeming converts points into spendable wallet cash.</p>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl text-center space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">YOUR COIN BALANCE</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white">{user?.loyaltyPoints || 0} Points</span>
            </div>

            {loyaltyMessage && (
              <p className="p-2 bg-green-50 text-green-700 rounded-xl text-[10px]">{loyaltyMessage}</p>
            )}

            <button
              onClick={handleRedeemLoyalty}
              disabled={redeeming || (user?.loyaltyPoints || 0) < 100}
              className="w-full py-2.5 bg-primary disabled:bg-slate-100 disabled:text-slate-450 text-white rounded-xl font-bold transition-all text-xs"
            >
              {redeeming ? 'Redeeming...' : 'Convert: 100 points -> ₹10 Cash'}
            </button>
            <span className="text-[10px] text-slate-400 text-center block">Minimum 100 loyalty points required.</span>
          </div>
        </div>

      </div>
    </div>
  );
};

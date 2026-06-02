import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import apiClient from '../../services/api';

export const BookingsList: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const res = await apiClient.get('/users/me/bookings');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-62px)] flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">Your Service Bookings</h2>
          <p className="text-xs text-slate-400">Chronological history of dispatches</p>
        </div>
        <button 
          onClick={fetchBookings}
          className="p-2 border bg-white rounded-xl shadow-sm text-slate-500 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {bookings.length === 0 ? (
          <div className="p-8 text-center bg-white border rounded-3xl text-slate-400">
            <Calendar className="w-8 h-8 mx-auto text-slate-350" />
            <p className="text-xs mt-2">You haven't requested any home services yet!</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md"
            >
              Discover Services
            </button>
          </div>
        ) : (
          bookings.map((bk) => (
            <div 
              key={bk.id} 
              className="p-5 bg-white dark:bg-slate-900 dark:border-slate-800 border rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 page-fade-in"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    ID: {bk.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    bk.status === 'completed' ? 'bg-green-100 text-green-800' :
                    bk.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {bk.status.toUpperCase()}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">
                  {bk.serviceId.replace('_', ' ').toUpperCase()} ({bk.subServiceId})
                </h4>
                <p className="text-[10px] text-slate-400">
                  Scheduled for {new Date(bk.scheduledAt).toLocaleDateString()} at {bk.address.label}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-4">
                <span className="text-sm font-black text-primary">₹{bk.pricing.finalAmount}</span>
                <button
                  onClick={() => navigate(`/bookings/${bk.id}`)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold flex items-center space-x-1 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>Track Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

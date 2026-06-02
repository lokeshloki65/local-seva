import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, Wallet, LogOut, Globe, User, Shield } from 'lucide-react';
import apiClient from '../../services/api';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    // Set theme HTML class on load
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch unread notifications if authenticated
  useEffect(() => {
    if (user) {
      apiClient.get('/users/me/notifications')
        .then(res => setNotifications(res.data.filter((n: any) => !n.read)))
        .catch(err => console.error(err));
    }
  }, [user]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLanguageChange = (lang: string) => {
    if (user) {
      apiClient.put('/users/me', { preferredLanguage: lang })
        .then(() => {
          window.location.reload();
        });
    }
    setLangOpen(false);
  };

  const handleMarkAllRead = () => {
    apiClient.put('/users/me/notifications/read-all')
      .then(() => setNotifications([]))
      .catch(err => console.error(err));
    setShowNotifications(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-b shadow-sm px-4 md:px-8 py-3 flex items-center justify-between">
      {/* 1. BRAND LOGO */}
      <div className="flex items-center space-x-3">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-white font-extrabold text-lg">S</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-800 dark:text-white">
            Serva<span className="text-primary">Local</span>
          </span>
        </Link>
        {user?.role === 'admin' && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Shield className="w-3.5 h-3.5 mr-1" /> Control
          </span>
        )}
      </div>

      {/* 2. ACTIONS ROW */}
      <div className="flex items-center space-x-4">
        {/* A. CUSTOMER WALLET BADGE */}
        {user?.role === 'customer' && (
          <Link 
            to="/wallet" 
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 transition-colors cursor-pointer group"
          >
            <Wallet className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ₹{user.walletBalance?.toFixed(2) || '0.00'}
            </span>
          </Link>
        )}

        {/* B. MULTILINGUAL SELECTOR */}
        <div className="relative">
          <button 
            onClick={() => setLangOpen(!langOpen)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <Globe className="w-5 h-5" />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-2 w-36 rounded-xl border bg-white dark:bg-slate-900 shadow-xl overflow-hidden py-1">
              <button onClick={() => handleLanguageChange('en')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-white">English (EN)</button>
              <button onClick={() => handleLanguageChange('ta')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-white">தமிழ் (TA)</button>
              <button onClick={() => handleLanguageChange('hi')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-white">हिन्दी (HI)</button>
            </div>
          )}
        </div>

        {/* C. DARK/LIGHT MODE */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all duration-300 transform active:rotate-45"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-400" />}
        </button>

        {/* D. NOTIFICATION INBOX */}
        {user && (
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950 animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border bg-white dark:bg-slate-900 shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h4 className="font-extrabold text-sm dark:text-white">Notifications</h4>
                  {notifications.length > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-primary font-bold hover:underline">
                      Mark read
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No unread alerts.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                        <p className="text-slate-500 dark:text-slate-400">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* E. USER AVATAR / LOGOUT */}
        {user ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full border overflow-hidden bg-slate-200 cursor-pointer" onClick={() => navigate('/profile')}>
              <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
            </div>
            <button 
              onClick={() => { logout(); navigate('/login'); }}
              className="hidden md:flex p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <Link to="/login" className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-extrabold hover:bg-orange-600 transition-colors shadow-md shadow-primary/10">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, Lock, Phone, KeyRound, Sparkles, AlertCircle } from 'lucide-react';
import apiClient from '../../services/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const loginStore = useAuthStore();

  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Phone OTP States
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/auth/email/login', { email, password });
      if (res.data.status === 'success') {
        const payload = res.data;
        loginStore.login(
          payload.uid,
          payload.user.email,
          payload.token,
          payload.role,
          payload.user
        );
        redirectUser(payload.role);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phone) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/auth/phone/send-otp', { phone });
      if (res.data.status === 'success') {
        setOtpSent(true);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to dispatch verification SMS.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!phone || !otp) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/auth/phone/verify-otp', { phone, otp });
      if (res.data.status === 'success') {
        const payload = res.data;
        loginStore.login(
          payload.uid,
          payload.user.email || '',
          `mock_phone_token_for_${payload.uid}`,
          payload.role,
          payload.user
        );
        redirectUser(payload.role);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Incorrect OTP code verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Simulate Google OAuth response
      const mockGoogleUid = `google_usr_${Math.floor(Math.random() * 900000) + 100000}`;
      const res = await apiClient.post('/auth/google', {
        uid: mockGoogleUid,
        email: 'googleuser@gmail.com',
        name: 'Google User',
        photoURL: `https://api.dicebear.com/7.x/miniavs/svg?seed=${mockGoogleUid}`
      });

      if (res.data.status === 'success') {
        const payload = res.data;
        loginStore.login(
          payload.user.uid,
          payload.user.email,
          `google_bearer_token_${payload.user.uid}`,
          payload.user.role,
          payload.user
        );
        redirectUser(payload.user.role);
      }
    } catch (err: any) {
      setErrorMsg('Google Signin aborted.');
    } finally {
      setLoading(false);
    }
  };

  const redirectUser = (role: string) => {
    if (role === 'admin' || role === 'superadmin') {
      navigate('/admin');
    } else if (role === 'worker') {
      navigate('/worker');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-[calc(100vh-62px)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />

        {/* 1. PORTAL BRAND */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
            <span className="text-white font-extrabold text-xl">S</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">
            Welcome back to ServaLocal
          </h3>
          <p className="text-xs text-slate-400">Smart local home services at your doorstep</p>
        </div>

        {/* 2. ERROR DISPLAY */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 border border-red-200 dark:border-red-900/30 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. TABS HEADER */}
        <div className="flex border-b mb-6">
          <button 
            onClick={() => { setActiveTab('email'); setErrorMsg(null); }}
            className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'email' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
            }`}
          >
            Email Login
          </button>
          <button 
            onClick={() => { setActiveTab('phone'); setErrorMsg(null); }}
            className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'phone' ? 'border-primary text-primary' : 'border-transparent text-slate-400'
            }`}
          >
            OTP Verification
          </button>
        </div>

        {/* 4. EMAIL SIGNIN FORM */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Security Password</label>
                <a href="#" className="text-[10px] text-primary font-bold hover:underline">Forgot?</a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors cursor-pointer text-center"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* 5. PHONE OTP SIGNIN FORM */}
        {activeTab === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Phone number (with Country code)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={otpSent}
                />
              </div>
            </div>

            {otpSent && (
              <div className="space-y-1 page-fade-in">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">6-Digit Verification OTP</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {!otpSent ? (
              <button
                onClick={handleSendOTP}
                disabled={loading || !phone}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors cursor-pointer text-center"
              >
                {loading ? 'Sending Code...' : 'Request SMS OTP'}
              </button>
            ) : (
              <button
                onClick={handleVerifyOTP}
                disabled={loading || !otp}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors cursor-pointer text-center"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            )}
          </div>
        )}

        {/* 6. GOOGLE OAUTH ALTERNATIVE */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">OR</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Quick Google OAuth Sign-in</span>
        </button>

        {/* 7. REGISTRATION LINK */}
        <p className="text-center text-xs text-slate-400 mt-6">
          New to ServaLocal?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Register Partner/Client
          </Link>
        </p>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, Lock, Phone, User, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';
import apiClient from '../../services/api';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const loginStore = useAuthStore();

  const [role, setRole] = useState<'customer' | 'worker'>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Worker Specific onboarding variables
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const skillsList = [
    { id: 'full_house_clean', name: 'Deep Cleaning' },
    { id: 'tap_repair', name: 'Plumbing Service' },
    { id: 'switchboard_fix', name: 'Electrical Work' },
    { id: 'ac_servicing', name: 'AC & Appliance Repair' }
  ];

  const zonesList = [
    { id: 'chennai_core', name: 'Chennai Central Core' },
    { id: 'omr_highway', name: 'OMR Tech Corridor' },
    { id: 'madurai_central', name: 'Madurai Heritage Zone' }
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !phone) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        name,
        email,
        phone,
        password,
        role
      };

      const res = await apiClient.post('/auth/email/register', payload);
      
      if (res.data.status === 'success') {
        const userUid = res.data.uid;
        
        // If worker, submit extra onboarding details
        if (role === 'worker') {
          await apiClient.put('/users/me', {
            skills: selectedSkills,
            serviceZones: selectedZones,
            bankDetails: {
              accountNumber: '123456789012',
              ifscCode: 'HDFC0000001',
              bankName: 'HDFC Bank',
              upiId: `${phone}@okhdfc`
            }
          }, {
            headers: {
              Authorization: `Bearer mock_bearer_token_for_${userUid}`
            }
          });
        }

        // Auto login
        loginStore.login(
          userUid,
          email,
          `mock_bearer_token_for_${userUid}`,
          role,
          res.data.user
        );

        if (role === 'worker') {
          navigate('/worker');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Onboarding registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (id: string) => {
    setSelectedSkills(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleZone = (id: string) => {
    setSelectedZones(prev => 
      prev.includes(id) ? prev.filter(z => z !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-[calc(100vh-62px)] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />

        {/* 1. BRAND PORTAL */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">
            Create ServaLocal Profile
          </h3>
          <p className="text-xs text-slate-400">Join our growing ecosystem as a customer or partner</p>
        </div>

        {/* 2. ERROR CARD */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 border border-red-200 dark:border-red-900/30 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. ROLE SELECTOR */}
        <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              role === 'customer' 
                ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            I need services (Customer)
          </button>
          <button
            type="button"
            onClick={() => setRole('worker')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              role === 'worker' 
                ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            I want to work (Partner)
          </button>
        </div>

        {/* 4. ONBOARDING FORM */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Lokesh Kumar"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mobile Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="lokesh@domain.in"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password (Min 6 chars)</label>
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
          </div>

          {/* WORKER SKILL & ZONE SELECTION */}
          {role === 'worker' && (
            <div className="space-y-4 pt-3 border-t page-fade-in">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Select Your Skills
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {skillsList.map(skill => (
                    <button
                      type="button"
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-2.5 border rounded-xl text-left text-xs font-semibold transition-all ${
                        selectedSkills.includes(skill.id)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Select Your Operational Zones
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {zonesList.map(zone => (
                    <button
                      type="button"
                      key={zone.id}
                      onClick={() => toggleZone(zone.id)}
                      className={`p-2.5 border rounded-xl text-left text-xs font-semibold transition-all ${
                        selectedZones.includes(zone.id)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      {zone.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/30 text-[10px] text-blue-700 dark:text-blue-300 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>By submitting, you consent to our automated background review process (Standard 48-hour SLAs).</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-orange-600 transition-colors cursor-pointer text-center"
          >
            {loading ? 'Creating Account...' : 'Complete & Launch Platform'}
          </button>
        </form>

        {/* REGISTRATION LINK */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

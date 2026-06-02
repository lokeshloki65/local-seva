import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { User, Globe, MapPin, Plus, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import apiClient from '../../services/api';

export const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [lang, setLang] = useState(user?.preferredLanguage || 'en');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Address States
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddressText, setNewAddressText] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await apiClient.put('/users/me', {
        name,
        preferredLanguage: lang
      });
      if (res.data.status === 'success') {
        updateUser({ name, preferredLanguage: lang });
        setSaveMessage('Profile changes successfully updated.');
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressText) return;

    setAddressLoading(true);
    try {
      const newAddress = {
        id: `addr_${Math.floor(Math.random() * 90000)}`,
        label: newLabel,
        formatted: newAddressText,
        lat: 13.08,
        lng: 80.27
      };

      const updatedAddresses = [...(user?.savedAddresses || []), newAddress];

      const res = await apiClient.put('/users/me', {
        savedAddresses: updatedAddresses
      });

      if (res.data.status === 'success') {
        updateUser({ savedAddresses: updatedAddresses });
        setNewAddressText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const updatedAddresses = (user?.savedAddresses || []).filter(a => a.id !== id);
    try {
      const res = await apiClient.put('/users/me', {
        savedAddresses: updatedAddresses
      });
      if (res.data.status === 'success') {
        updateUser({ savedAddresses: updatedAddresses });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950 px-4 md:px-8 py-6 space-y-6">
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Columns - Form Configurations */}
        <div className="md:col-span-2 space-y-6">
          
          {/* PROFILE CARD */}
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
            <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Profile Configurations</h4>
            
            {saveMessage && (
              <p className="p-2.5 bg-green-50 text-green-700 rounded-xl text-[10px]">{saveMessage}</p>
            )}

            <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Preferred Language</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <select
                    value={lang}
                    onChange={e => setLang(e.target.value as any)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-slate-800"
                  >
                    <option value="en">English (EN)</option>
                    <option value="ta">தமிழ் (TA)</option>
                    <option value="hi">हिन्दी (HI)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors"
              >
                {saving ? 'Saving changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* SAVED ADDRESSES MANAGMENT */}
          {user?.role === 'customer' && (
            <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm border-b pb-2 dark:text-white">Saved Dispatch Coordinates</h4>
              
              <div className="space-y-3">
                {user.savedAddresses?.map((addr) => (
                  <div key={addr.id} className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white">{addr.label}</span>
                      <p className="text-[10px] text-slate-450 truncate w-64">{addr.formatted}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add Address Form */}
                <form onSubmit={handleAddAddress} className="pt-2 border-t space-y-2">
                  <div className="flex space-x-2">
                    <button 
                      type="button" 
                      onClick={() => setNewLabel('Home')} 
                      className={`px-3 py-1 border rounded-lg text-[10px] font-bold ${newLabel === 'Home' ? 'border-primary bg-primary/10 text-primary' : ''}`}
                    >
                      Home
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewLabel('Work')} 
                      className={`px-3 py-1 border rounded-lg text-[10px] font-bold ${newLabel === 'Work' ? 'border-primary bg-primary/10 text-primary' : ''}`}
                    >
                      Work
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add new physical coordinate formatted..."
                      value={newAddressText}
                      onChange={e => setNewAddressText(e.target.value)}
                      className="flex-grow px-3 py-2 border rounded-xl text-xs"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={addressLoading}
                      className="p-2.5 bg-primary text-white rounded-xl"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>

        {/* Right Column - User actions & Session metadata */}
        <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl h-fit space-y-4 text-center">
          <div className="w-20 h-20 rounded-full border overflow-hidden mx-auto bg-slate-100">
            <img src={user?.photoURL} alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div>
            <h5 className="font-extrabold text-base text-slate-800 dark:text-white">{user?.name}</h5>
            <span className="text-[10px] text-slate-400 block">{user?.email}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Account Type</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{user?.role.toUpperCase()}</span>
            </div>
            {user?.role === 'customer' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Subscription Tier</span>
                <span className="font-bold text-primary">{user.subscriptionPlan}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
          >
            Logout session
          </button>
        </div>

      </div>
    </div>
  );
};

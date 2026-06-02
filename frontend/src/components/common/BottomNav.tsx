import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Home, Calendar, MessageSquareCode, User, Briefcase, CalendarDays, WalletCards, Award } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  // 1. CUSTOMER NAVIGATION LIST
  const customerTabs = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/bookings', label: 'Bookings', icon: Calendar },
    { to: '/wallet', label: 'Wallet', icon: WalletCards },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  // 2. WORKER NAVIGATION LIST
  const workerTabs = [
    { to: '/worker', label: 'Dashboard', icon: Home },
    { to: '/worker/jobs', label: 'My Jobs', icon: Briefcase },
    { to: '/worker/schedule', label: 'Shift Hours', icon: CalendarDays },
    { to: '/worker/earnings', label: 'Earnings', icon: WalletCards },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const tabs = user.role === 'worker' ? workerTabs : customerTabs;

  return (
    <div className="md:hidden fixed bottom-0 left-0 z-40 w-full h-16 bg-white/95 dark:bg-slate-950/95 border-t backdrop-blur-md flex items-center justify-around px-2 shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/' || tab.to === '/worker'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

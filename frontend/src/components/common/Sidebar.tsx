import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Hammer, MapPin, Receipt, Settings, FileText } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const links = [
    { to: '/admin', label: 'Analytics Panel', icon: LayoutDashboard },
    { to: '/admin/bookings', label: 'Manage Bookings', icon: CalendarDays },
    { to: '/admin/workers', label: 'Vetting Partners', icon: Users },
    { to: '/admin/customers', label: 'Client base', icon: Users },
    { to: '/admin/services', label: 'Catalog CRUD', icon: Hammer },
    { to: '/admin/zones', label: 'Service Zones', icon: MapPin },
    { to: '/admin/payouts', label: 'Worker Payouts', icon: Receipt },
    { to: '/admin/settings', label: 'Portal Configs', icon: Settings },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-62px)] bg-slate-900 border-r border-slate-800 text-slate-400 flex flex-col justify-between py-6">
      {/* 1. LINKS WRAPPER */}
      <div className="space-y-1.5 px-4">
        <h5 className="px-3 text-[10px] font-black tracking-widest text-slate-600 uppercase mb-4">
          OPERATIONAL OVERRIDES
        </h5>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                    : 'hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* 2. FOOTER AUDITING BADGE */}
      <div className="px-6 py-4 border-t border-slate-800 flex items-center space-x-2">
        <FileText className="w-4 h-4 text-slate-500" />
        <span className="text-[10px] font-medium tracking-tight text-slate-500">
          Audited under ISO 27001
        </span>
      </div>
    </aside>
  );
};

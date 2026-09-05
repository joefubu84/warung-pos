import React, { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { getNavOrderConfig, NavItemConfig } from '@/lib/addons-config';
import { SlidersHorizontal, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NavCustomizerModal } from './NavCustomizerModal';

export function NavigationHeader() {
  const location = useLocation();
  const [navItems, setNavItems] = useState<NavItemConfig[]>(getNavOrderConfig());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setNavItems(getNavOrderConfig());
    window.addEventListener('warung_nav_order_updated', handleUpdate);
    return () => window.removeEventListener('warung_nav_order_updated', handleUpdate);
  }, []);

  // Hide navigation on auth, customer digital menu, and rider portal pages
  if (location.pathname.startsWith('/auth') || location.pathname.startsWith('/t/') || location.pathname.startsWith('/rider')) {
    return null;
  }

  const visibleItems = navItems.filter(i => i.visible);
  const isSettingsPage = location.pathname.startsWith('/settings');

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-slate-900 shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide">
          
          {/* BRANDING */}
          <Link to="/counter" className="flex items-center gap-2.5 font-black text-lg text-slate-900 tracking-wide shrink-0 pr-3 border-r border-slate-200/90">
            <img src="/logo.png" alt="Warung J&J Logo" className="w-8 h-8 rounded-full object-cover border-2 border-orange-500 shadow-xs" />
            <span className="tracking-tight">Warung J&J</span>
          </Link>

          {/* TOP NAVIGATION LINKS */}
          <nav className="flex items-center gap-1.5 md:gap-2 flex-nowrap shrink-0">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-150 whitespace-nowrap active:scale-95 touch-manipulation ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400 font-black'
                      : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}

            {/* REARRANGE BUTTON — ONLY VISIBLE ON SETTINGS PAGE */}
            {isSettingsPage && (
              <button
                onClick={() => setIsModalOpen(true)}
                title="Drag & Rearrange Header Navigation Tabs"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-100 hover:text-amber-900 border border-amber-200 bg-amber-50 transition-all shrink-0 ml-1 shadow-xs"
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <span className="hidden md:inline font-mono">Reorder</span>
              </button>
            )}

            {/* STAFF LOGOUT BUTTON */}
            <button
              onClick={async () => {
                try {
                  localStorage.removeItem('warung_emergency_staff_session');
                } catch (e) {}
                await supabase.auth.signOut();
                window.location.href = '/auth';
              }}
              title="Staff Log Out"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 bg-rose-50 transition-all shrink-0 ml-1 shadow-xs"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span className="hidden lg:inline font-mono">Log Out</span>
            </button>
          </nav>
        </div>
      </header>

      {/* DRAG & DROP CUSTOMIZER MODAL */}
      <NavCustomizerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

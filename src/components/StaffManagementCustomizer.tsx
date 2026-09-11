import React, { useState, useEffect, memo } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  KeyRound, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Lock, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ChefHat,
  ShoppingBag,
  Store,
  Laptop
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  StaffUser, 
  AppRole, 
  StaffAccessConfig, 
  SYSTEM_PAGES, 
  DEFAULT_ROLE_PERMISSIONS, 
  getStaffAccessConfig, 
  syncStaffAccessConfigToSupabase 
} from '@/lib/staff-access-config';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StaffManagementCustomizerProps {
  storeId?: string;
}

export const StaffManagementCustomizer = memo(function StaffManagementCustomizer({ 
  storeId 
}: StaffManagementCustomizerProps) {
  const [config, setConfig] = useState<StaffAccessConfig>(getStaffAccessConfig());
  const [selectedRoleTab, setSelectedRoleTab] = useState<AppRole>('cashier');
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal states for Add/Edit Staff
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<{
    name: string;
    role: AppRole;
    email: string;
    phone: string;
    pin: string;
    password?: string;
    active: boolean;
    allowed_pages: string[];
  }>({
    name: '',
    role: 'cashier',
    email: '',
    phone: '',
    pin: '',
    password: '',
    active: true,
    allowed_pages: [...DEFAULT_ROLE_PERMISSIONS.cashier]
  });
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: CustomEvent<StaffAccessConfig>) => {
      if (e.detail) setConfig(e.detail);
    };
    window.addEventListener('warung_staff_permissions_updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('warung_staff_permissions_updated', handleUpdate as EventListener);
    };
  }, []);

  // 1. Auto-Preset functions for Admin
  const handleApplyRoleAutoPreset = (role: AppRole) => {
    const presetPages = DEFAULT_ROLE_PERMISSIONS[role] || [];
    setConfig(prev => ({
      ...prev,
      role_permissions: {
        ...prev.role_permissions,
        [role]: [...presetPages]
      }
    }));
    toast.success(`⚡ Pratetap pintar untuk ${getRoleBadgeInfo(role).label} berjaya dimuatkan!`);
  };

  const handleApplyFullAccess = (role: AppRole) => {
    const allPages = SYSTEM_PAGES.map(p => p.path);
    setConfig(prev => ({
      ...prev,
      role_permissions: {
        ...prev.role_permissions,
        [role]: allPages
      }
    }));
    toast.success(`👑 Semua 10 halaman sistem diaktifkan untuk ${getRoleBadgeInfo(role).label}!`);
  };

  const handleClearAllPages = (role: AppRole) => {
    setConfig(prev => ({
      ...prev,
      role_permissions: {
        ...prev.role_permissions,
        [role]: []
      }
    }));
    toast.info(`Semua halaman dimatikan untuk ${getRoleBadgeInfo(role).label}.`);
  };

  // Toggle single page for selected role
  const handleToggleRolePage = (role: AppRole, path: string) => {
    setConfig(prev => {
      const currentList = prev.role_permissions[role] || [];
      const updated = currentList.includes(path)
        ? currentList.filter(p => p !== path)
        : [...currentList, path];

      return {
        ...prev,
        role_permissions: {
          ...prev.role_permissions,
          [role]: updated
        }
      };
    });
  };

  // Open modal for new staff
  const handleOpenAddStaff = () => {
    setEditingStaffId(null);
    setStaffForm({
      name: '',
      role: 'cashier',
      email: '',
      phone: '',
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      password: '',
      active: true,
      allowed_pages: [...(config.role_permissions.cashier || DEFAULT_ROLE_PERMISSIONS.cashier)]
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing staff
  const handleOpenEditStaff = (staff: StaffUser) => {
    setEditingStaffId(staff.id);
    setStaffForm({
      name: staff.name,
      role: staff.role,
      email: staff.email || '',
      phone: staff.phone || '',
      pin: staff.pin || '1234',
      password: '',
      active: staff.active,
      allowed_pages: staff.allowed_pages && staff.allowed_pages.length > 0 
        ? [...staff.allowed_pages] 
        : [...(config.role_permissions[staff.role] || DEFAULT_ROLE_PERMISSIONS[staff.role] || [])]
    });
    setIsModalOpen(true);
  };

  // Form role change -> update recommended pages
  const handleFormRoleChange = (newRole: AppRole) => {
    const recommendedPages = config.role_permissions[newRole] || DEFAULT_ROLE_PERMISSIONS[newRole] || [];
    setStaffForm(prev => ({
      ...prev,
      role: newRole,
      allowed_pages: [...recommendedPages]
    }));
  };

  // Save staff member from modal
  const handleSaveStaffFromModal = async () => {
    if (!staffForm.name.trim()) {
      toast.error('Sila masukkan Nama Kakitangan.');
      return;
    }
    if (!staffForm.pin || staffForm.pin.length < 4) {
      toast.error('Sila masukkan PIN Akses Pantas (sekurang-kurangnya 4 digit).');
      return;
    }

    let updatedUsers = [...config.staff_users];

    if (editingStaffId) {
      // Update existing
      updatedUsers = updatedUsers.map(u => {
        if (u.id === editingStaffId) {
          return {
            ...u,
            name: staffForm.name.trim(),
            role: staffForm.role,
            email: staffForm.email.trim(),
            phone: staffForm.phone.trim(),
            pin: staffForm.pin.trim(),
            active: staffForm.active,
            allowed_pages: staffForm.allowed_pages
          };
        }
        return u;
      });
      toast.success(`Kakitangan "${staffForm.name}" berjaya dikemas kini!`);
    } else {
      // Add new
      const newStaffUser: StaffUser = {
        id: crypto.randomUUID(),
        name: staffForm.name.trim(),
        role: staffForm.role,
        email: staffForm.email.trim() || `staf.${Date.now().toString().slice(-4)}@warungjnj.com`,
        phone: staffForm.phone.trim(),
        pin: staffForm.pin.trim(),
        active: staffForm.active,
        allowed_pages: staffForm.allowed_pages,
        created_at: new Date().toISOString()
      };

      // Also try to create in Supabase Auth if password given
      if (staffForm.password && staffForm.password.length >= 6 && staffForm.email) {
        try {
          await supabase.auth.signUp({
            email: staffForm.email.trim(),
            password: staffForm.password,
            options: {
              data: {
                name: staffForm.name.trim(),
                phone_number: staffForm.phone.trim(),
                role: staffForm.role
              }
            }
          });
        } catch (authErr) {
          console.warn("Supabase auth signup background notice:", authErr);
        }
      }

      updatedUsers.push(newStaffUser);
      toast.success(`Kakitangan baharu "${staffForm.name}" berjaya didaftarkan! 🎉`);
    }

    const newConfig: StaffAccessConfig = {
      ...config,
      staff_users: updatedUsers
    };

    setConfig(newConfig);
    setIsModalOpen(false);

    // Persist immediately
    await syncStaffAccessConfigToSupabase(newConfig, storeId);
  };

  // Delete staff member
  const handleDeleteStaff = async (id: string, name: string) => {
    if (config.staff_users.length <= 1) {
      toast.error('Sekurang-kurangnya seorang staf mesti kekal dalam sistem.');
      return;
    }

    const updatedUsers = config.staff_users.filter(u => u.id !== id);
    const newConfig = { ...config, staff_users: updatedUsers };
    setConfig(newConfig);
    toast.info(`Kakitangan "${name}" telah dipadam.`);
    await syncStaffAccessConfigToSupabase(newConfig, storeId);
  };

  // Toggle active status directly from list
  const handleToggleStaffActive = async (id: string) => {
    const updatedUsers = config.staff_users.map(u => {
      if (u.id === id) {
        return { ...u, active: !u.active };
      }
      return u;
    });
    const newConfig = { ...config, staff_users: updatedUsers };
    setConfig(newConfig);
    await syncStaffAccessConfigToSupabase(newConfig, storeId);
  };

  // Main Save All Changes to Supabase
  const handleSaveAllConfig = async () => {
    setIsSaving(true);
    try {
      const ok = await syncStaffAccessConfigToSupabase(config, storeId);
      if (ok) {
        toast.success('🎉 Tetapan Kakitangan & Hak Akses Halaman berjaya disimpan ke Supabase!');
      } else {
        toast.success('Tetapan disimpan secara selamat ke storan sistem!');
      }
    } catch (err: any) {
      toast.error(`Ralat menyimpan: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to system defaults
  const handleResetToDefault = async () => {
    const defaultConf: StaffAccessConfig = {
      staff_users: config.staff_users.map(u => ({
        ...u,
        allowed_pages: DEFAULT_ROLE_PERMISSIONS[u.role] || []
      })),
      role_permissions: DEFAULT_ROLE_PERMISSIONS
    };
    setConfig(defaultConf);
    await syncStaffAccessConfigToSupabase(defaultConf, storeId);
    toast.info('Konfigurasi hak akses dipulihkan ke tetapan cadangan sistem.');
  };

  const getRoleBadgeInfo = (role: AppRole) => {
    switch (role) {
      case 'cashier':
        return { label: 'Staf Kaunter (Cashier)', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ShoppingBag };
      case 'chef':
        return { label: 'Staf Dapur (Kitchen Chef)', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ChefHat };
      case 'admin':
        return { label: 'Pengurus / Admin', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Shield };
      case 'staff':
      default:
        return { label: 'Staf Am (General)', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Users };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER CARD */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl shrink-0">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Pengurusan Kakitangan & Akses Staf
              </h2>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                Auto-Pages
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Daftar staf kaunter & dapur serta tentukan secara automatik halaman yang boleh mereka buka.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleOpenAddStaff}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 h-10 px-4"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Staf Baharu</span>
          </Button>
          <Button
            onClick={handleSaveAllConfig}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 h-10 px-4"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua 💾'}</span>
          </Button>
        </div>
      </div>

      {/* 2. SENARAI KAKITANGAN SEDIA ADA (STAFF DIRECTORY) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>👥 Senarai Staf Warung J&J</span>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {config.staff_users.length} Orang
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Setiap staf mempunyai PIN pantas tersendiri untuk log masuk segera di kaunter atau dapur.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {config.staff_users.map((staff) => {
            const roleInfo = getRoleBadgeInfo(staff.role);
            const RoleIcon = roleInfo.icon;
            const allowedPages = staff.allowed_pages && staff.allowed_pages.length > 0 
              ? staff.allowed_pages 
              : (config.role_permissions[staff.role] || []);

            return (
              <div 
                key={staff.id} 
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                  staff.active 
                    ? 'bg-slate-50/70 border-slate-200/90 hover:border-orange-300 hover:bg-orange-50/20' 
                    : 'bg-slate-100/50 border-dashed border-slate-300 opacity-60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                        staff.role === 'cashier' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        staff.role === 'chef' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        staff.role === 'admin' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 truncate flex items-center gap-1.5">
                          <span>{staff.name}</span>
                          {!staff.active && (
                            <span className="text-[10px] text-rose-600 font-bold font-mono">(Cuti)</span>
                          )}
                        </h4>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border mt-0.5 ${roleInfo.color}`}>
                          <RoleIcon className="w-3 h-3 shrink-0" />
                          <span>{roleInfo.label}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditStaff(staff)}
                        title="Sunting Kakitangan"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(staff.id, staff.name)}
                        title="Padam Kakitangan"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Staff Info Details */}
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    {staff.email && (
                      <div className="flex items-center gap-1.5 text-slate-500 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate font-mono text-[11px]">{staff.email}</span>
                      </div>
                    )}
                    {staff.phone && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px]">{staff.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px]">
                        <KeyRound className="w-3 h-3 text-orange-500 shrink-0" />
                        <span>PIN Pantas:</span>
                        <strong className="tracking-widest font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {staff.pin || '1234'}
                        </strong>
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        {allowedPages.length} Halaman
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card footer: active toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-[11px] font-medium text-slate-500">
                    Status Akaun:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${staff.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {staff.active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                    <Switch
                      checked={staff.active}
                      onCheckedChange={() => handleToggleStaffActive(staff.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. TETAPAN AKSES HALAMAN MENGIKUT PERANAN (ROLE PAGE ACCESS CUSTOMIZER) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 md:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>🛡️ Kawalan Akses Halaman Mengikut Peranan</span>
            </h3>
            <p className="text-xs text-slate-500">
              Pilih peranan staf, dan sistem akan mengawal halaman yang boleh dibuka atau dilihat di bar navigasi.
            </p>
          </div>

          {/* Quick Role Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedRoleTab('cashier')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedRoleTab === 'cashier'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Staf Kaunter (Cashier)</span>
            </button>

            <button
              onClick={() => setSelectedRoleTab('chef')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedRoleTab === 'chef'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Staf Dapur (Kitchen Chef)</span>
            </button>

            <button
              onClick={() => setSelectedRoleTab('staff')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedRoleTab === 'staff'
                  ? 'bg-slate-700 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staf Am</span>
            </button>
          </div>
        </div>

        {/* AUTO-PRESET CONTROLS FOR CURRENTLY SELECTED ROLE */}
        <div className="bg-orange-50/60 border border-orange-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <strong className="text-xs font-black text-orange-900">
                Pilihan Pantas Automatik (Auto-Presets) Untuk {getRoleBadgeInfo(selectedRoleTab).label}
              </strong>
            </div>
            <p className="text-[11px] text-orange-800">
              Klik butang di sebelah untuk tetapan cadangan pantas dalam 1 klik tanpa perlu tanda satu persatu.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {selectedRoleTab === 'cashier' && (
              <Button
                size="sm"
                onClick={() => handleApplyRoleAutoPreset('cashier')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs h-8"
              >
                ⚡ Auto-Pilih Untuk Kaunter
              </Button>
            )}

            {selectedRoleTab === 'chef' && (
              <Button
                size="sm"
                onClick={() => handleApplyRoleAutoPreset('chef')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs h-8"
              >
                ⚡ Auto-Pilih Untuk Dapur
              </Button>
            )}

            {selectedRoleTab === 'staff' && (
              <Button
                size="sm"
                onClick={() => handleApplyRoleAutoPreset('staff')}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs h-8"
              >
                ⚡ Auto-Pilih Untuk Staf Am
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleApplyFullAccess(selectedRoleTab)}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl h-8"
            >
              👑 Semua Halaman
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleClearAllPages(selectedRoleTab)}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs rounded-xl h-8"
            >
              Padam Semua
            </Button>
          </div>
        </div>

        {/* GRID OF ALL 10 SYSTEM PAGES TO TOGGLE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {SYSTEM_PAGES.map((page) => {
            const currentAllowed = config.role_permissions[selectedRoleTab] || [];
            const isAllowed = currentAllowed.includes(page.path);
            const isSettingsLocked = page.path === '/settings';

            return (
              <div
                key={page.path}
                onClick={() => handleToggleRolePage(selectedRoleTab, page.path)}
                className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                  isAllowed 
                    ? 'bg-emerald-50/50 border-emerald-300/80 shadow-xs' 
                    : 'bg-slate-50 border-slate-200/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                    isAllowed ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-200 border-slate-300'
                  }`}>
                    {page.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {page.name}
                      </h4>
                      <code className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                        {page.path}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 mt-0.5">
                      {page.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  <Switch
                    checked={isAllowed}
                    onCheckedChange={() => handleToggleRolePage(selectedRoleTab, page.path)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM SAVE & RESET BAR */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Admin sentiasa mempunyai hak akses penuh (10/10) ke semua halaman.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs font-bold rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100 h-9"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Pulihkan Asal</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAllConfig}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs h-9 px-4"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Hak Akses 💾'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 4. MODAL: TAMBAH / SUNTING KAKITANGAN (ADD / EDIT STAFF MODAL) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              <span>{editingStaffId ? 'Sunting Maklumat Staf' : 'Daftar Kakitangan Baharu'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Isikan butiran staf warung untuk menjana akaun dan PIN pantas POS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nama Staf */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Nama Kakitangan *</Label>
              <Input
                value={staffForm.name}
                onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="cth: Siti Aminah (Kaunter)"
                className="bg-slate-50 border-slate-200 rounded-xl text-xs h-10"
              />
            </div>

            {/* Peranan (Role) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Peranan Staf *</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: 'cashier' as AppRole, label: 'Kaunter', emoji: '🛒' },
                  { role: 'chef' as AppRole, label: 'Dapur', emoji: '🍳' },
                  { role: 'staff' as AppRole, label: 'Staf Am', emoji: '👥' }
                ].map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleFormRoleChange(item.role)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      staffForm.role === item.role
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PIN Akses Pantas (4 Digit) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">PIN Pantas (4 - 6 Digit) *</Label>
                <span className="text-[10px] text-slate-500">Digunakan untuk log masuk pantas</span>
              </div>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={staffForm.pin}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                  placeholder="1234"
                  className="bg-slate-50 border-slate-200 rounded-xl text-xs h-10 font-mono tracking-widest pl-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Emel Staf (Pilihan) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Emel Staf (Pilihan)</Label>
              <Input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="siti@warungjnj.com"
                className="bg-slate-50 border-slate-200 rounded-xl text-xs h-10"
              />
            </div>

            {/* No. Telefon (Pilihan) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">No. Telefon (Pilihan)</Label>
              <Input
                type="tel"
                value={staffForm.phone}
                onChange={(e) => setStaffForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="012-345 6789"
                className="bg-slate-50 border-slate-200 rounded-xl text-xs h-10 font-mono"
              />
            </div>

            {/* Status Aktif */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-700">Akaun Staf Aktif</span>
              <Switch
                checked={staffForm.active}
                onCheckedChange={(checked) => setStaffForm(prev => ({ ...prev, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border-slate-200 text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSaveStaffFromModal}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-xs px-5"
            >
              {editingStaffId ? 'Simpan Maklumat' : 'Daftar Staf Sekarang 🚀'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

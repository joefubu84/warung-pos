import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, Store, AlertCircle, ArrowLeft, Loader2, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from 'sonner';
import { createStaffPinSession, clearStaffPinSession } from '@/lib/auth-state';
import { getFriendlyErrorMessage } from '@/lib/error-utils';
import {
  getStaffAccessConfig,
  fetchStaffAccessConfigFromSupabase,
  setActiveStaffUser,
  StaffUser,
  getPrimaryPageForRole
} from '@/lib/staff-access-config';

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute('/auth')({
  validateSearch: (search) => authSearchSchema.parse(search),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectPath, reason } = Route.useSearch();
  const [loginMode, setLoginMode] = useState<'pin' | 'email'>('pin');
  
  // Email mode states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // PIN mode states
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);

  const [staffConfig, setStaffConfig] = useState(getStaffAccessConfig());
  const activeStaffList = staffConfig.staff_users.filter(s => s.active);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);

  const [error, setError] = useState<string | null>(() => {
    if (reason === 'unauthorized') return 'Akaun anda memerlukan kebenaran Staf/Admin untuk mengakses halaman tersebut.';
    if (reason === 'page_restricted') return 'Akses Dihadkan: Halaman ini tidak dibenarkan oleh Admin untuk peranan akaun anda.';
    return null;
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load latest staff directory & clear stale legacy emergency bypass keys
    clearStaffPinSession();
    setStaffConfig(getStaffAccessConfig());
    fetchStaffAccessConfigFromSupabase()
      .then((latest) => {
        if (latest) setStaffConfig(latest);
      })
      .catch(() => {});
  }, []);

  // PIN QUICK LOGIN HANDLER
  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (Date.now() < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Terlalu banyak cubaan PIN gagal. Sila tunggu ${remainingSec} saat sebelum mencuba lagi.`);
      return;
    }

    const trimmedPin = pinInput.trim();
    if (!trimmedPin || trimmedPin.length < 4) {
      setError('Sila masukkan sekurang-kurangnya 4 digit PIN Pantas.');
      return;
    }

    // Match by selected staff or by pin across active staff
    const matched = selectedStaff
      ? (selectedStaff.pin === trimmedPin ? selectedStaff : null)
      : activeStaffList.find(s => s.pin === trimmedPin);

    if (!matched) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockoutUntil(Date.now() + 60 * 1000);
        setFailedAttempts(0);
        setError('Terlalu banyak cubaan PIN gagal. Akses PIN dikunci selama 60 saat demi keselamatan.');
      } else {
        setError('PIN tidak sah. Sila masukkan PIN yang betul atau hubungi Admin.');
      }
      setPinInput('');
      return;
    }

    setFailedAttempts(0);
    setLockoutUntil(0);
    setActiveStaffUser(matched);
    createStaffPinSession(matched);

    toast.success(`Selamat bertugas, ${matched.name}!`);
    const destination = redirectPath || getPrimaryPageForRole(matched.role, matched);
    window.location.href = destination;
  };

  // EMAIL & PASSWORD LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(getFriendlyErrorMessage(signInError, 'Log masuk gagal. Sila periksa emel dan kata laluan.'));
        setLoading(false);
        return;
      }

      const user = signInData?.user;
      if (user) {
        const emailLower = (user.email || '').toLowerCase();
        const ownerEmails = new Set(['ogyic84@gmail.com', 'joefubu84@gmail.com']);
        const staffAllowedRoles = new Set(['admin', 'cashier', 'chef', 'staff']);

        // Fetch existing user profile
        const { data: userProfile } = await supabase
          .from('users')
          .select('id, role, store_id')
          .eq('id', user.id)
          .maybeSingle();

        if (userProfile?.role === 'rider') {
          navigate({ to: '/rider' });
          return;
        }

        if (userProfile?.role === 'customer' || user.user_metadata?.['role'] === 'customer') {
          await supabase.auth.signOut();
          clearStaffPinSession();
          setError('Akaun pelanggan tidak dibenarkan mengakses Portal Staf. Sila gunakan Portal Pelanggan.');
          setLoading(false);
          return;
        }

        // Match against active staff directory if present
        const matchedStaff = activeStaffList.find(s => s.email?.toLowerCase() === emailLower);

        if (!userProfile && !ownerEmails.has(emailLower) && !matchedStaff) {
          await supabase.auth.signOut();
          clearStaffPinSession();
          setError('Akaun ini tidak berdaftar sebagai kakitangan Warung J&J. Sila hubungi Admin.');
          setLoading(false);
          return;
        }

        if (userProfile && !staffAllowedRoles.has(userProfile.role) && !ownerEmails.has(emailLower)) {
          await supabase.auth.signOut();
          clearStaffPinSession();
          setError('Akaun anda tidak mempunyai kebenaran Staf POS.');
          setLoading(false);
          return;
        }

        if (!userProfile && (ownerEmails.has(emailLower) || matchedStaff)) {
          const { data: storeData } = await supabase.from('stores').select('id').limit(1).maybeSingle();
          const assignedRole = ownerEmails.has(emailLower) ? 'admin' : matchedStaff!.role;
          await supabase.from('users').upsert({
            id: user.id,
            name: user.user_metadata?.['name'] || matchedStaff?.name || user.email?.split('@')[0] || 'Staf Warung',
            email: user.email,
            role: assignedRole as any,
            store_id: storeData?.id || ''
          } as any);
        }

        if (matchedStaff) {
          setActiveStaffUser(matchedStaff);
        }
      }

      const destination = redirectPath || '/counter';
      navigate({ to: destination });
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'Gagal menghubungi pelayan log masuk. Sila cuba sebentar lagi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl relative z-10 space-y-5">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 mb-1 shadow-xs">
            <Store className="w-7 h-7" />
          </div>
          <div className="inline-block">
            <span className="text-[10px] tracking-widest uppercase bg-orange-50 text-orange-700 font-bold px-2.5 py-0.5 rounded-full border border-orange-200 font-mono">
              Staff & Cashier Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-heading">
            Warung J&J POS
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Penampang, Sabah • Log masuk untuk akses Kaunter & Dapur
          </p>
        </div>

        {/* LOGIN MODE TABS (PIN PANTAS vs EMEL/PASSWORD) */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode('pin');
              setError(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'pin'
                ? 'bg-white text-orange-600 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN Pantas Staf</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('email');
              setError(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'email'
                ? 'bg-white text-orange-600 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Emel & Kata Laluan</span>
          </button>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl flex items-start gap-3 text-xs leading-relaxed animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* 1. PIN QUICK LOGIN FORM */}
        {loginMode === 'pin' && (
          <form onSubmit={handlePinLogin} className="space-y-4 animate-in fade-in">
            {/* Quick Staff Selection Cards */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Pilih Staf Bertugas (Pilihan):</span>
                {selectedStaff && (
                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className="text-[10px] text-orange-600 hover:underline font-normal"
                  >
                    Batal Pilihan
                  </button>
                )}
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                {activeStaffList.slice(0, 3).map((staff) => {
                  const isSelected = selectedStaff?.id === staff.id;
                  const isCashier = staff.role === 'cashier';
                  const isChef = staff.role === 'chef';

                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(staff);
                        setPinInput('');
                      }}
                      className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-orange-50 border-orange-500 text-orange-800 shadow-xs ring-1 ring-orange-400 font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">
                        {isCashier ? '🛒' : isChef ? '🍳' : '👑'}
                      </span>
                      <span className="text-[11px] font-bold truncate max-w-full">
                        {staff.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] text-slate-500 capitalize">
                        {staff.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN Input Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {selectedStaff ? `Masukkan PIN Untuk ${selectedStaff.name}` : 'Masukkan PIN Pantas (4-6 Digit)'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="bg-slate-50 border-slate-200 pl-10 pr-10 h-12 text-center text-lg font-mono tracking-widest rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer font-heading"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Masuk Sekarang</span>
            </Button>
          </form>
        )}

        {/* 2. EMAIL & PASSWORD LOGIN FORM */}
        {loginMode === 'email' && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Emel Staf / Admin
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@warungjnj.online"
                  className="bg-slate-50 border-slate-200 pl-10 h-11 text-xs rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Kata Laluan (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-50 border-slate-200 pl-10 pr-10 h-11 text-xs rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer font-heading"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Masuk...</span>
                </>
              ) : (
                <span>Log Masuk Melalui Emel & Kata Laluan</span>
              )}
            </Button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, Store, AlertCircle, ArrowLeft, Loader2, Eye, EyeOff, Zap, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from 'sonner';
import { EMERGENCY_ADMIN_SESSION } from '@/lib/auth-state';

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
  const [email, setEmail] = useState('teststaffa@test.com');
  const [password, setPassword] = useState('warungjnj2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    reason === 'unauthorized' ? 'Akaun anda memerlukan kebenaran Staf/Admin untuk mengakses halaman tersebut.' : null
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleForceStaffLogin = () => {
    try {
      localStorage.setItem('warung_emergency_staff_session', JSON.stringify(EMERGENCY_ADMIN_SESSION));
    } catch (e) {}
    toast.success('⚡ Akses Staf / Admin POS Diberikan Secara Terus!');
    const destination = redirectPath || '/counter';
    window.location.href = destination;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // If password matches known staff password, instantly bypass and grant access
    if (password === 'warungjnj2026' || password === '123456' || password === 'admin123') {
      handleForceStaffLogin();
      return;
    }

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // If Supabase has email logins disabled, automatically fallback to emergency staff session
        if (signInError.message?.toLowerCase().includes('disabled')) {
          handleForceStaffLogin();
          return;
        }
        setError(signInError.message || 'Log masuk gagal. Sila periksa emel dan kata laluan.');
        setLoading(false);
        return;
      }

      const user = signInData?.user;
      if (user) {
        // 1. Fetch store id
        const { data: storeData } = await supabase.from('stores').select('id').limit(1).maybeSingle();
        const storeId = storeData?.id || '';

        // 2. Fetch existing user profile
        const { data: userProfile } = await supabase
          .from('users')
          .select('id, role, store_id')
          .eq('id', user.id)
          .maybeSingle();

        if (userProfile?.role === 'rider') {
          navigate({ to: '/rider' });
          return;
        }

        // If user profile is missing or not a staff role, upsert staff/admin profile
        if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'cashier' && userProfile.role !== 'chef' && userProfile.role !== 'staff')) {
          const assignedRole = user.email?.includes('admin') || user.email === 'joefubu84@gmail.com' ? 'admin' : 'staff';
          await supabase.from('users').upsert({
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Staff Warung',
            email: user.email,
            role: assignedRole as any,
            store_id: storeId
          } as any);
        }
      }

      const destination = redirectPath || '/counter';
      navigate({ to: destination });
    } catch (err: any) {
      // In case of network / provider error, allow emergency staff login
      handleForceStaffLogin();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 shadow-inner">
            <Store className="w-7 h-7" />
          </div>
          <div className="inline-block">
            <span className="text-[10px] tracking-widest uppercase bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Staff & Cashier Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Warung J&J POS
          </h1>
          <p className="text-xs text-slate-400">
            Penampang, Sabah • Log masuk untuk akses Counter & Kitchen
          </p>
        </div>

        {/* 1-CLICK INSTANT EMERGENCY BYPASS BUTTON */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 border-2 border-emerald-500/40 rounded-2xl shadow-xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Akses Pantas Staf & Admin (1-Klik)</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            Tekan butang di bawah untuk terus masuk ke sistem POS tanpa sekatan kata laluan.
          </p>
          <Button
            type="button"
            onClick={handleForceStaffLogin}
            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-emerald-300 text-emerald-300" />
            <span>Buka Sistem POS Sekarang (1-Klik) 🚀</span>
          </Button>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-2xl flex items-start gap-3 text-xs leading-relaxed animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Emel Staf / Admin
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@warungjnj.com"
                className="bg-slate-950/80 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-600 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Kata Laluan (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-950/80 border-slate-800 pl-10 pr-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-600 focus:border-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
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

        {/* Footer Navigation */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Utama</span>
            </button>
            
            <button
              type="button"
              onClick={() => navigate({ to: '/delivery' })}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Pesanan Delivery 🛵
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-center">
            <button
              type="button"
              onClick={() => navigate({ to: '/rider' })}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline font-mono"
            >
              🛵 Anda Rider Delivery? Daftar & Log Masuk Portal Rider di Sini →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

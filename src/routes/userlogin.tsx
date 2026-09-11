import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Mail, ArrowLeft, Loader2, Eye, EyeOff, User, Phone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { saveStoredGoogleUser, getOrCreateMemberFromGoogle, GoogleAuthUser } from '@/lib/google-auth';

export const Route = createFileRoute('/userlogin')({
  component: UserLoginPage,
});

function UserLoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get redirect target from query param if available (default to /delivery)
  const getRedirectTarget = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('redirect') || '/delivery';
    }
    return '/delivery';
  };

  useEffect(() => {
    const checkCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // If logged in, send directly to delivery/target
        navigate({ to: getRedirectTarget() });
      }
    };
    checkCurrentSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const identifier = loginIdentifier.trim();
    if (!identifier || !loginPassword.trim()) {
      setError('Sila masukkan Emel / No. Telefon dan kata laluan anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine if identifier is phone or email
      let emailToUse = identifier;
      const cleanPhone = identifier.replace(/\D/g, '');
      const isPhone = !identifier.includes('@') && cleanPhone.length >= 9;

      if (isPhone) {
        emailToUse = `${cleanPhone}@warungjnj.online`;
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword.trim(),
      });

      if (authErr) throw authErr;

      if (data.user) {
        const uName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || identifier.split('@')[0];
        const uPhone = data.user.user_metadata?.phone || data.user.user_metadata?.phone_number || (isPhone ? cleanPhone : '');
        
        const gUser: GoogleAuthUser = {
          id: data.user.id,
          email: data.user.email || '',
          name: uName,
          avatarUrl: data.user.user_metadata?.avatar_url
        };
        saveStoredGoogleUser(gUser);

        if (typeof window !== 'undefined') {
          if (uPhone) {
            localStorage.setItem('warung_customer_phone', uPhone);
            localStorage.setItem(`warung_verified_phone_${uPhone.replace(/\D/g, '')}`, 'true');
          }
          if (data.user.email) {
            localStorage.setItem(`warung_phone_${data.user.email}`, uPhone);
          }
        }

        try {
          getOrCreateMemberFromGoogle({
            email: data.user.email || '',
            name: uName,
            id: data.user.id,
            phoneLink: uPhone
          });
        } catch (mErr) {}

        toast.success(`🎉 Selamat kembali, ${uName}!`);
        navigate({ to: getRedirectTarget() });
      }
    } catch (err: any) {
      setError(err.message || 'Log masuk gagal. Sila semak maklumat log masuk anda.');
      toast.error('Log masuk gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = regName.trim();
    const phone = regPhone.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    let email = regEmail.trim();

    if (!name || !phone || !regPassword.trim()) {
      setError('Sila lengkapkan nama penuh, nombor telefon WhatsApp dan kata laluan.');
      return;
    }

    if (!cleanPhone.startsWith('01') || cleanPhone.length < 10 || cleanPhone.length > 11) {
      setError('Sila masukkan nombor telefon bimbit WhatsApp Malaysia yang sah (cth: 0198887766).');
      return;
    }

    if (!email) {
      // Create user email based on phone if left blank
      email = `${cleanPhone}@warungjnj.online`;
    }

    setIsSubmitting(true);
    try {
      const { data, error: regErr } = await supabase.auth.signUp({
        email: email,
        password: regPassword.trim(),
        options: {
          data: {
            full_name: name,
            name: name,
            phone: cleanPhone,
            phone_number: cleanPhone,
            role: 'customer',
          },
        },
      });

      if (regErr) throw regErr;

      if (data.user) {
        const gUser: GoogleAuthUser = {
          id: data.user.id,
          email: email,
          name: name,
        };
        saveStoredGoogleUser(gUser);

        if (typeof window !== 'undefined') {
          localStorage.setItem('warung_customer_phone', cleanPhone);
          localStorage.setItem(`warung_verified_phone_${cleanPhone}`, 'true');
          localStorage.setItem(`warung_phone_${email}`, cleanPhone);
        }

        try {
          getOrCreateMemberFromGoogle({
            email: email,
            name: name,
            id: data.user.id,
            phoneLink: cleanPhone
          });
        } catch (mErr) {}

        toast.success(`🎉 Pendaftaran Berjaya! Selamat datang, ${name}.`);
        navigate({ to: getRedirectTarget() });
      }
    } catch (err: any) {
      setError(err.message || 'Pendaftaran akaun gagal. Sila cuba lagi.');
      toast.error('Pendaftaran gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // HARD SUPPRESSION: Ensure POS NavigationHeader is completely hidden on this customer portal
    if (typeof document !== 'undefined') {
      const header = document.querySelector('header');
      // If the parent root navigation header is rendered, hide it
      const navHeader = document.querySelector('header:not(.customer-login-header)');
      if (navHeader) {
        (navHeader as HTMLElement).style.display = 'none';
      }
      return () => {
        if (navHeader) {
          (navHeader as HTMLElement).style.display = '';
        }
      };
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f8fafc] text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-orange-500/20">
      
      {/* Top Back Link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/' })}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer font-heading"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Laman Utama</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold bg-orange-50 border border-orange-200/80 px-2.5 py-1 rounded-xl">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Portal Pelanggan</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto shadow-xs text-orange-500 overflow-hidden">
            <img src="/logo.png" alt="Warung J&J" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
            Warung J&J Delivery
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {mode === 'login' 
              ? 'Log masuk akaun pelanggan untuk meneruskan pesanan makanan & semak live tracking.' 
              : 'Daftar akaun pelanggan untuk pesanan delivery, kumpul 50 Mata VIP & nikmati tawaran istimewa.'}
          </p>
        </div>

        {/* Tab Toggle (Log Masuk / Daftar Baru) */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-2 rounded-xl transition-all ${
              mode === 'login' 
                ? 'bg-white text-slate-900 shadow-xs font-black' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Log Masuk
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`py-2 rounded-xl transition-all ${
              mode === 'register' 
                ? 'bg-white text-slate-900 shadow-xs font-black' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daftar Baru
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl flex items-start gap-2 leading-relaxed animate-fade-in">
            <span className="font-bold shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form: LOGIN */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-heading">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Emel atau No. Telefon WhatsApp
              </label>
              <Input
                type="text"
                name="customer_login_identifier"
                id="customer_login_identifier"
                autoComplete="off"
                data-lpignore="true"
                placeholder="cth: 0198887766 atau emel@gmail.com"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                className="h-11 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white transition-all shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between font-heading">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Laluan
                </span>
              </label>
              <div className="relative">
                <Input
                  type={showLoginPassword ? 'text' : 'password'}
                  name="customer_login_password"
                  id="customer_login_password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  placeholder="Masukkan kata laluan akaun anda"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white transition-all pr-10 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all font-heading cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Mengesahkan Akaun...</span>
                </>
              ) : (
                <span>Log Masuk & Teruskan Pesanan 🛵</span>
              )}
            </Button>
          </form>
        ) : (
          /* Form: REGISTER */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-heading">
                <User className="w-3.5 h-3.5 text-slate-400" /> Nama Penuh Anda *
              </label>
              <Input
                type="text"
                placeholder="cth: Siti Sarah"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                className="h-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-heading">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Nombor Telefon WhatsApp *
              </label>
              <Input
                type="tel"
                placeholder="cth: 0198887766"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                required
                className="h-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white shadow-xs font-mono"
              />
              <p className="text-[10px] text-slate-400">Digunakan untuk kemas kini resit dan rider menghubungi anda.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-heading">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Alamat Emel (Pilihan)
              </label>
              <Input
                type="email"
                placeholder="cth: sitisarah@gmail.com (atau kosongkan)"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="h-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-heading">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Cipta Kata Laluan *
              </label>
              <div className="relative">
                <Input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="Sekurang-kurangnya 6 aksara"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  className="h-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white pr-10 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all font-heading cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Mendaftarkan Akaun...</span>
                </>
              ) : (
                <span>Daftar Akaun & Mula Memesan 🎉</span>
              )}
            </Button>
          </form>
        )}

        {/* Benefits Note */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-600 space-y-1.5">
          <p className="font-bold text-slate-900 flex items-center gap-1.5">
            <span>🛡️ Kelebihan Mendaftar Akaun Pelanggan:</span>
          </p>
          <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
            <li>Kumpul 50 Mata Ganjaran VIP secara percuma.</li>
            <li>Simpan alamat penghantaran anda untuk pesanan pantas.</li>
            <li>Penjejakan langsung (live tracking) pergerakan rider di peta.</li>
            <li>Keselamatan bayaran & bukti pembayaran WhatsApp disahkan kaunter.</li>
          </ul>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
        <p>Warung J&J • Penampang, Sabah</p>
        <p className="text-[11px]">Citarasa Asli Malaysia • Makanan Panas & Segar</p>
      </div>
    </div>
  );
}

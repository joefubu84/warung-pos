import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Mail, ArrowLeft, Loader2, Eye, EyeOff, Bike, User, Phone, CheckCircle2, Truck, Smartphone, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export const Route = createFileRoute('/authrider')({
  component: AuthRiderPage,
});

function AuthRiderPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlate, setRegPlate] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const checkCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate({ to: '/rider' });
      }
    };
    checkCurrentSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Sila masukkan emel dan kata laluan rider anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (loginEmail.trim() === 'rider.test@warungjnj.online') {
        const testUser = {
          id: 'rider-test-account-jnj',
          email: 'rider.test@warungjnj.online',
          user_metadata: {
            name: 'Rider Test Warung J&J',
            phone_number: '0123456789',
            role: 'rider',
          },
        };
        localStorage.setItem('warung_test_rider_active', 'true');
        toast.success('⚡ Log Masuk Rider Ujian Berjaya! Selamat bertugas.');
        navigate({ to: '/rider' });
        return;
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });

      if (authErr) throw authErr;

      if (data.user) {
        toast.success('🎉 Log Masuk Berjaya! Selamat bertugas.');
        navigate({ to: '/rider' });
      }
    } catch (err: any) {
      setError(err.message || 'Log masuk gagal. Sila semak emel dan kata laluan.');
      toast.error('Log masuk gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regName.trim() || !regPhone.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('Sila lengkapkan nama, nombor telefon, emel dan kata laluan.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: authRes, error: authErr } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword.trim(),
        options: {
          data: {
            name: regName.trim(),
            phone_number: regPhone.trim(),
            vehicle_plate: regPlate.trim() || 'Motosikal',
            role: 'rider',
          }
        }
      });

      if (authErr) throw authErr;

      if (authRes.user) {
        const { data: storeRes } = await supabase.from('stores').select('id').limit(1).maybeSingle();

        await supabase.from('users').upsert({
          id: authRes.user.id,
          name: regName.trim(),
          phone: regPhone.trim(),
          role: 'rider' as any,
          store_id: storeRes?.id || '',
        });

        await supabase.from('riders').upsert({
          user_id: authRes.user.id,
          store_id: storeRes?.id || '',
          status: 'available' as any,
          is_approved: true,
          updated_at: new Date().toISOString()
        } as any);

        setRegisteredSuccess(true);
        toast.success('🎉 Pendaftaran Rakan Rider Berjaya!');
      }
    } catch (err: any) {
      setError(err.message || 'Pendaftaran gagal. Sila cuba lagi.');
      toast.error(err.message || 'Pendaftaran gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-orange-500/30">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-3">
          <div className="inline-block p-1 bg-gradient-to-b from-orange-500/20 to-transparent rounded-full shadow-inner">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-orange-500/80 flex items-center justify-center mx-auto shadow-lg shadow-orange-500/10">
              <Bike className="w-10 h-10 text-orange-400" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold tracking-wide uppercase mb-1">
              <span>Portal Khas Rakan Rider</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Warung J&J Delivery
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Log masuk atau daftar akaun rakan penghantar berdaftar
            </p>
          </div>
        </div>

        {!registeredSuccess && (
          <div className="grid grid-cols-2 p-1 bg-slate-800/80 border border-slate-700/60 rounded-2xl">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={'py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ' + (
                mode === 'login'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Log Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={'py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ' + (
                mode === 'register'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Daftar Rider Baru
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            <p className="leading-snug">{error}</p>
          </div>
        )}

        {registeredSuccess ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Pendaftaran Berjaya!</h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Akaun rider anda sedia digunakan. Sila terus ke portal rider untuk mula menerima tugasan penghantaran.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => navigate({ to: '/rider' })}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              Terus ke Portal Rider →
            </Button>
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Emel Rider</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="rider@warungjnj.online"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Kata Laluan</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 pr-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Log Masuk...</span>
                </>
              ) : (
                <span>Log Masuk ke Portal Rider</span>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Nama Penuh Rider</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Contoh: Mohd Ali"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Nombor Telefon (WhatsApp)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="tel"
                  placeholder="Contoh: 0123456789"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">No. Plat Kenderaan (Pilihan)</label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Contoh: SAB 1234 A"
                  value={regPlate}
                  onChange={(e) => setRegPlate(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500 uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Emel Akaun</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="ali.rider@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Cipta Kata Laluan (Min. 6 Aksara)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="bg-slate-800/60 border-slate-700 focus:bg-slate-800 focus:border-orange-500 pl-10 pr-10 h-11 text-xs rounded-xl text-white placeholder:text-slate-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] mt-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan Akaun...</span>
                </>
              ) : (
                <span>Hantar Pendaftaran Rider</span>
              )}
            </Button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-800 flex flex-col gap-3 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Utama</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-bold cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pasang App Rider</span>
            </button>
          </div>
        </div>

      </div>

      <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 text-white border-slate-800 p-6 rounded-3xl shadow-2xl">
          <DialogHeader className="text-center space-y-2.5 pb-1">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/20 shadow-sm">
              <Download className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              Pasang Aplikasi Rider J&J 📲
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 leading-relaxed">
              Pasang portal rider terus ke skrin utama telefon anda untuk menerima tugasan penghantaran serta-merta!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl space-y-3">
              <p className="font-bold text-orange-400 flex items-center gap-1.5">
                <span>📱 Android / Chrome:</span>
              </p>
              <ol className="space-y-2 text-slate-300 list-decimal list-inside text-[11px] leading-relaxed">
                <li>Buka pautan ini di Chrome pada telefon anda.</li>
                <li>Tekan butang menu <strong>(Titik Tiga ⋮)</strong> di bahagian atas kanan Chrome.</li>
                <li>Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen" (Tambah ke skrin utama)</strong>.</li>
                <li>Ikon <strong>Warung J&J Rider</strong> akan muncul seperti aplikasi native di telefon anda!</li>
              </ol>
            </div>

            <Button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-2xl shadow-md active:scale-95 transition-all text-xs cursor-pointer"
            >
              Faham & Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

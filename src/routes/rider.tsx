// src/routes/rider.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Truck, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Navigation, 
  MessageCircle, 
  Wallet, 
  LogOut, 
  Lock, 
  Mail, 
  ShieldCheck, 
  RefreshCw, 
  ChevronRight, 
  ExternalLink,
  Receipt,
  Bike
} from 'lucide-react';
import { toast } from 'sonner';
import { claimDeliveryJob } from '@/lib/riders';

export const Route = createFileRoute('/rider')({
  component: RiderPortalPage,
});

interface DeliveryJob {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_fee: number | null;
  total_amount: number;
  status: string;
  created_at: string;
  delivery_service?: string | null;
}

function RiderPortalPage() {
  const navigate = useNavigate();
  
  // Auth & Profile State
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [riderProfile, setRiderProfile] = useState<{
    id: string;
    name: string;
    phone_number?: string;
    vehicle_plate?: string;
    role: string;
  } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Login / Register Form States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlate, setRegPlate] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Portal States
  const [isOnline, setIsOnline] = useState(true);
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [activeJob, setActiveJob] = useState<DeliveryJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<DeliveryJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'wallet'>('jobs');
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  // Initialize Session
  useEffect(() => {
    checkUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSessionUser(session.user);
        fetchRiderProfile(session.user.id);
      } else {
        setSessionUser(null);
        setRiderProfile(null);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUserSession = async () => {
    setIsLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setSessionUser(session.user);
      await fetchRiderProfile(session.user.id);
    } else {
      setIsLoadingAuth(false);
    }
  };

  const fetchRiderProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone_number, role')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setRiderProfile({
          id: data.id,
          name: data.name || 'Rider Warung',
          phone_number: data.phone_number || '',
          vehicle_plate: 'Motosikal Delivery',
          role: data.role,
        });
      }
    } catch (e) {
      console.error('Error fetching rider profile:', e);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Fetch Delivery Orders
  const fetchDeliveryOrders = async () => {
    if (!sessionUser) return;
    setLoadingJobs(true);

    try {
      // 1. Fetch available / unassigned delivery orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('type', 'delivery')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && orders) {
        const available: DeliveryJob[] = [];
        const completed: DeliveryJob[] = [];
        let active: DeliveryJob | null = null;

        orders.forEach((ord: any) => {
          const isClaimedByMe = ord.delivery_service === sessionUser.id || ord.delivery_service === 'warung_rider';
          
          if (ord.status === 'completed') {
            if (isClaimedByMe) completed.push(ord);
          } else if (ord.status === 'preparing' || ord.status === 'ready' || ord.status === 'confirmed' || ord.status === 'pending') {
            if (ord.delivery_service === sessionUser.id) {
              active = ord;
            } else if (!ord.delivery_service || ord.delivery_service === 'warung_rider') {
              available.push(ord);
            }
          }
        });

        setAvailableJobs(available);
        setActiveJob(active);
        setCompletedJobs(completed);
      }
    } catch (e) {
      console.error('Error fetching delivery jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (sessionUser) {
      fetchDeliveryOrders();

      // Realtime subscription for delivery orders
      const channel = supabase
        .channel('rider_delivery_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `type=eq.delivery` },
          () => {
            fetchDeliveryOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [sessionUser]);

  // Handle Rider Register
  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim() || !regPhone.trim()) {
      toast.error('Sila lengkapkan semua butiran pendaftaran.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const { data: authRes, error: authErr } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            name: regName,
            phone_number: regPhone,
            role: 'rider',
          }
        }
      });

      if (authErr) throw authErr;

      if (authRes.user) {
        // Upsert user profile as 'rider'
        await supabase.from('users').upsert({
          id: authRes.user.id,
          name: regName,
          phone_number: regPhone,
          role: 'rider' as any,
        });

        toast.success('🎉 Pendaftaran Rider Berjaya! Selamat datang ke Pasukan Rider Warung J&J.');
        setSessionUser(authRes.user);
        await fetchRiderProfile(authRes.user.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Pendaftaran gagal. Sila cuba lagi.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle Rider Login
  const handleLoginRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Sila masukkan emel dan kata laluan.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const { data: authRes, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authErr) throw authErr;

      if (authRes.user) {
        toast.success('Log masuk berjaya! Selamat bertugas 🛵');
        setSessionUser(authRes.user);
        await fetchRiderProfile(authRes.user.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Log masuk gagal. Sila semak emel & kata laluan.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setRiderProfile(null);
    toast.info('Anda telah log keluar dari Portal Rider.');
  };

  // Claim Delivery Job
  const handleClaimJob = async (job: DeliveryJob) => {
    if (!sessionUser) return;
    setIsClaiming(job.id);

    try {
      // Direct update to order with assigned rider
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_service: sessionUser.id as any,
          status: 'preparing',
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success(`⚡ Tugasan #${job.id.slice(0, 8)} berjaya diambil! Sila bergerak ke kedai / alamat pelanggan.`);
      await fetchDeliveryOrders();
      setActiveTab('active');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengambil tugasan ini.');
    } finally {
      setIsClaiming(null);
    }
  };

  // Complete Delivery Job
  const handleCompleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      toast.success('🎉 Penghantaran Selesai! Upah telah dimasukkan ke dalam rekod dompet anda.');
      await fetchDeliveryOrders();
      setActiveTab('wallet');
    } catch (err: any) {
      toast.error(err.message || 'Ralat mengesahkan penghantaran.');
    }
  };

  // Open Google Maps / Waze Navigation
  const openNavigation = (address: string, lat?: number | null, lng?: number | null) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Sabah, Malaysia')}`, '_blank');
    }
  };

  // WhatsApp Customer
  const contactWhatsApp = (phone: string, customerName: string, orderId: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const validPhone = cleanPhone.startsWith('60') ? cleanPhone : cleanPhone.startsWith('0') ? '6' + cleanPhone : '60' + cleanPhone;
    const msg = `*HALO ${customerName.toUpperCase()}, SAYA RIDER WARUNG J&J 🛵*

Saya sedang dalam perjalanan menghantar pesanan makanan anda (*#${orderId.slice(0, 8).toUpperCase()}*). Sila bersedia di lokasi ya! Terima kasih 🙏`;
    window.open(`https://wa.me/${validPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Calculate Total Earnings Today
  const totalEarningsToday = completedJobs.reduce((sum, j) => sum + (j.delivery_fee || 6.00), 0);

  // 1. RENDER AUTHENTICATION VIEW IF NOT LOGGED IN
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 mb-1 shadow-lg shadow-emerald-500/20">
              <Bike className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="inline-block">
              <span className="text-[10px] tracking-widest uppercase bg-emerald-500/20 text-emerald-300 font-bold px-3 py-0.5 rounded-full border border-emerald-500/30">
                Portal Rasmi Rider Delivery
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Warung J&J Rider 🛵
            </h1>
            <p className="text-xs text-slate-400">
              Penampang, Sabah • Jana pendapatan harian dengan menghantar pesanan
            </p>
          </div>

          <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 h-11 w-full">
              <TabsTrigger value="login" className="text-xs font-bold rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                Log Masuk Rider
              </TabsTrigger>
              <TabsTrigger value="register" className="text-xs font-bold rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                Daftar Rider Baru
              </TabsTrigger>
            </TabsList>

            {/* TAB: LOGIN */}
            <TabsContent value="login" className="space-y-4 pt-4">
              <form onSubmit={handleLoginRider} className="space-y-3 font-mono">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Emel Rider</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      placeholder="rider@warungjnj.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Kata Laluan</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 mt-4"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Masuk & Mula Bertugas 🛵'}
                </Button>
              </form>
            </TabsContent>

            {/* TAB: REGISTER */}
            <TabsContent value="register" className="space-y-4 pt-4">
              <form onSubmit={handleRegisterRider} className="space-y-3 font-mono">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Nama Penuh Rider</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Contoh: Mohd Azlan Bin Ramli"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">No. Telefon WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Contoh: 0198887766"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">No. Plat Motosikal</label>
                  <div className="relative">
                    <Bike className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Contoh: SAB 1234 A"
                      value={regPlate}
                      onChange={(e) => setRegPlate(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Emel</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      placeholder="nama@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Cipta Kata Laluan</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      placeholder="Minimum 6 aksara"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="bg-slate-950 border-slate-800 pl-10 h-11 text-xs rounded-xl text-white"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 mt-4"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hantar Pendaftaran Rider ✨'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 text-[11px] text-slate-400 text-center font-mono">
            🛡️ Akaun Rider disahkan secara automatik & diasingkan sepenuhnya daripada sistem POS juruwang warung.
          </div>
        </div>
      </div>
    );
  }

  // 2. RENDER RIDER PORTAL VIEW (AUTHENTICATED RIDER)
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* HEADER BANNER */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-xl">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                Warung J&J Rider 🛵
              </h1>
              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                <span>{riderProfile?.name || sessionUser.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ONLINE / OFFLINE TOGGLE */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl">
              <span className={`text-[10px] font-mono font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isOnline ? '🟢 ON' : '⚪ REHAT'}
              </span>
              <Switch
                checked={isOnline}
                onCheckedChange={setIsOnline}
                className="data-[state=checked]:bg-emerald-600 scale-75"
              />
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 w-8 h-8 rounded-xl"
              title="Log Keluar"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* ACTIVE DUTY STATUS CARD */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 p-4 rounded-3xl shadow-xl flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Status Rider Semasa</span>
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              {isOnline ? '🟢 Sedia Menerima Pesanan' : '⚪ Sedang Rehat'}
            </span>
          </div>
          <Button
            size="sm"
            onClick={fetchDeliveryOrders}
            disabled={loadingJobs}
            className="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-emerald-400 text-xs rounded-xl h-8 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingJobs ? 'animate-spin' : ''}`} />
            <span>Muat Semula</span>
          </Button>
        </div>

        {/* TABS NAVIGATION */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 bg-slate-900 p-1 rounded-2xl border border-slate-800 h-11 w-full font-mono">
            <TabsTrigger value="jobs" className="text-xs font-bold rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white relative">
              <span>🛵 Sedia ({availableJobs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs font-bold rounded-xl data-[state=active]:bg-sky-600 data-[state=active]:text-white">
              <span>📦 Aktif {activeJob ? '🔴' : ''}</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs font-bold rounded-xl data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              <span>💰 Dompet</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AVAILABLE JOBS */}
          <TabsContent value="jobs" className="space-y-3 pt-3">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Pesanan Delivery Siap Masak</span>
              <span>{availableJobs.length} Tersedia</span>
            </div>

            {loadingJobs ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Mencari pesanan terkini...</span>
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/80 rounded-3xl border border-slate-800 text-slate-400 font-mono space-y-2">
                <Bike className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">Tiada pesanan delivery baru buat masa ini.</p>
                <p className="text-[10px] text-slate-500">Sistem akan automatik berbunyi & mengemaskini apabila pelanggan membuat pesanan baru.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <Card key={job.id} className="bg-slate-900 border-2 border-emerald-500/30 text-white rounded-3xl shadow-xl overflow-hidden font-mono">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold block">ORDER #{job.id.slice(0, 8).toUpperCase()}</span>
                          <h3 className="font-bold text-white text-sm">👤 {job.customer_name || 'Pelanggan'}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Upah Delivery</span>
                          <span className="text-base font-black text-emerald-400">
                            RM {(job.delivery_fee || 6.00).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 text-slate-200">{job.delivery_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Dipesan pada {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <Button
                        disabled={isClaiming === job.id || !isOnline}
                        onClick={() => handleClaimJob(job)}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
                      >
                        {isClaiming === job.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>⚡ AMBIL TUGASAN INI (CLAIM)</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ACTIVE JOB */}
          <TabsContent value="active" className="space-y-3 pt-3">
            {!activeJob ? (
              <div className="p-8 text-center bg-slate-900/80 rounded-3xl border border-slate-800 text-slate-400 font-mono space-y-2">
                <Truck className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">Anda tiada pesanan aktif yang sedang dihantar.</p>
                <p className="text-[10px] text-slate-500">Sila pilih pesanan dari tab "Sedia" untuk mula menghantar.</p>
              </div>
            ) : (
              <Card className="bg-slate-900 border-2 border-sky-500 text-white rounded-3xl shadow-2xl overflow-hidden font-mono">
                <div className="bg-sky-500 text-slate-950 font-black text-xs px-4 py-2 flex justify-between items-center">
                  <span>SEDANG DIHANTAR 🛵</span>
                  <span>#{activeJob.id.slice(0, 8).toUpperCase()}</span>
                </div>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Penerima Pesanan</span>
                    <h3 className="text-lg font-black text-white">{activeJob.customer_name}</h3>
                    <p className="text-xs text-sky-400 font-bold">{activeJob.customer_phone}</p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2 text-xs">
                    <span className="text-[10px] text-slate-400 block uppercase">Alamat Penghantaran:</span>
                    <p className="text-slate-200 font-medium leading-relaxed">{activeJob.delivery_address}</p>
                  </div>

                  {/* QUICK 1-CLICK ACTION BUTTONS */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => openNavigation(activeJob.delivery_address || '', activeJob.delivery_lat, activeJob.delivery_lng)}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Buka Maps / Waze</span>
                    </Button>

                    <Button
                      onClick={() => contactWhatsApp(activeJob.customer_phone || '', activeJob.customer_name || '', activeJob.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Pelanggan</span>
                    </Button>
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <div className="flex justify-between items-center text-xs mb-3">
                      <span className="text-slate-400">Upah Trip Ini:</span>
                      <span className="font-black text-base text-emerald-400">
                        RM {(activeJob.delivery_fee || 6.00).toFixed(2)}
                      </span>
                    </div>

                    <Button
                      onClick={() => handleCompleteJob(activeJob.id)}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-98 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5 text-slate-950" />
                      <span>SAHKAN PESANAN TELAH DIHANTAR ✅</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3: WALLET & EARNINGS */}
          <TabsContent value="wallet" className="space-y-4 pt-3 font-mono">
            {/* EARNINGS SUMMARY CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3 shadow-2xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Wallet className="w-4 h-4" />
                <span>Dompet Pendapatan Rider</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">Jumlah Upah Terkumpul Hari Ini</span>
                <span className="text-3xl font-black text-emerald-400">
                  RM {totalEarningsToday.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Trip Selesai:</span>
                  <span className="text-white font-bold">{completedJobs.length} Trip</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Kadar Purata:</span>
                  <span className="text-white font-bold">RM 6.00 / Trip</span>
                </div>
              </div>
            </div>

            {/* COMPLETED TRIPS LIST */}
            <div className="space-y-2">
              <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                Rekod Penghantaran Selesai
              </h3>

              {completedJobs.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-500">
                  Belum ada rekod trip yang selesai hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedJobs.map((job) => (
                    <div key={job.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white block">#{job.id.slice(0, 8).toUpperCase()} - {job.customer_name}</span>
                        <span className="text-[10px] text-slate-500 line-clamp-1">{job.delivery_address}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-black text-emerald-400 block">+RM {(job.delivery_fee || 6.00).toFixed(2)}</span>
                        <span className="text-[9px] text-emerald-500/80">✓ Selesai</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

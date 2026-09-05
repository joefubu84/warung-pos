
function calculateHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Truck, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  Navigation, 
  MessageCircle, 
  Wallet, 
  LogOut, 
  Lock, 
  Mail, 
  RefreshCw, 
  ChevronRight, 
  Store,
  ArrowRight,
  Shield,
  Bike,
  Check,
  Smartphone,
  Calendar,
  TrendingUp,
  Coins,
  Landmark,
  ArrowUpRight,
  Receipt,
  CreditCard,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryRouteMap, WARUNG_COORDS } from '@/components/DeliveryRouteMap';
import { acceptJob } from '@/lib/riders';
import { sendRiderDeliveryWhatsAppNotification } from '@/lib/whatsapp-otp';

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
  delivery_status?: string | null;
  created_at: string;
  delivery_service?: string | null;
  notes?: string | null;
  order_items?: any[];
}

const IS_RIDER_ENABLED = false;

function RiderPortalPage() {
  const navigate = useNavigate();

  // Maintenance screen if rider portal is temporarily closed
  if (!IS_RIDER_ENABLED) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-orange-500/20">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto border border-orange-200 shadow-sm">
            <Truck className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
              Portal Rider Ditutup Sementara
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Perkhidmatan penghantaran dan sistem penugasan rakan rider Warung J&J sedang ditutup buat sementara waktu untuk penambahbaikan & penyelenggaraan sistem.
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-900">Warung J&J • Penampang, Sabah</p>
            <p className="text-[11px] text-slate-500">Sila hubungi pihak pengurusan warung untuk sebarang maklumat lanjut.</p>
          </div>
          <Link to="/">
            <Button variant="outline" className="w-full h-11 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-sm font-heading cursor-pointer">
              Kembali ke Laman Utama
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Auth & Profile State
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [riderProfile, setRiderProfile] = useState<{
    id: string;
    rider_db_id?: string;
    name: string;
    phone_number?: string;
    role: string;
    is_approved: boolean;
    vehicle_plate?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_holder?: string;
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
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('warung_rider_is_online') : null;
    return saved !== null ? saved === 'true' : true;
  });
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [activeJob, setActiveJob] = useState<DeliveryJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<DeliveryJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'wallet'>('jobs');
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [previewRouteJobId, setPreviewRouteJobId] = useState<string | null>(null);
  const [earningsFilter, setEarningsFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Screen Wake Lock State (Keeps screen awake during active delivery/online mode)
  const wakeLockRef = useRef<any>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);

  // PWA / APK Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('🎉 Aplikasi Warung J&J Rider berjaya dipasang pada telefon anda!');
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  // Computed approval status
  const isApproved = Boolean(riderProfile?.is_approved);

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
      // If it is the test rider account
      if (userId === 'rider-test-account-jnj') {
        setRiderProfile({
          id: 'rider-test-account-jnj',
          rider_db_id: 'rider-test-account-jnj',
          name: 'Rider Test Warung J&J',
          phone_number: '0123456789',
          role: 'rider',
          is_approved: true,
        });
        setIsOnline(true);
        setIsLoadingAuth(false);
        return;
      }

      // 1. Fetch user profile
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, phone, role')
        .eq('id', userId)
        .maybeSingle();

      // 2. Fetch rider table row for is_approved & status
      let { data: riderRow } = await supabase
        .from('riders')
        .select('id, status, is_approved, user_id')
        .or(`user_id.eq.${userId},id.eq.${userId}`)
        .maybeSingle();

      // 3. Fallback check: If rider has role 'rider', KYC verified, or is_approved
      let approved = riderRow?.is_approved ?? (userData?.role === 'rider' || true);

      // Auto-heal / sync riders table
      if (approved) {
        if (riderRow) {
          if (!riderRow.is_approved) {
            await supabase.from('riders').update({ is_approved: true } as any).eq('id', riderRow.id);
            riderRow.is_approved = true;
          }
        } else {
          const { data: inserted } = await supabase.from('riders').insert({
            user_id: userId,
            is_approved: true,
            status: 'available',
            updated_at: new Date().toISOString()
          } as any).select('id, status, is_approved, user_id').maybeSingle();
          if (inserted) {
            riderRow = inserted;
          }
        }
      }

      const savedOnline = typeof window !== 'undefined' ? localStorage.getItem('warung_rider_is_online') : null;
      const initialOnline = savedOnline !== null ? savedOnline === 'true' : true;

      // Load KYC bank details from store settings
      let kycBankInfo: any = null;
      try {
        const { data: storeRes } = await supabase.from('stores').select('settings').limit(1).maybeSingle();
        const kycList = (storeRes?.settings as any)?.verified_riders || [];
        kycBankInfo = kycList.find((k: any) => k.userId === userId || k.id === userId || k.email === sessionUser?.email);
      } catch (storeErr) {
        console.warn('KYC bank fetch note:', storeErr);
      }

      setRiderProfile({
        id: userData?.id || userId,
        rider_db_id: riderRow?.id || userData?.id || userId,
        name: kycBankInfo?.fullName || userData?.name || sessionUser?.user_metadata?.name || 'Rider J&J',
        phone_number: kycBankInfo?.phone || userData?.phone || sessionUser?.user_metadata?.phone_number || '',
        role: userData?.role || 'rider',
        is_approved: approved,
        vehicle_plate: kycBankInfo?.vehiclePlate || 'Motosikal',
        bank_name: kycBankInfo?.bankName || 'Maybank',
        bank_account_number: kycBankInfo?.bankAccountNumber || '',
        bank_account_holder: kycBankInfo?.bankAccountHolder || kycBankInfo?.fullName || userData?.name || '',
      });

      if (approved) {
        setIsOnline(initialOnline);
        if (riderRow?.id && riderRow.status !== (initialOnline ? 'available' : 'offline')) {
          supabase
            .from('riders')
            .update({ status: initialOnline ? 'available' : 'offline', updated_at: new Date().toISOString() } as any)
            .eq('id', riderRow.id)
            .then(() => {});
        }
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
      const claimedLocalId = localStorage.getItem('warung_rider_claimed_order_id');

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('type', 'delivery')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && orders) {
        const available: DeliveryJob[] = [];
        const completed: DeliveryJob[] = [];
        let active: DeliveryJob | null = null;

        const currentRiderId = riderProfile?.rider_db_id || sessionUser.id;

        orders.forEach((ord: any) => {
          const isClaimedByMe = ord.id === claimedLocalId;
          const isMyDeliveredOrder =
            ord.delivery_service === currentRiderId ||
            ord.delivery_service === sessionUser.id ||
            ord.delivery_service === 'jnj' ||
            isClaimedByMe;
          
          // ANTI-SCAM GATING: Only dispatch jobs to riders once customer has PAID and Warung JNJ verified payment!
          const isVerifiedPaid = ord.payment_status === 'paid' || ord.status === 'confirmed' || ord.status === 'preparing' || ord.status === 'ready';
          const isUnverifiedPayment = ord.payment_status === 'pending' || ord.status === 'pending_payment' || ord.status === 'pending_verification';

          if (ord.status === 'completed') {
            if (isMyDeliveredOrder) {
              completed.push(ord);
            }
          } else if (isVerifiedPaid && !isUnverifiedPayment) {
            if (isClaimedByMe) {
              const savedMilestone = localStorage.getItem('warung_rider_milestone_' + ord.id);
              active = {
                ...ord,
                delivery_status: (savedMilestone as any) || 'dispatched'
              };
            } else {
              // Verified paid orders are available for riders to pick up
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
    return undefined;
  }, [sessionUser]);

  // Realtime Live GPS Broadcast (Every 3-5 seconds without database writes)
  useEffect(() => {
    if (!sessionUser || !isOnline || !activeJob) return;

    const locationChannel = supabase.channel('live-locations');
    locationChannel.subscribe();

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          locationChannel.send({
            type: 'broadcast',
            event: 'location-update',
            payload: {
              rider_id: riderProfile?.rider_db_id || sessionUser.id,
              order_id: activeJob.id,
              lat: latitude,
              lng: longitude,
              timestamp: Date.now()
            }
          });
        },
        (err) => console.warn('GPS Broadcast notice:', err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 4000 }
      );
    }

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchId);
      }
      supabase.removeChannel(locationChannel);
    };
  }, [sessionUser, isOnline, activeJob, riderProfile]);

  // Screen Wake Lock Auto Management (Keeps phone screen lit while Online or Delivering)
  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          if (wakeLockRef.current !== null) return;
          const lock = await (navigator as any).wakeLock.request('screen');
          if (isMounted) {
            wakeLockRef.current = lock;
            setIsWakeLockActive(true);
            console.log('📱 Screen Wake Lock aktif: Skrin peranti rider tidak akan padam.');
            lock.addEventListener('release', () => {
              if (isMounted) {
                wakeLockRef.current = null;
                setIsWakeLockActive(false);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Screen Wake Lock notice:', err);
      }
    };

    const releaseWakeLock = async () => {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          if (isMounted) setIsWakeLockActive(false);
        }
      } catch (err) {
        console.warn('Wake Lock release note:', err);
      }
    };

    // Auto re-acquire wake lock if rider switches apps and returns to browser
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (isOnline || activeJob)) {
        requestWakeLock();
      }
    };

    if (isOnline || activeJob) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isOnline, activeJob]);

  // Handle Online Toggle (Gated by is_approved)
  const handleToggleOnline = async (val: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('warung_rider_is_online', val ? 'true' : 'false');
    }
    setIsOnline(val);
    try {
      if (riderProfile?.rider_db_id && riderProfile.rider_db_id !== 'rider-test-account-jnj') {
        await supabase
          .from('riders')
          .update({ status: val ? 'available' : 'offline', updated_at: new Date().toISOString() } as any)
          .eq('id', riderProfile.rider_db_id);
      }
      toast.success(val ? '🟢 Status: ONLINE (Sedia menerima tugasan)' : '⏸️ Status: REHAT / OFFLINE');
    } catch (err) {
      console.warn('Update online status error:', err);
    }
  };

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
        const { data: storeRes } = await supabase.from('stores').select('id').limit(1).maybeSingle();
        await supabase.from('users').upsert({
          id: authRes.user.id,
          name: regName,
          phone: regPhone,
          role: 'rider' as any,
          store_id: storeRes?.id || '',
        });

        // Create rider record with is_approved = false (Pending approval)
        await supabase.from('riders').upsert({
          user_id: authRes.user.id,
          store_id: storeRes?.id || '',
          status: 'offline' as any,
          is_approved: false
        } as any);

        toast.success('Pendaftaran Rakan Penghantar Berjaya! Sila tunggu kelulusan admin.');
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
      // Check for test rider shortcut
      if (loginEmail === 'rider.test@warungjnj.online') {
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
        setSessionUser(testUser);
        setRiderProfile({
          id: 'rider-test-account-jnj',
          rider_db_id: 'rider-test-account-jnj',
          name: 'Rider Test Warung J&J',
          phone_number: '0123456789',
          role: 'rider',
          is_approved: true,
        });
        setIsOnline(true);
        toast.success('Selamat bertugas, Rider Test Warung J&J!');
        await fetchDeliveryOrders();
        return;
      }

      const { data: authRes, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authErr) throw authErr;

      if (authRes.user) {
        toast.success('Selamat bertugas!');
        setSessionUser(authRes.user);
        await fetchRiderProfile(authRes.user.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Log masuk gagal. Sila semak emel & kata laluan.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // 1-Click Fast Test Rider Login
  const handleTestRiderLogin = async () => {
    setIsAuthSubmitting(true);
    try {
      const testUserId = 'rider-test-account-jnj';
      const testUser = {
        id: testUserId,
        email: 'rider.test@warungjnj.online',
        user_metadata: {
          name: 'Rider Test Warung J&J',
          phone_number: '0123456789',
          role: 'rider',
        },
      };
      localStorage.setItem('warung_test_rider_active', 'true');
      setSessionUser(testUser);
      setRiderProfile({
        id: testUserId,
        rider_db_id: testUserId,
        name: 'Rider Test Warung J&J',
        phone_number: '0123456789',
        role: 'rider',
        is_approved: true,
      });
      setIsOnline(true);
      toast.success('⚡ Log Masuk Rider Ujian Berjaya! Selamat bertugas.');
      await fetchDeliveryOrders();
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    localStorage.removeItem('warung_test_rider_active');
    await supabase.auth.signOut();
    setSessionUser(null);
    setRiderProfile(null);
    setAuthMode('login');
    toast.info('Anda telah log keluar.');
  };

  // Spawn Simulated Test Delivery Order
  const handleSpawnSimulatedOrder = () => {
    const mockId = 'mock-del-' + Date.now().toString().slice(-6);
    const mockOrder: DeliveryJob = {
      id: mockId,
      customer_name: 'Encik Farhan (Pelanggan Ujian)',
      customer_phone: '0198887766',
      delivery_address: 'No. 12, Lorong Selasih 3, Taman Penampang, 89500 Penampang, Sabah',
      delivery_fee: 6.00,
      total_amount: 38.50,
      status: 'ready',
      created_at: new Date().toISOString(),
      notes: 'Sila hantar di pagar depan rumah, sambal ekstra pedas.',
      order_items: [
        { id: '1', name: 'Nasi Lemak Ayam Berempah', quantity: 2, price: 13.00, notes: 'Ekstra sambal' },
        { id: '2', name: 'Teh Tarik Kaw', quantity: 2, price: 3.25 },
      ] as any,
    };

    setAvailableJobs(prev => [mockOrder, ...prev]);
    toast.success('🧪 Pesanan penghantaran ujian berjaya dicipta! Sila klik "Terima Tugasan" untuk mencuba.');
  };

  // Claim Delivery Job (Atomic Job Acceptance)
  const handleClaimJob = async (job: DeliveryJob) => {
    if (!sessionUser) return;
    setIsClaiming(job.id);

    try {
      // 1. Immediately track job as active for this rider
      localStorage.setItem('warung_rider_claimed_order_id', job.id);
      setActiveJob(job);
      setAvailableJobs(prev => prev.filter(j => j.id !== job.id));

      // 2. Perform backend assignment in background
      try {
        await acceptJob(riderProfile?.rider_db_id || sessionUser.id, job.id);
      } catch (backendErr) {
        console.warn('Backend acceptJob notification:', backendErr);
      }

      toast.success(`🎉 Pesanan #${job.id.slice(0, 8).toUpperCase()} berjaya diterima! Sila ambil di Warung J&J.`);
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
      localStorage.removeItem('warung_rider_claimed_order_id');

      if (jobId.startsWith('mock-del-')) {
        // In-memory simulation
        if (activeJob && activeJob.id === jobId) {
          setCompletedJobs(prev => [{ ...activeJob, status: 'completed' as any }, ...prev]);
          setActiveJob(null);
          toast.success('🎉 Penghantaran selesai! RM 6.00 dimasukkan ke dalam dompet rider.');
          setActiveTab('wallet');
          return;
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      toast.success('🎉 Penghantaran selesai! Upah dimasukkan ke dalam dompet pendapatan.');
      await fetchDeliveryOrders();
      setActiveTab('wallet');
    } catch (err: any) {
      toast.error(err.message || 'Ralat mengesahkan penghantaran.');
    }
  };

  // 3-Step Milestone Progression Handler (with zero-cost WhatsApp notification & live tracking)
  const handleUpdateMilestone = async (newStatus: 'picked_up' | 'arrived' | 'completed') => {
    if (!activeJob) return;

    try {
      const extraInfo = {
        customerName: activeJob.customer_name || 'Pelanggan',
        riderName: riderProfile?.name || 'Rider Warung J&J',
        riderPhone: riderProfile?.phone_number || '',
        address: getCleanDeliveryAddress(activeJob.delivery_address)
      };

      if (newStatus === 'completed') {
        localStorage.removeItem('warung_rider_milestone_' + activeJob.id);
        await handleCompleteJob(activeJob.id);
        sendRiderDeliveryWhatsAppNotification('completed', activeJob.customer_phone || '', activeJob.id, extraInfo);
        return;
      }

      // Save milestone locally in state & browser storage
      localStorage.setItem('warung_rider_milestone_' + activeJob.id, newStatus);
      setActiveJob(prev => prev ? { ...prev, delivery_status: newStatus, status: 'ready' } : null);

      if (!activeJob.id.startsWith('mock-del-')) {
        // Safe backend sync using valid orders table schema
        try {
          if (newStatus === 'picked_up') {
            await supabase
              .from('orders')
              .update({
                status: 'ready',
                delivery_status: 'picked_up',
                ready_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              } as any)
              .eq('id', activeJob.id);
          } else if (newStatus === 'arrived') {
            await supabase
              .from('orders')
              .update({
                status: 'ready',
                delivery_status: 'arrived',
                updated_at: new Date().toISOString()
              } as any)
              .eq('id', activeJob.id);
          }
        } catch (dbErr) {
          console.warn('Milestone database sync note:', dbErr);
        }
      }

      toast.success(newStatus === 'picked_up' ? '🍱 Pesanan telah diambil dari warung!' : '🛵 Anda telah tiba di lokasi pelanggan!');
      sendRiderDeliveryWhatsAppNotification(newStatus, activeJob.customer_phone || '', activeJob.id, extraInfo);
    } catch (err: any) {
      toast.error('Gagal mengemas kini status: ' + err.message);
    }
  };

  // Helper to extract clean address without internal fee tags for maps and UI
  const getCleanDeliveryAddress = (address: string | null): string => {
    if (!address) return 'Penampang, Sabah';
    return address.replace(/\s*\[(?:TAMBANG|FEE|UPAH|JARAK|DISTANCE):[^\]]+\]/gi, '').trim();
  };

  // Helper to extract distance badge
  const getDistanceBadge = (address: string | null): string | null => {
    if (!address) return null;
    const match = address.match(/JARAK:\s*([0-9.]+\s*KM)/i);
    return match?.[1] ?? null;
  };

  // Navigation
  const openNavigation = (address: string, lat?: number | null, lng?: number | null) => {
    const cleanAddr = getCleanDeliveryAddress(address);
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddr + ', Sabah, Malaysia')}`, '_blank');
    }
  };

  // WhatsApp with Live Tracking Link
  const contactWhatsApp = (phone: string, customerName: string, orderId: string) => {
    sendRiderDeliveryWhatsAppNotification('contact_customer', phone, orderId, {
      customerName,
      riderName: riderProfile?.name || 'Rider Warung J&J',
      riderPhone: riderProfile?.phone_number || '',
      address: getCleanDeliveryAddress(activeJob?.delivery_address || '')
    });
  };

  // Accurate Delivery Fee Resolver (From actual map road distance tag or DB or live coordinates)
  const getJobDeliveryFee = (job: DeliveryJob): number => {
    // 1. Check if delivery_address has encoded fee tag e.g. [TAMBANG:RM6.60|JARAK:6.6KM]
    if (job.delivery_address) {
      const feeMatch = job.delivery_address.match(/\[(?:TAMBANG|FEE|UPAH):RM\s*([0-9.]+)\]/i);
      if (feeMatch && feeMatch[1]) {
        return parseFloat(feeMatch[1]);
      }
      const distMatch = job.delivery_address.match(/JARAK:\s*([0-9.]+)\s*KM/i);
      if (distMatch && distMatch[1]) {
        const km = parseFloat(distMatch[1]);
        return Math.max(Math.round(km * 1.00 * 100) / 100, 2.00);
      }
    }
    // 2. Check explicit database fee (if realistic and > 2.00)
    if (job.delivery_fee != null && Number(job.delivery_fee) > 2.00) {
      return Number(job.delivery_fee);
    }
    // 3. Fallback coordinates calculation (from actual road distance)
    if (job.delivery_lat && job.delivery_lng) {
      const WARUNG_LAT = 5.9284153;
      const WARUNG_LNG = 116.1146463;
      const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, job.delivery_lat, job.delivery_lng);
      const roadKm = Math.round(straightKm * 1.35 * 10) / 10;
      return Math.max(Math.round(roadKm * 1.00 * 100) / 100, 2.00);
    }
    // 4. Return database fee if available, otherwise default
    if (job.delivery_fee != null && Number(job.delivery_fee) > 0) {
      return Number(job.delivery_fee);
    }
    return 6.00;
  };

  // Extract Numeric Distance in KM for statistics
  const getJobDistanceKm = (job: DeliveryJob): number => {
    if (job.delivery_address) {
      const distMatch = job.delivery_address.match(/JARAK:\s*([0-9.]+)\s*KM/i);
      if (distMatch && distMatch[1]) {
        return parseFloat(distMatch[1]);
      }
    }
    if (job.delivery_lat && job.delivery_lng) {
      const WARUNG_LAT = 5.9284153;
      const WARUNG_LNG = 116.1146463;
      const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, job.delivery_lat, job.delivery_lng);
      return Math.round(straightKm * 1.35 * 10) / 10;
    }
    return 3.5;
  };

  // Filter Completed Jobs by Selected Period (Today, 7 Days, Month, All)
  const filteredCompletedJobs = completedJobs.filter((job) => {
    const jobDate = new Date(job.created_at || new Date().toISOString());
    const now = new Date();

    if (earningsFilter === 'today') {
      return jobDate.toDateString() === now.toDateString();
    } else if (earningsFilter === 'week') {
      const diffMs = now.getTime() - jobDate.getTime();
      return diffMs <= 7 * 24 * 3600 * 1000;
    } else if (earningsFilter === 'month') {
      return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
    }
    return true; // 'all'
  });

  const periodEarnings = filteredCompletedJobs.reduce((sum, j) => sum + getJobDeliveryFee(j), 0);
  const periodTrips = filteredCompletedJobs.length;
  const periodAvg = periodTrips > 0 ? periodEarnings / periodTrips : 0;
  const periodDistance = filteredCompletedJobs.reduce((sum, j) => sum + getJobDistanceKm(j), 0);

  // 1. AUTHENTICATION VIEW (CLEAN WARUNG BRANDING)
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-orange-500/20">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          
          {/* WARUNG J&J OFFICIAL LOGO HEADER */}
          <div className="text-center space-y-3">
            <div className="inline-block p-1 bg-gradient-to-b from-orange-100 to-transparent rounded-full shadow-sm">
              <img 
                src="/warung-logo.png" 
                alt="Warung J&J" 
                className="w-20 h-20 rounded-full object-cover border-2 border-orange-400 shadow-inner mx-auto"
              />
            </div>
            
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                Rakan Penghantar J&J
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Warung J&J • Penampang, Sabah
              </p>
            </div>
          </div>

          {/* MANUAL LOGIN FORM */}
          <form onSubmit={handleLoginRider} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Emel Rider</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="rider@warungjnj.online"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-slate-50 border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 pl-10 h-11 text-xs rounded-xl text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Kata Laluan</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-slate-50 border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 pl-10 h-11 text-xs rounded-xl text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer font-heading"
            >
              {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Masuk Rider'}
            </Button>

            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleInstallApp}
                className="text-slate-500 hover:text-orange-600 text-xs font-semibold flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pasang Aplikasi Rider (APK / Telefon)</span>
              </Button>
            </div>
          </form>

          {/* INSTALL APP MODAL ON LOGIN */}
          <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
            <DialogContent className="sm:max-w-[420px] bg-white text-slate-800 border-slate-200 p-6 rounded-3xl shadow-2xl">
              <DialogHeader className="text-center space-y-2.5 pb-1">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto border border-orange-100 shadow-sm">
                  <Download className="w-7 h-7" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 font-heading">
                  Pasang Aplikasi Rider J&J 📲
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                  Pasang portal rider terus ke skrin utama telefon anda untuk menerima tugasan penghantaran serta-merta!
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-3">
                  <p className="font-bold text-orange-600 flex items-center gap-1.5 font-heading">
                    <span>📱 Android / Chrome:</span>
                  </p>
                  <ol className="space-y-2 text-slate-600 list-decimal list-inside text-[11px] leading-relaxed">
                    <li>Tekan butang menu <strong>(Titik Tiga ⋮)</strong> di bahagian atas kanan Chrome.</li>
                    <li>Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen" (Tambah ke skrin utama)</strong>.</li>
                    <li>Ikon <strong>Warung J&J Rider</strong> akan muncul seperti aplikasi native di telefon anda!</li>
                  </ol>
                </div>

                <Button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-2xl shadow-md active:scale-95 transition-all text-xs font-heading cursor-pointer"
                >
                  Faham & Tutup
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED RIDER DASHBOARD (FAUNA KITCHEN LIGHT EDITORIAL THEME)
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-24 selection:bg-orange-500/20">
      
      {/* BRANDED HEADER */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/warung-logo.png" 
              alt="Warung J&J Logo" 
              className="w-10 h-10 rounded-full object-cover border border-orange-200 shadow-sm"
            />
            <div>
              <h1 className="font-bold text-sm text-slate-900 leading-tight">
                Warung J&J Delivery
              </h1>
              <p className="text-[11px] font-semibold text-orange-600 font-sans">
                {riderProfile?.name || sessionUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* ONLINE / OFFLINE TOGGLE (GATED BY is_approved) */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
              <span className={`text-[10px] font-bold ${!isApproved ? 'text-amber-600' : isOnline ? 'text-emerald-700' : 'text-slate-500'}`}>
                {!isApproved ? 'PENDING' : isOnline ? 'ONLINE' : 'REHAT'}
              </span>
              <Switch
                checked={isOnline}
                disabled={!isApproved}
                onCheckedChange={handleToggleOnline}
                className="data-[state=checked]:bg-emerald-600 scale-75 disabled:opacity-40"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInstallApp}
              className="bg-white border-slate-200 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px] shadow-xs"
              title="Pasang Aplikasi Warung J&J Rider"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>App</span>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleSignOut}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 w-8 h-8 rounded-xl"
              title="Log Keluar"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        
        {/* PENDING APPROVAL ALERT BANNER */}
        {!isApproved && (
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Akaun Menunggu Kelulusan Admin</p>
              <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                Akaun rider anda belum diluluskan oleh pengurusan Warung J&J. Suis mod <strong>ONLINE</strong> akan dibuka secara automatik selepas kelulusan diberikan.
              </p>
            </div>
          </div>
        )}

        {/* STATUS CARD */}
        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl flex items-center justify-between text-xs gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${!isApproved ? 'bg-amber-500' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <div className="min-w-0">
              <span className="text-slate-700 font-medium block truncate">
                {!isApproved ? 'Akaun Menunggu Kelulusan Admin' : isOnline ? 'Sedia menerima tugasan penghantaran' : 'Status: Sedang Berehat'}
              </span>
              {isWakeLockActive && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                  <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Skrin Sentiasa Menyala (Wake Lock ON)</span>
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={fetchDeliveryOrders}
            disabled={loadingJobs}
            className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs rounded-xl h-7 px-2.5 gap-1 shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${loadingJobs ? 'animate-spin' : ''}`} />
            <span>Kemas Kini</span>
          </Button>
        </div>

        {/* NAVIGATION TABS */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-2xl border border-slate-200 h-11 w-full">
            <TabsTrigger value="jobs" className="text-xs font-semibold rounded-xl text-slate-600 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              Tugasan ({availableJobs.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs font-semibold rounded-xl text-slate-600 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              Aktif {activeJob ? '•' : ''}
            </TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs font-semibold rounded-xl text-slate-600 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">
              Pendapatan
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AVAILABLE JOBS */}
          <TabsContent value="jobs" className="space-y-3 pt-3">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Pesanan Sedia Untuk Dihantar</span>
              <span>{availableJobs.length} pesanan</span>
            </div>

            {loadingJobs ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                <span>Memeriksa pesanan baru...</span>
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/90 text-slate-500 space-y-2 shadow-xs">
                <Store className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-xs font-semibold text-slate-800">Tiada pesanan baru untuk dihantar buat masa ini.</p>
                <p className="text-[11px] text-slate-500">Pesanan dari kaunter & dapur akan dipaparkan di sini secara automatik apabila sedia untuk dihantar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <Card key={job.id} className="bg-white border border-slate-200/90 text-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                        <div>
                          <span className="text-[10px] text-orange-600 font-mono font-bold block">
                            #{job.id.slice(0, 8).toUpperCase()}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">{job.customer_name || 'Pelanggan'}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Upah Penghantaran</span>
                          <span className="text-base font-bold text-emerald-600 font-mono">
                            RM {getJobDeliveryFee(job).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* ROUTE INFO */}
                      <div className="space-y-2 text-xs text-slate-700">
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span>Ambil: <strong className="text-slate-800">Warung J&J (Penampang)</strong></span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-800 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="line-clamp-2">{getCleanDeliveryAddress(job.delivery_address)}</span>
                            {getDistanceBadge(job.delivery_address) && (
                              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md font-semibold">
                                📍 {getDistanceBadge(job.delivery_address)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* TOGGLE PREVIEW REAL ROAD MAP */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewRouteJobId(prev => prev === job.id ? null : job.id)}
                          className="text-[11px] font-mono text-sky-600 hover:text-sky-700 flex items-center gap-1.5 py-1 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-sky-600" />
                          <span>{previewRouteJobId === job.id ? 'Sembunyikan Peta Laluan' : '📍 Papar Peta Laluan Jalan Raya'}</span>
                        </button>

                        {previewRouteJobId === job.id && (
                          <div className="mt-2 animate-fade-in">
                            <DeliveryRouteMap
                              origin={WARUNG_COORDS}
                              destination={{
                                lat: job.delivery_lat || 5.9141659,
                                lng: job.delivery_lng || 116.085516,
                                address: getCleanDeliveryAddress(job.delivery_address)
                              }}
                              height="220px"
                              showZoneCircle={false}
                              showNavigationButtons={true}
                              interactive={false}
                            />
                          </div>
                        )}
                      </div>

                      <Button
                        disabled={isClaiming === job.id || !isOnline}
                        onClick={() => handleClaimJob(job)}
                        className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                      >
                        {isClaiming === job.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>Ambil Tugasan Ini</span>
                            <ArrowRight className="w-3.5 h-3.5" />
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
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/90 text-slate-500 space-y-2 shadow-xs">
                <Truck className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-xs font-semibold text-slate-800">Tiada tugasan aktif pada masa ini.</p>
                <p className="text-[11px] text-slate-500">Pilih mana-mana pesanan dari senarai "Tugasan" untuk mula menghantar.</p>
              </div>
            ) : (
              <Card className="bg-white border-2 border-orange-400/80 text-slate-800 rounded-3xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs px-4 py-2.5 flex justify-between items-center shadow-xs">
                  <span>DALAM PENGHANTARAN</span>
                  <span className="font-mono">#{activeJob.id.slice(0, 8).toUpperCase()}</span>
                </div>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Penerima</span>
                    <h3 className="text-base font-bold text-slate-900">{activeJob.customer_name}</h3>
                    <p className="text-xs text-orange-600 font-mono font-semibold">{activeJob.customer_phone}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Alamat Penghantaran:</span>
                      {getDistanceBadge(activeJob.delivery_address) && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md font-semibold">
                          📍 {getDistanceBadge(activeJob.delivery_address)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed">{getCleanDeliveryAddress(activeJob.delivery_address)}</p>
                  </div>

                  {/* REAL-ROAD INTERACTIVE ROUTE MAP FOR RIDER */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider block font-bold">
                      🗺️ Peta Pandu Arah Laluan Sebenar:
                    </span>
                    <DeliveryRouteMap
                      origin={WARUNG_COORDS}
                      destination={{
                        lat: activeJob.delivery_lat || 5.9141659,
                        lng: activeJob.delivery_lng || 116.085516,
                        address: getCleanDeliveryAddress(activeJob.delivery_address)
                      }}
                      height="260px"
                      showZoneCircle={false}
                      showNavigationButtons={true}
                      interactive={false}
                    />
                  </div>

                  {/* QUICK 1-CLICK NAVIGATION / WHATSAPP */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => openNavigation(activeJob.delivery_address || '', activeJob.delivery_lat, activeJob.delivery_lng)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-600" />
                      <span>Buka Google Maps</span>
                    </Button>

                    <Button
                      onClick={() => contactWhatsApp(activeJob.customer_phone || '', activeJob.customer_name || '', activeJob.id)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>

                  {/* 3-STEP PROGRESSIVE MILESTONES (FALLBACK GPS & WHATSAPP NOTIFICATION) */}
                  <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs mb-1 font-mono">
                      <span className="text-slate-600">Upah Pesanan:</span>
                      <span className="font-bold text-base text-emerald-600">
                        RM {getJobDeliveryFee(activeJob).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <span className="text-[11px] font-bold text-orange-600 block uppercase tracking-wider">
                        🚀 Tindakan Kemajuan Penghantaran:
                      </span>

                      {/* STEP 1: PICKED UP */}
                      {(!activeJob.delivery_status || activeJob.delivery_status === 'dispatched' || activeJob.delivery_status === 'preparing') && (
                        <Button
                          onClick={() => handleUpdateMilestone('picked_up')}
                          className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-between px-4 active:scale-[0.98] transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <span>🍱</span>
                            <span>1. Telah Diambil di Warung</span>
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}

                      {/* STEP 2: ARRIVED */}
                      {activeJob.delivery_status === 'picked_up' && (
                        <Button
                          onClick={() => handleUpdateMilestone('arrived')}
                          className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-between px-4 active:scale-[0.98] transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <span>🛵</span>
                            <span>2. Telah Tiba di Lokasi Pelanggan</span>
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}

                      {/* STEP 3: COMPLETED */}
                      {activeJob.delivery_status === 'arrived' && (
                        <Button
                          onClick={() => handleUpdateMilestone('completed')}
                          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-between px-4 active:scale-[0.98] transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>3. Selesai Serah & Terima Upah</span>
                          </span>
                          <Check className="w-4 h-4" />
                        </Button>
                      )}

                      <p className="text-[10px] text-slate-500 text-center pt-0.5">
                        * Tekan butang di atas untuk maklumkan pelanggan secara automatik (WhatsApp & Live Status).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3: WALLET & EARNINGS */}
          <TabsContent value="wallet" className="space-y-4 pt-3">
            
            {/* 1. PERIOD FILTER BUTTONS */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setEarningsFilter('today')}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  earningsFilter === 'today'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setEarningsFilter('week')}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  earningsFilter === 'week'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setEarningsFilter('month')}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  earningsFilter === 'month'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setEarningsFilter('all')}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
                  earningsFilter === 'all'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Semua
              </button>
            </div>

            {/* 2. EARNINGS OVERVIEW BENTO GRID */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-emerald-200/80 p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>
                    Upah Bersih Penghantaran ({earningsFilter === 'today' ? 'Hari Ini' : earningsFilter === 'week' ? '7 Hari Lepas' : earningsFilter === 'month' ? 'Bulan Ini' : 'Keseluruhan'})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                  Disahkan ✓
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono tracking-tight">
                    RM {periodEarnings.toFixed(2)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 block mt-1">
                  100% upah penghantaran adalah milik rider sepenuhnya tanpa caj tersembunyi.
                </span>
              </div>

              {/* 3 STATS PILLS */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-center">
                <div className="bg-white/80 p-2.5 rounded-2xl border border-emerald-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">Trip Selesai</span>
                  <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                    {periodTrips} <span className="text-[10px] font-normal text-slate-500">trip</span>
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-2xl border border-emerald-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">Purata / Trip</span>
                  <span className="text-sm font-bold text-orange-600 font-mono mt-0.5 block">
                    RM {periodAvg.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-2xl border border-emerald-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">Jarak Laluan</span>
                  <span className="text-sm font-bold text-sky-700 font-mono mt-0.5 block">
                    {periodDistance.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">KM</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. REGISTERED BANK ACCOUNT CARD */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-3xl space-y-2 text-xs shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 font-bold">
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  <span>Akaun Bank Penerima Gaji</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">Pindahan Mingguan / Harian</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Nama Bank:</span>
                  <span className="font-bold text-slate-900 block truncate">{riderProfile?.bank_name || 'Maybank'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">No. Akaun:</span>
                  <span className="font-bold text-emerald-700 font-mono block truncate">
                    {riderProfile?.bank_account_number ? riderProfile.bank_account_number : 'Belum Ditetapkan'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 block">Nama Pemegang Akaun:</span>
                  <span className="font-bold text-slate-800 block truncate">{riderProfile?.bank_account_holder || riderProfile?.name || 'Rider J&J'}</span>
                </div>
              </div>
            </div>

            {/* 4. DETAILED COMPLETED TRIPS LIST */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-orange-500" />
                  <span>Rekod Tugasan Selesai ({filteredCompletedJobs.length})</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {earningsFilter === 'today' ? 'Hari Ini' : earningsFilter === 'week' ? '7 Hari' : earningsFilter === 'month' ? 'Bulan Ini' : 'Semua'}
                </span>
              </div>

              {filteredCompletedJobs.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/90 text-xs text-slate-500 space-y-1 shadow-xs">
                  <Bike className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                  <p className="font-bold text-slate-800">Tiada rekod penghantaran bagi tempoh ini.</p>
                  <p className="text-[11px] text-slate-500">Tugasan yang diselesaikan akan direkodkan dan dijumlahkan di sini secara automatik.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCompletedJobs.map((job) => {
                    const fee = getJobDeliveryFee(job);
                    const distKm = getJobDistanceKm(job);
                    const completedDate = new Date(job.created_at || new Date().toISOString());
                    const timeStr = completedDate.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const dateStr = completedDate.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });

                    return (
                      <div
                        key={job.id}
                        className="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/90 rounded-2xl flex flex-col gap-2 transition-all shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-orange-600 text-xs">
                                #{job.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                • {dateStr}, {timeStr}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-xs truncate mt-0.5">
                              {job.customer_name || 'Pelanggan J&J'}
                            </h4>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-emerald-700 text-sm block font-mono">
                              +RM {fee.toFixed(2)}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              DITERIMA
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="truncate pr-2">
                            📍 {getCleanDeliveryAddress(job.delivery_address)}
                          </span>
                          <span className="font-bold text-sky-700 shrink-0 font-mono">
                            {distKm.toFixed(1)} KM
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* INSTALL APP / APK GUIDE MODAL FOR LOGGED IN RIDER */}
        <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
          <DialogContent className="sm:max-w-[420px] bg-white text-slate-800 border-slate-200 p-6 rounded-3xl shadow-2xl">
            <DialogHeader className="text-center space-y-2.5 pb-1">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <Download className="w-7 h-7" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Pasang Aplikasi Rider J&J 📲
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 leading-relaxed">
                Pasang portal rider terus ke skrin utama telefon anda untuk menerima tugasan penghantaran serta-merta!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <span>📱 Android / Chrome:</span>
                </p>
                <ol className="space-y-2 text-slate-700 list-decimal list-inside text-[11px] leading-relaxed">
                  <li>Tekan butang menu <strong>(Titik Tiga ⋮)</strong> di bahagian atas kanan Chrome.</li>
                  <li>Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen" (Tambah ke skrin utama)</strong>.</li>
                  <li>Ikon <strong>Warung J&J Rider</strong> akan muncul seperti aplikasi native di telefon anda!</li>
                </ol>
              </div>

              <Button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-2xl shadow-sm active:scale-95 transition-all text-xs"
              >
                Faham & Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

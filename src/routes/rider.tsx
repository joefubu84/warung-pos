// src/routes/rider.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Check
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

const IS_RIDER_ENABLED = true;

function RiderPortalPage() {
  const navigate = useNavigate();

  // Auth & Profile State
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [riderProfile, setRiderProfile] = useState<{
    id: string;
    rider_db_id?: string;
    name: string;
    phone_number?: string;
    role: string;
    is_approved: boolean;
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
  const [isOnline, setIsOnline] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [activeJob, setActiveJob] = useState<DeliveryJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<DeliveryJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'wallet'>('jobs');
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [previewRouteJobId, setPreviewRouteJobId] = useState<string | null>(null);

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
      const { data: riderRow } = await supabase
        .from('riders')
        .select('id, status, is_approved')
        .eq('user_id', userId)
        .maybeSingle();

      const approved = riderRow ? Boolean(riderRow.is_approved) : false;
      const initialOnline = approved && riderRow?.status === 'available';

      setRiderProfile({
        id: userData?.id || userId,
        rider_db_id: riderRow?.id || userData?.id || userId,
        name: userData?.name || sessionUser?.user_metadata?.name || 'Rider J&J',
        phone_number: userData?.phone || sessionUser?.user_metadata?.phone_number || '',
        role: userData?.role || 'rider',
        is_approved: approved,
      });

      setIsOnline(initialOnline);
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
        .limit(50);

      if (!error && orders) {
        const available: DeliveryJob[] = [];
        const completed: DeliveryJob[] = [];
        let active: DeliveryJob | null = null;

        orders.forEach((ord: any) => {
          const isClaimedByMe = ord.id === claimedLocalId;
          
          // ANTI-SCAM GATING: Only dispatch jobs to riders once customer has PAID and Warung JNJ verified payment!
          const isVerifiedPaid = ord.payment_status === 'paid' || ord.status === 'confirmed' || ord.status === 'preparing' || ord.status === 'ready';
          const isUnverifiedPayment = ord.payment_status === 'pending' || ord.status === 'pending_payment' || ord.status === 'pending_verification';

          if (ord.status === 'completed') {
            completed.push(ord);
          } else if (isVerifiedPaid && !isUnverifiedPayment) {
            if (isClaimedByMe) {
              active = ord;
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

  // Handle Online Toggle (Gated by is_approved)
  const handleToggleOnline = async (val: boolean) => {
    if (!isApproved) {
      toast.error('Akaun anda belum diluluskan oleh admin.');
      return;
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
    if (!isApproved && !job.id.startsWith('mock-del-')) {
      toast.error('Akaun anda sedang menunggu kelulusan admin.');
      return;
    }
    setIsClaiming(job.id);

    try {
      if (job.id.startsWith('mock-del-')) {
        // In-memory simulation
        localStorage.setItem('warung_rider_claimed_order_id', job.id);
        setAvailableJobs(prev => prev.filter(j => j.id !== job.id));
        setActiveJob(job);
        toast.success(`Tugasan pesanan #${job.id.slice(0, 8).toUpperCase()} berjaya diterima!`);
        setActiveTab('active');
        return;
      }

      // Atomic Accept Job RPC Call
      const isSuccess = await acceptJob(riderProfile?.rider_db_id || sessionUser.id, job.id);

      if (isSuccess) {
        localStorage.setItem('warung_rider_claimed_order_id', job.id);
        toast.success("🎉 Pesanan berjaya diterima!");
        await fetchDeliveryOrders();
        setActiveTab('active');
      } else {
        toast.error("⚠️ Maaf, pesanan telah diterima oleh rider lain atau akaun belum diluluskan.");
        await fetchDeliveryOrders();
      }
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

  // 3-Step Milestone Progression Handler (with zero-cost WhatsApp notification)
  const handleUpdateMilestone = async (newStatus: 'picked_up' | 'arrived' | 'completed') => {
    if (!activeJob) return;

    try {
      if (newStatus === 'completed') {
        await handleCompleteJob(activeJob.id);
        sendRiderDeliveryWhatsAppNotification('completed', activeJob.customer_phone || '', activeJob.id);
        return;
      }

      if (activeJob.id.startsWith('mock-del-')) {
        setActiveJob(prev => prev ? { ...prev, delivery_status: newStatus } : null);
        toast.success(newStatus === 'picked_up' ? '🍱 Pesanan telah diambil dari warung!' : '🛵 Anda telah tiba di lokasi pelanggan!');
        sendRiderDeliveryWhatsAppNotification(newStatus, activeJob.customer_phone || '', activeJob.id);
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({
          delivery_status: newStatus,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', activeJob.id);

      if (error) throw error;

      setActiveJob(prev => prev ? { ...prev, delivery_status: newStatus } : null);
      toast.success(newStatus === 'picked_up' ? '🍱 Pesanan telah diambil dari warung!' : '🛵 Anda telah tiba di lokasi pelanggan!');
      sendRiderDeliveryWhatsAppNotification(newStatus, activeJob.customer_phone || '', activeJob.id);
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
    return match ? match[1] : null;
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

  // WhatsApp
  const contactWhatsApp = (phone: string, customerName: string, orderId: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const validPhone = cleanPhone.startsWith('60') ? cleanPhone : cleanPhone.startsWith('0') ? '6' + cleanPhone : '60' + cleanPhone;
    const msg = `Salam ${customerName}, saya penghantar makanan dari Warung J&J (#${orderId.slice(0, 8).toUpperCase()}). Saya sedang menuju ke lokasi anda ya. Terima kasih!`;
    window.open(`https://wa.me/${validPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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

  // Earnings
  const totalEarningsToday = completedJobs.reduce((sum, j) => sum + getJobDeliveryFee(j), 0);

  // 1. AUTHENTICATION VIEW (CLEAN WARUNG BRANDING)
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#121110] text-[#f5f5f4] flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-amber-500/30">
        <div className="w-full max-w-md bg-[#1c1a18] border border-[#2e2a27] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* WARUNG J&J OFFICIAL LOGO HEADER */}
          <div className="text-center space-y-3">
            <div className="inline-block p-1 bg-gradient-to-b from-amber-500/40 to-transparent rounded-full shadow-lg">
              <img 
                src="/warung-logo.png" 
                alt="Warung J&J" 
                className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/60 shadow-inner mx-auto"
              />
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-[#fafaf9] tracking-tight">
                Rakan Penghantar J&J
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">
                Warung J&J • Penampang, Sabah
              </p>
            </div>
          </div>

          {/* MANUAL LOGIN FORM */}
          <form onSubmit={handleLoginRider} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-300">Emel Rider</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="rider@warungjnj.online"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-[#141211] border-[#2e2a27] focus:border-amber-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-stone-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-300">Kata Laluan</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-[#141211] border-[#2e2a27] focus:border-amber-500 pl-10 h-11 text-xs rounded-xl text-white placeholder:text-stone-600"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
            >
              {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Masuk Rider'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED RIDER DASHBOARD (CLEAN & PROFESSIONAL)
  return (
    <div className="min-h-screen bg-[#121110] text-[#f5f5f4] font-sans pb-24 selection:bg-amber-500/30">
      
      {/* BRANDED HEADER */}
      <header className="bg-[#1c1a18] border-b border-[#2e2a27] sticky top-0 z-30 shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/warung-logo.png" 
              alt="Warung J&J Logo" 
              className="w-10 h-10 rounded-full object-cover border border-amber-500/40 shadow-sm"
            />
            <div>
              <h1 className="font-bold text-sm text-stone-100 leading-tight">
                Warung J&J Delivery
              </h1>
              <p className="text-[11px] text-amber-400">
                {riderProfile?.name || sessionUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* ONLINE / OFFLINE TOGGLE (GATED BY is_approved) */}
            <div className="flex items-center gap-1.5 bg-[#141211] border border-[#2e2a27] px-2.5 py-1 rounded-xl">
              <span className={`text-[10px] font-bold ${!isApproved ? 'text-amber-500' : isOnline ? 'text-emerald-400' : 'text-stone-500'}`}>
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
              size="icon"
              variant="ghost"
              onClick={handleSignOut}
              className="text-stone-400 hover:text-rose-400 hover:bg-[#2b2724] w-8 h-8 rounded-xl"
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
          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-200 shadow-md">
            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Akaun Menunggu Kelulusan Admin</p>
              <p className="text-[11px] text-amber-400/80 mt-0.5 leading-relaxed">
                Akaun rider anda belum diluluskan oleh pengurusan Warung J&J. Suis mod <strong>ONLINE</strong> akan dibuka secara automatik selepas kelulusan diberikan.
              </p>
            </div>
          </div>
        )}

        {/* STATUS CARD */}
        <div className="bg-[#1c1a18] border border-[#2e2a27] p-3.5 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${!isApproved ? 'bg-amber-500' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'}`} />
            <span className="text-stone-300 font-medium">
              {!isApproved ? 'Akaun Menunggu Kelulusan Admin' : isOnline ? 'Sedia menerima tugasan penghantaran' : 'Status: Sedang Berehat'}
            </span>
          </div>
          <Button
            size="sm"
            onClick={fetchDeliveryOrders}
            disabled={loadingJobs}
            className="bg-[#141211] border border-[#2e2a27] hover:bg-[#2b2724] text-stone-300 text-xs rounded-xl h-7 px-2.5 gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingJobs ? 'animate-spin' : ''}`} />
            <span>Kemas Kini</span>
          </Button>
        </div>

        {/* NAVIGATION TABS */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 bg-[#141211] p-1 rounded-2xl border border-[#2e2a27] h-11 w-full">
            <TabsTrigger value="jobs" className="text-xs font-semibold rounded-xl data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              Tugasan ({availableJobs.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs font-semibold rounded-xl data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              Aktif {activeJob ? '•' : ''}
            </TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs font-semibold rounded-xl data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              Pendapatan
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AVAILABLE JOBS */}
          <TabsContent value="jobs" className="space-y-3 pt-3">
            <div className="flex justify-between items-center text-xs text-stone-400">
              <span>Pesanan Sedia Untuk Dihantar</span>
              <span>{availableJobs.length} pesanan</span>
            </div>

            {loadingJobs ? (
              <div className="py-12 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span>Memeriksa pesanan baru...</span>
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="p-8 text-center bg-[#1c1a18] rounded-2xl border border-[#2e2a27] text-stone-400 space-y-2">
                <Store className="w-8 h-8 mx-auto text-stone-600" />
                <p className="text-xs font-medium text-stone-300">Tiada pesanan baru untuk dihantar buat masa ini.</p>
                <p className="text-[11px] text-stone-500">Pesanan dari kaunter & dapur akan dipaparkan di sini secara automatik apabila sedia untuk dihantar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <Card key={job.id} className="bg-[#1c1a18] border border-[#2e2a27] text-white rounded-2xl shadow-lg overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start border-b border-[#2e2a27] pb-2.5">
                        <div>
                          <span className="text-[10px] text-amber-400 font-mono font-bold block">
                            #{job.id.slice(0, 8).toUpperCase()}
                          </span>
                          <h3 className="font-bold text-stone-100 text-sm">{job.customer_name || 'Pelanggan'}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">Upah Penghantaran</span>
                          <span className="text-base font-bold text-emerald-400 font-mono">
                            RM {getJobDeliveryFee(job).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* ROUTE INFO */}
                      <div className="space-y-2 text-xs text-stone-300">
                        <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                          <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Ambil: <strong>Warung J&J (Penampang)</strong></span>
                        </div>
                        <div className="flex items-start gap-2 text-stone-200 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="line-clamp-2">{getCleanDeliveryAddress(job.delivery_address)}</span>
                            {getDistanceBadge(job.delivery_address) && (
                              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-semibold">
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
                          className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1.5 py-1 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-sky-400" />
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
                        className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
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
              <div className="p-8 text-center bg-[#1c1a18] rounded-2xl border border-[#2e2a27] text-stone-400 space-y-2">
                <Truck className="w-8 h-8 mx-auto text-stone-600" />
                <p className="text-xs font-medium text-stone-300">Tiada tugasan aktif pada masa ini.</p>
                <p className="text-[11px] text-stone-500">Pilih mana-mana pesanan dari senarai "Tugasan" untuk mula menghantar.</p>
              </div>
            ) : (
              <Card className="bg-[#1c1a18] border-2 border-amber-500/60 text-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-amber-600 text-white font-bold text-xs px-4 py-2 flex justify-between items-center">
                  <span>DALAM PENGHANTARAN</span>
                  <span className="font-mono">#{activeJob.id.slice(0, 8).toUpperCase()}</span>
                </div>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase">Penerima</span>
                    <h3 className="text-base font-bold text-stone-100">{activeJob.customer_name}</h3>
                    <p className="text-xs text-amber-400 font-mono">{activeJob.customer_phone}</p>
                  </div>

                  <div className="bg-[#141211] border border-[#2e2a27] p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-stone-400 block uppercase">Alamat Penghantaran:</span>
                      {getDistanceBadge(activeJob.delivery_address) && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-semibold">
                          📍 {getDistanceBadge(activeJob.delivery_address)}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-200 leading-relaxed">{getCleanDeliveryAddress(activeJob.delivery_address)}</p>
                  </div>

                  {/* REAL-ROAD INTERACTIVE ROUTE MAP FOR RIDER */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
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
                      className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-stone-700"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-400" />
                      <span>Buka Google Maps</span>
                    </Button>

                    <Button
                      onClick={() => contactWhatsApp(activeJob.customer_phone || '', activeJob.customer_name || '', activeJob.id)}
                      className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-stone-700"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>

                  {/* 3-STEP PROGRESSIVE MILESTONES (FALLBACK GPS & WHATSAPP NOTIFICATION) */}
                  <div className="border-t border-[#2e2a27] pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs mb-1 font-mono">
                      <span className="text-stone-400">Upah Pesanan:</span>
                      <span className="font-bold text-base text-emerald-400">
                        RM {getJobDeliveryFee(activeJob).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-[#141211] p-3 rounded-2xl border border-[#2e2a27] space-y-2">
                      <span className="text-[11px] font-bold text-amber-400 block uppercase tracking-wider">
                        🚀 Tindakan Kemajuan Penghantaran:
                      </span>

                      {/* STEP 1: PICKED UP */}
                      {(!activeJob.delivery_status || activeJob.delivery_status === 'dispatched' || activeJob.delivery_status === 'preparing') && (
                        <Button
                          onClick={() => handleUpdateMilestone('picked_up')}
                          className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between px-4 active:scale-[0.98] transition-all"
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
                          className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between px-4 active:scale-[0.98] transition-all"
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
                          className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between px-4 active:scale-[0.98] transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>3. Selesai Serah & Terima Upah</span>
                          </span>
                          <Check className="w-4 h-4" />
                        </Button>
                      )}

                      <p className="text-[10px] text-stone-500 text-center pt-0.5">
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
            {/* EARNINGS SUMMARY */}
            <div className="bg-[#1c1a18] border border-[#2e2a27] p-5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <Wallet className="w-4 h-4" />
                <span>Ringkasan Pendapatan Hari Ini</span>
              </div>

              <div>
                <span className="text-3xl font-bold text-emerald-400 font-mono">
                  RM {totalEarningsToday.toFixed(2)}
                </span>
                <span className="text-xs text-stone-400 block mt-0.5">
                  {completedJobs.length} trip selesai hari ini
                </span>
              </div>
            </div>

            {/* COMPLETED TRIPS */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-stone-400 uppercase tracking-wider">
                Sejarah Penghantaran Selesai
              </h3>

              {completedJobs.length === 0 ? (
                <div className="p-6 text-center bg-[#1c1a18] rounded-xl border border-[#2e2a27] text-xs text-stone-500">
                  Belum ada rekod penghantaran yang selesai hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedJobs.map((job) => (
                    <div key={job.id} className="p-3 bg-[#1c1a18] border border-[#2e2a27] rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-stone-200 block">
                          #{job.id.slice(0, 8).toUpperCase()} • {job.customer_name}
                        </span>
                        <span className="text-[11px] text-stone-400 line-clamp-1">{getCleanDeliveryAddress(job.delivery_address)}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="font-bold text-emerald-400 block font-mono">
                          +RM {getJobDeliveryFee(job).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-stone-400">Selesai</span>
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

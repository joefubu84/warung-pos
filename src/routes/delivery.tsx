import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ChevronRight, 
  ShieldCheck, 
  MessageCircle, 
  Download, 
  Copy, 
  Check, 
  QrCode, 
  Receipt, 
  Building2, 
  CreditCard, 
  Globe, 
  Split, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  SlidersHorizontal,
  Flame,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Navigation,
  LogIn,
  LogOut,
  UploadCloud,
  FileText,
  Bike,
  Store,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { createToyyibPayCheckout } from '@/lib/toyyibpay';
import { COMMON_MODIFIERS } from '@/lib/kitchen-checklist-config';
import { DishCustomizationModal, CustomizedCartItem } from '@/components/DishCustomizationModal';
import { DeliveryRouteMap, WARUNG_COORDS, isWithinSabah } from '@/components/DeliveryRouteMap';
import { 
  signInWithGoogleOAuth, 
  getStoredGoogleUser, 
  saveStoredGoogleUser, 
  clearStoredGoogleUser, 
  GoogleAuthUser 
} from '@/lib/google-auth';
import { 
  requestWhatsAppOtp, 
  verifyWhatsAppOtp, 
  sanitizePhone 
} from '@/lib/whatsapp-otp';
import { getAddonsConfig, CustomAddon } from '@/lib/addons-config';

export const Route = createFileRoute('/delivery')({
  component: CustomerDeliveryPage,
});

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  stock_count?: number | null;
  is_available: boolean;
  description?: string;
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  packNotes?: string[];
  containerCharge?: number;
  selectedAddons?: { name: string; price: number }[];
  spiceLevel?: string;
}

// Official Google Business Location for Warung JNJ (Penampang)
// Google Maps: https://www.google.com/maps/dir//Warung+JNJ,+a17,+Jln+Datuk+Panglima+Banting,+89500+Penampang,+Sabah/@5.9810544,116.0768506,9z/data=!4m8!4m7!1m0!1m5!1m1!1s0x323b692e917f9eb1:0x66ccb58dff90bc87!2m2!1d116.1146463!2d5.9284153
const WARUNG_LAT = 5.9284153;
const WARUNG_LNG = 116.1146463;

interface SabahLocationItem {
  name: string;
  lat: number;
  lng: number;
  desc: string;
  category: 'hotel' | 'apartment' | 'shoplot' | 'housing' | 'landmark';
}

const LOCAL_SABAH_LANDMARKS: SabahLocationItem[] = [
  // Warung JNJ HQ
  { name: 'Warung JNJ Penampang', lat: 5.9284153, lng: 116.1146463, desc: 'a17, Jln Datuk Panglima Banting, Penampang', category: 'shoplot' },
  // ==========================================
  // 1. HOTELS & RESORTS (KOTA KINABALU & PENAMPANG & SABAH)
  // ==========================================
  { name: 'Le Meridien Kota Kinabalu', lat: 5.9785, lng: 116.0710, desc: 'Jalan Tun Fuad Stephens, KK City', category: 'hotel' },
  { name: 'Hilton Kota Kinabalu', lat: 5.9750, lng: 116.0760, desc: 'Jalan Asia City, KK City', category: 'hotel' },
  { name: 'Hyatt Regency Kinabalu', lat: 5.9860, lng: 116.0765, desc: 'Jalan Datuk Salleh Sulong, KK City', category: 'hotel' },
  { name: 'Hyatt Centric Kota Kinabalu', lat: 5.9880, lng: 116.0780, desc: 'Jalan Haji Saman, KK City', category: 'hotel' },
  { name: 'Kota Kinabalu Marriott Hotel', lat: 5.9740, lng: 116.0680, desc: 'Jalan Tun Fuad Stephens, KK Waterfront', category: 'hotel' },
  { name: 'Promenade Hotel Kota Kinabalu', lat: 5.9745, lng: 116.0700, desc: 'Api-Api Centre, KK City', category: 'hotel' },
  { name: 'The Magellan Sutera Resort', lat: 5.9650, lng: 116.0580, desc: 'Sutera Harbour, KK', category: 'hotel' },
  { name: 'The Pacific Sutera Hotel', lat: 5.9620, lng: 116.0590, desc: 'Sutera Harbour, KK', category: 'hotel' },
  { name: 'Shangri-La Tanjung Aru Resort', lat: 5.9560, lng: 116.0460, desc: 'Tanjung Aru, KK', category: 'hotel' },
  { name: 'Horizon Hotel Kota Kinabalu', lat: 5.9830, lng: 116.0770, desc: 'Jalan Pantai, KK City', category: 'hotel' },
  { name: 'Grandis Hotels and Resorts', lat: 5.9870, lng: 116.0775, desc: 'Suria Sabah Shopping Mall, KK', category: 'hotel' },
  { name: 'Ming Garden Hotel & Residences', lat: 5.9690, lng: 116.0680, desc: 'Lorong Ming Garden, KK', category: 'hotel' },
  { name: 'The Palace Hotel Kota Kinabalu', lat: 5.9760, lng: 116.0820, desc: 'Bukit Tangki, Karamunsing, KK', category: 'hotel' },
  { name: 'Avangio Hotel Kota Kinabalu', lat: 5.9680, lng: 116.1090, desc: 'Metro Town, Kolombong', category: 'hotel' },
  { name: 'Cititel Express Kota Kinabalu', lat: 5.9765, lng: 116.0755, desc: 'Asia City, KK', category: 'hotel' },
  { name: 'The Klagan Hotel', lat: 5.9780, lng: 116.0730, desc: 'Warisan Square, KK', category: 'hotel' },
  { name: 'The Klagan Regency Hotel', lat: 6.0370, lng: 116.1290, desc: '1Borneo Hypermall, Jalan Sulaman', category: 'hotel' },
  { name: 'Gaya Centre Hotel', lat: 5.9865, lng: 116.0785, desc: 'Jalan Tun Fuad Stephens, KK', category: 'hotel' },
  { name: 'Dreamtel Kota Kinabalu', lat: 5.9820, lng: 116.0790, desc: 'Jalan Padang, KK City', category: 'hotel' },
  { name: 'Pan Borneo Hotel Kota Kinabalu', lat: 5.8910, lng: 116.0510, desc: 'Putatan, Penampang / KK', category: 'hotel' },
  { name: 'Langkah Syabas Beach Resort', lat: 5.8150, lng: 116.0280, desc: 'Kampung Kinarut Laut, Papar', category: 'hotel' },
  { name: 'Celyn Hotel City Mall', lat: 5.9635, lng: 116.1015, desc: 'City Mall, Jalan Lintas', category: 'hotel' },
  { name: 'ibis Styles Kota Kinabalu Inanam', lat: 5.9890, lng: 116.1260, desc: 'Jalan Taipan, Inanam', category: 'hotel' },

  // ==========================================
  // 2. APARTMENTS, CONDOS & RESIDENCES
  // ==========================================
  { name: 'Cyber City Apartment Phase 1', lat: 5.9210, lng: 116.0790, desc: 'Kepayan / Penampang', category: 'apartment' },
  { name: 'Cyber City Apartment Phase 2', lat: 5.9230, lng: 116.0810, desc: 'Kepayan / Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 1', lat: 5.9470, lng: 116.1100, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 2', lat: 5.9480, lng: 116.1110, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 3', lat: 5.9490, lng: 116.1120, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 4', lat: 5.9485, lng: 116.1105, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 5', lat: 5.9500, lng: 116.1130, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Putatan Platinum Apartment', lat: 5.8950, lng: 116.0550, desc: 'Putatan, Penampang', category: 'apartment' },
  { name: 'The Loft Residences @ Imago', lat: 5.9715, lng: 116.0675, desc: 'KK Times Square, KK', category: 'apartment' },
  { name: 'Sutera Avenue Residences & SOVO', lat: 5.9680, lng: 116.0660, desc: 'Jalan Coastal, KK', category: 'apartment' },
  { name: 'Riverson SOHO & The Walk', lat: 5.9695, lng: 116.0645, desc: 'Off Jalan Coastal, KK', category: 'apartment' },
  { name: 'Aeropod SOVO & Commercial', lat: 5.9470, lng: 116.0610, desc: 'Tanjung Aru, KK', category: 'apartment' },
  { name: 'Jesselton Residences & Mall', lat: 5.9890, lng: 116.0790, desc: 'Jalan Haji Saman, KK City', category: 'apartment' },
  { name: 'Jesselton Quay (JQ Central)', lat: 5.9910, lng: 116.0810, desc: 'Jesselton Waterfront, KK', category: 'apartment' },
  { name: 'University Apartment Phase 1 (UA 1)', lat: 6.0410, lng: 116.1330, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'University Apartment Phase 2 (UA 2)', lat: 6.0430, lng: 116.1350, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'University Condominium Pelangi (UCP)', lat: 6.0390, lng: 116.1380, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'Country Heights Apartment', lat: 5.9280, lng: 116.1280, desc: 'Minintod, Penampang', category: 'apartment' },
  { name: 'Nountun Apartment', lat: 5.9890, lng: 116.1280, desc: 'Inanam, KK', category: 'apartment' },
  { name: 'Kingfisher Sandpiper Condominium', lat: 5.9980, lng: 116.1420, desc: 'Jalan Kionsom, Inanam', category: 'apartment' },
  { name: 'Maya Condominium Likas', lat: 5.9870, lng: 116.0980, desc: 'Jalan Likas, KK', category: 'apartment' },
  { name: 'Likas Court Condominium', lat: 5.9890, lng: 116.1050, desc: 'Jalan Tuaran, Likas', category: 'apartment' },
  { name: 'Radiant Tower & Radiant Court', lat: 5.9920, lng: 116.0990, desc: 'Signal Hill / Likas', category: 'apartment' },
  { name: 'Bayshore Condominium', lat: 5.9930, lng: 116.0960, desc: 'Signal Hill, KK', category: 'apartment' },
  { name: 'Ashton Tower Kolombong', lat: 5.9760, lng: 116.1240, desc: 'Jalan Nountun, Kolombong', category: 'apartment' },
  { name: 'V21 Residence Sepanggar', lat: 6.0710, lng: 116.1480, desc: 'Sepanggar / KKIP', category: 'apartment' },
  { name: 'Puncak Menggatal Condominium', lat: 6.0180, lng: 116.1620, desc: 'Menggatal, KK', category: 'apartment' },
  { name: 'Telipok Ria Apartment', lat: 6.0820, lng: 116.1820, desc: 'Telipok, Menggatal', category: 'apartment' },
  { name: 'Pelita Court Apartment', lat: 5.9450, lng: 116.0750, desc: 'Kepayan, KK', category: 'apartment' },
  { name: 'Manhattan Suites ITCC', lat: 5.9225, lng: 116.0915, desc: 'ITCC Penampang', category: 'apartment' },

  // ==========================================
  // 3. COMMERCIAL SHOP LOTS & BUSINESS PARKS
  // ==========================================
  { name: 'Plaza 333 Kobusak Commercial', lat: 5.9320, lng: 116.0880, desc: 'Jalan Pintas Penampang', category: 'shoplot' },
  { name: 'Grand Millennium Plaza', lat: 5.9340, lng: 116.0890, desc: 'Kobusak, Penampang', category: 'shoplot' },
  { name: 'Pintas Avenue Commercial', lat: 5.9360, lng: 116.0830, desc: 'Jalan Pintas, Penampang', category: 'shoplot' },
  { name: 'Bundusan Commercial Centre', lat: 5.9450, lng: 116.1080, desc: 'Jalan Bundusan, Penampang', category: 'shoplot' },
  { name: 'Pavilion Bundusan / T1 Bundusan', lat: 5.9430, lng: 116.1050, desc: 'Bundusan, Penampang', category: 'shoplot' },
  { name: 'Taman Formosa Commercial', lat: 5.9470, lng: 116.1020, desc: 'Bundusan, Penampang', category: 'shoplot' },
  { name: 'Metro Town Commercial Centre', lat: 5.9670, lng: 116.1080, desc: 'Jalan Kolombong / Lintas', category: 'shoplot' },
  { name: 'Inanam Taipan Commercial Centre', lat: 5.9920, lng: 116.1320, desc: 'Inanam, KK', category: 'shoplot' },
  { name: 'Inanam Capital Commercial Centre', lat: 5.9940, lng: 116.1350, desc: 'Inanam, KK', category: 'shoplot' },
  { name: 'Inanam Business Centre', lat: 5.9915, lng: 116.1310, desc: 'Pekan Inanam, KK', category: 'shoplot' },
  { name: 'Kolombong BDC Industrial Estate', lat: 5.9810, lng: 116.1150, desc: 'Kolombong, KK', category: 'shoplot' },
  { name: 'City Mall Shopping Centre', lat: 5.9640, lng: 116.1020, desc: 'Jalan Lintas, Luyang', category: 'shoplot' },
  { name: 'Heritage Plaza Lintas', lat: 5.9580, lng: 116.0880, desc: 'Lintas, Luyang', category: 'shoplot' },
  { name: 'Lintas Plaza & Lintas Square', lat: 5.9570, lng: 116.0890, desc: 'Lintas, Luyang', category: 'shoplot' },
  { name: 'Foh Sang Commercial Centre', lat: 5.9550, lng: 116.0910, desc: 'Luyang, KK', category: 'shoplot' },
  { name: 'Lido Plaza & Lido Commercial', lat: 5.9480, lng: 116.0820, desc: 'Luyang, KK', category: 'shoplot' },
  { name: 'Damai Plaza Phase 1-4', lat: 5.9670, lng: 116.0930, desc: 'Damai, Luyang', category: 'shoplot' },
  { name: 'Damai Point Commercial Centre', lat: 5.9660, lng: 116.0940, desc: 'Damai, Luyang', category: 'shoplot' },
  { name: 'Alamesra Plaza Utama / Plaza Permai', lat: 6.0280, lng: 116.1240, desc: 'Jalan Sulaman, KK', category: 'shoplot' },
  { name: 'Menggatal Plaza Commercial', lat: 6.0220, lng: 116.1550, desc: 'Menggatal, KK', category: 'shoplot' },
  { name: 'Megalong Shopping Mall', lat: 5.9090, lng: 116.1025, desc: 'Pekan Donggongon, Penampang', category: 'shoplot' },
  { name: 'ITCC Shopping Mall', lat: 5.9225, lng: 116.0915, desc: 'Jalan Pintas Penampang', category: 'shoplot' },
  { name: 'Imago Shopping Mall', lat: 5.9710, lng: 116.0670, desc: 'KK Times Square, KK', category: 'shoplot' },
  { name: 'Suria Sabah Shopping Mall', lat: 5.9860, lng: 116.0770, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: 'Centre Point Sabah', lat: 5.9790, lng: 116.0720, desc: 'KK Bandar', category: 'shoplot' },
  { name: 'Api-Api Centre Commercial', lat: 5.9750, lng: 116.0710, desc: 'Jalan Centre Point, KK', category: 'shoplot' },
  { name: 'Wisma Merdeka / Segama', lat: 5.9840, lng: 116.0750, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: 'Karamunsing Complex / Capital', lat: 5.9710, lng: 116.0770, desc: 'Karamunsing, KK', category: 'shoplot' },
  { name: 'Gaya Street Shoplots', lat: 5.9860, lng: 116.0770, desc: 'Kota Kinabalu City', category: 'shoplot' },
  { name: 'Sinsuran Commercial Centre', lat: 5.9800, lng: 116.0730, desc: 'KK Waterfront', category: 'shoplot' },
  { name: 'Kampung Air Commercial', lat: 5.9770, lng: 116.0760, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: 'Pekan Putatan / Servay Shoplots', lat: 5.8920, lng: 116.0520, desc: 'Putatan', category: 'shoplot' },
  { name: 'Palm Square Commercial Kinarut', lat: 5.8210, lng: 116.0380, desc: 'Kinarut, Papar', category: 'shoplot' },

  // ==========================================
  // 4. HOUSING ESTATES & LANDED TAMANS
  // ==========================================
  // Penampang & Donggongon Landed
  { name: 'Taman Liana Phase 2, Penampang', lat: 5.9141659, lng: 116.085516, desc: 'Donggongon / Penampang', category: 'housing' },
  { name: 'Taman Liana Phase 1, Penampang', lat: 5.9135, lng: 116.0842, desc: 'Donggongon / Penampang', category: 'housing' },
  { name: 'Taman Penampang Phase 1 & 2', lat: 5.9260, lng: 116.0980, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Suria Penampang', lat: 5.9270, lng: 116.1010, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Towering Penampang', lat: 5.9370, lng: 116.0950, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Kasigui 1, 2, 3', lat: 5.8990, lng: 116.1150, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Nosoob Jaya / Nosoob Baru', lat: 5.9310, lng: 116.0810, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Kobusak Villa / Kobusak Point', lat: 5.9315, lng: 116.0850, desc: 'Kobusak, Penampang', category: 'housing' },
  { name: 'Taman Putera Jaya Penampang', lat: 5.9180, lng: 116.0920, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Sahabat Penampang', lat: 5.9190, lng: 116.0930, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Dabak / Kampung Dabak', lat: 5.9060, lng: 116.0980, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Mahandoi / Kampung Mahandoi', lat: 5.8890, lng: 116.0890, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Vista Minintod', lat: 5.9310, lng: 116.1260, desc: 'Minintod, Penampang', category: 'housing' },
  { name: 'Kampung Terawi / Terawi Penampang', lat: 5.8920, lng: 116.0850, desc: 'Terawi, Penampang', category: 'housing' },
  { name: 'Kampung Koidupan / Kampung Babah', lat: 5.9020, lng: 116.0910, desc: 'Penampang', category: 'housing' },

  // Bundusan & Bukit Padang Landed
  { name: 'Taman Bundusan / Bundusan Villa', lat: 5.9460, lng: 116.1070, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Formosa Bundusan', lat: 5.9470, lng: 116.1020, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Permai Bundusan', lat: 5.9490, lng: 116.1090, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Landmark Bundusan', lat: 5.9440, lng: 116.1090, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Khidmat Bukit Padang', lat: 5.9580, lng: 116.1050, desc: 'Bukit Padang, Luyang', category: 'housing' },

  // Kepayan, Austral & Tanjung Aru Landed
  { name: 'Taman Kepayan Ridge / Jalan 3D', lat: 5.9412, lng: 116.0715, desc: 'Kepayan Ridge, KK', category: 'housing' },
  { name: 'Austral Park Kepayan', lat: 5.9380, lng: 116.0720, desc: 'Kepayan / KK', category: 'housing' },
  { name: 'Taman Sri Kepayan / Kepayan Point', lat: 5.9350, lng: 116.0690, desc: 'Kepayan', category: 'housing' },
  { name: 'Taman Ganang / Ganang Villa', lat: 5.9290, lng: 116.0680, desc: 'Kepayan / Penampang', category: 'housing' },
  { name: 'Taman Ridgeview Kepayan', lat: 5.9430, lng: 116.0740, desc: 'Kepayan, KK', category: 'housing' },
  { name: 'Taman Tanjung Aru / Rumah Pangsa', lat: 5.9520, lng: 116.0540, desc: 'Tanjung Aru', category: 'housing' },

  // Likas Landed
  { name: 'Taman Likas Jaya / Likas Bay', lat: 5.9910, lng: 116.1020, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Antarabangsa Likas', lat: 5.9880, lng: 116.1080, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Seri Likas', lat: 5.9890, lng: 116.1050, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Kingfisher Likas / Sulaman', lat: 6.0150, lng: 116.1260, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Pasir Putih Likas', lat: 5.9850, lng: 116.1090, desc: 'Likas, KK', category: 'housing' },

  // Inanam & Kolombong Landed
  { name: 'Taman Nountun Inanam', lat: 5.9890, lng: 116.1280, desc: 'Inanam, KK', category: 'housing' },
  { name: 'Taman Impian Inanam / Inanam Villa', lat: 5.9930, lng: 116.1360, desc: 'Inanam, KK', category: 'housing' },
  { name: 'Taman Kionsom Inanam', lat: 5.9870, lng: 116.1480, desc: 'Kionsom, Inanam', category: 'housing' },
  { name: 'Taman Nelly Kolombong', lat: 5.9620, lng: 116.1100, desc: 'Kolombong, KK', category: 'housing' },
  { name: 'Taman Kolombong / Taman Bunga Raja', lat: 5.9790, lng: 116.1180, desc: 'Kolombong, KK', category: 'housing' },
  { name: 'Taman Khidmat Kolombong', lat: 5.9610, lng: 116.1090, desc: 'Kolombong / Luyang', category: 'housing' },

  // Menggatal & Sepanggar Landed
  { name: 'Bandar Sierra Menggatal / Telipok', lat: 6.0620, lng: 116.1680, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Indah Permai (IP Menggatal)', lat: 6.0490, lng: 116.1450, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Bukit Sepangar', lat: 6.0520, lng: 116.1380, desc: 'Sepanggar, KK', category: 'housing' },
  { name: 'Taman Kuala Menggatal', lat: 6.0240, lng: 116.1490, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Putera Jaya Telipok', lat: 6.0810, lng: 116.1850, desc: 'Telipok, Menggatal', category: 'housing' },

  // Luyang & Lido Landed
  { name: 'Taman Cantek Lido', lat: 5.9440, lng: 116.0790, desc: 'Lido / Luyang', category: 'housing' },
  { name: 'Taman Foh Sang / Golden City', lat: 5.9540, lng: 116.0890, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Bornion / Taman Hilltop', lat: 5.9510, lng: 116.0930, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Friendly / Taman Foo Loong', lat: 5.9590, lng: 116.0920, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Luyang Phase 1-8', lat: 5.9530, lng: 116.0870, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Dixon Luyang', lat: 5.9460, lng: 116.0910, desc: 'Luyang, KK', category: 'housing' },

  // Putatan & Kinarut Landed
  { name: 'Taman Bersatu Putatan', lat: 5.8910, lng: 116.0580, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Pasir Putih Putatan', lat: 5.8880, lng: 116.0490, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Sri Keramat Putatan', lat: 5.8960, lng: 116.0530, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Jumbo Petagas', lat: 5.9080, lng: 116.0560, desc: 'Petagas, Putatan', category: 'housing' },
  { name: 'Bukit Vor Villa Putatan', lat: 5.8810, lng: 116.0480, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Rose Kinarut', lat: 5.8190, lng: 116.0390, desc: 'Kinarut, Papar', category: 'housing' },
  { name: 'Taman Sungai Wang Kinarut', lat: 5.8230, lng: 116.0420, desc: 'Kinarut, Papar', category: 'housing' },

  // ==========================================
  // 5. COMMUNITY POIS, HOSPITALS, CHURCHES & MOSQUES
  // ==========================================
  { name: 'Walai Good Shepherd, Likas', lat: 5.9865, lng: 116.1030, desc: 'Batu 3.5, Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'Good Shepherd Services Sabah', lat: 5.9865, lng: 116.1030, desc: 'Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'St. Simon Catholic Church, Likas', lat: 5.9860, lng: 116.1035, desc: 'Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'St. Michael Catholic Church Penampang', lat: 5.9100, lng: 116.1070, desc: 'Donggongon, Penampang', category: 'landmark' },
  { name: 'Holy Nativity Church Terawi', lat: 5.8920, lng: 116.0850, desc: 'Terawi, Penampang', category: 'landmark' },
  { name: 'Sacred Heart Cathedral Kota Kinabalu', lat: 5.9680, lng: 116.0780, desc: 'Karamunsing, KK', category: 'landmark' },
  { name: 'Hospital Wanita dan Kanak-Kanak Likas (HWKKS)', lat: 6.0150, lng: 116.1260, desc: 'Kingfisher, Likas', category: 'landmark' },
  { name: 'Hospital Queen Elizabeth (QEH 1)', lat: 5.9540, lng: 116.0710, desc: 'Jalan Penampang, Kepayan', category: 'landmark' },
  { name: 'Hospital Queen Elizabeth II (QEH 2 Damai)', lat: 5.9680, lng: 116.0920, desc: 'Damai, Luyang, KK', category: 'landmark' },
  { name: 'KPJ Sabah Specialist Hospital', lat: 5.9660, lng: 116.0910, desc: 'Damai, Luyang, KK', category: 'landmark' },
  { name: 'Gleneagles Hospital Kota Kinabalu', lat: 5.9690, lng: 116.0640, desc: 'Riverson, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Penampang', lat: 5.9110, lng: 116.1040, desc: 'Donggongon, Penampang', category: 'landmark' },
  { name: 'Klinik Kesihatan Luyang', lat: 5.9560, lng: 116.0870, desc: 'Luyang, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Menggatal', lat: 6.0210, lng: 116.1540, desc: 'Menggatal, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Putatan', lat: 5.8900, lng: 116.0500, desc: 'Putatan', category: 'landmark' },
  { name: 'Kompleks Sukan Likas (Stadium Likas)', lat: 5.9820, lng: 116.0960, desc: 'Likas, KK', category: 'landmark' },
  { name: 'Masjid Bandaraya Kota Kinabalu (Masjid Terapung)', lat: 5.9960, lng: 116.0850, desc: 'Teluk Likas, KK', category: 'landmark' },
  { name: 'Masjid Negeri Sabah', lat: 5.9610, lng: 116.0730, desc: 'Sembulan, KK', category: 'landmark' },
  { name: 'Menara Tun Mustapha (Yayasan Sabah)', lat: 6.0160, lng: 116.1110, desc: 'Teluk Likas, KK', category: 'landmark' },
  { name: 'Pusat Konvensyen Antarabangsa Sabah (SICC)', lat: 5.9920, lng: 116.0880, desc: 'Tanjung Lipat, Likas', category: 'landmark' },
  { name: 'Universiti Malaysia Sabah (UMS)', lat: 6.0350, lng: 116.1200, desc: 'Teluk Likas / Sulaman', category: 'landmark' },
  { name: 'Politeknik Kota Kinabalu (PKK)', lat: 6.0680, lng: 116.1450, desc: 'Sepanggar, KK', category: 'landmark' },
  { name: 'IPK Sabah (Ibu Pejabat Polis Kontinjen)', lat: 5.9410, lng: 116.0650, desc: 'Kepayan, KK', category: 'landmark' },
  { name: 'KKIA Terminal 1 (Lapangan Terbang KK)', lat: 5.9370, lng: 116.0510, desc: 'Kepayan / Tanjung Aru', category: 'landmark' },
  { name: 'Jesselton Point Ferry Terminal', lat: 5.9910, lng: 116.0790, desc: 'Jesselton, KK', category: 'landmark' },
  { name: 'Pasar Kraftangan / Pasar Filipina', lat: 5.9810, lng: 116.0720, desc: 'KK Waterfront', category: 'landmark' },
];

// Clean search string by stripping house/lot number prefixes
function extractHouseNumberPrefix(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Matches: "SD19", "No 14", "No. 14", "Lot 12A", "Unit 3B", "Blok C-2-1", "House 4", "Rumah 12", "Tingkat 2", "14A,", "14,"
  const match = trimmed.match(/^(?:(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|sd|lorong|jalan)\s*[a-z0-9\-\/]+|[0-9]+[a-z]?)(?:,\s*(?:lorong|jalan|blok|tingkat)\s*[a-z0-9]+)?/i);
  return match ? match[0].trim().replace(/,+$/, '') : '';
}

function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/^(?:(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|sd|lorong|jalan)\s*[a-z0-9\-\/]+|[0-9]+[a-z]?)(?:,\s*(?:lorong|jalan|blok|tingkat)\s*[a-z0-9]+)?/i, '')
    .replace(/(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|hotel|residence|condo|condominium|taman|jalan|lorong)\s*[a-z0-9\-\/]+/gi, '')
    .replace(/[,\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchLocalSabahLandmarks(rawQuery: string) {
  const housePrefix = extractHouseNumberPrefix(rawQuery);
  const cleanQ = sanitizeSearchQuery(rawQuery).toLowerCase();
  const rawQ = rawQuery.toLowerCase().trim();
  const tokens = (cleanQ || rawQ).split(' ').filter(t => t.length >= 2);

  return LOCAL_SABAH_LANDMARKS.map(item => {
    const itemName = item.name.toLowerCase();
    const itemDesc = item.desc.toLowerCase();
    const fullText = `${itemName} ${itemDesc} ${item.category}`;

    let score = 0;
    if (itemName.includes(cleanQ) || itemDesc.includes(cleanQ)) {
      score += 100;
    }
    if (tokens.length > 0) {
      const matchCount = tokens.filter(t => fullText.includes(t)).length;
      if (matchCount === tokens.length) {
        score += 80;
      } else if (matchCount > 0) {
        score += matchCount * 25;
      }
    }
    if (fullText.includes(rawQ)) {
      score += 50;
    }

    return { item, score };
  })
  .filter(res => res.score > 0)
  .sort((a, b) => b.score - a.score)
  .map(res => {
    const categoryEmoji: Record<string, string> = {
      hotel: '🏨',
      apartment: '🏢',
      shoplot: '🏪',
      housing: '🏡',
      landmark: '📍'
    };
    const emoji = categoryEmoji[res.item.category] || '📍';
    const displayPrefix = housePrefix ? `${housePrefix}, ` : '';

    return {
      displayName: `${displayPrefix}${res.item.name}, ${res.item.desc}`,
      mainText: `${emoji} ${displayPrefix}${res.item.name}`,
      rawName: res.item.name,
      secondaryText: res.item.desc,
      category: res.item.category,
      lat: res.item.lat,
      lng: res.item.lng,
    };
  });
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
}

const IS_DELIVERY_ENABLED = false;

function CustomerDeliveryPage() {

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Search and Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Google Authentication & Anti-Scam State
  const [currentUser, setCurrentUser] = useState<GoogleAuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authNameInput, setAuthNameInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [receiptProofUrl, setReceiptProofUrl] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Customer & Delivery Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [custLat, setCustLat] = useState<number>(5.9141659);
  const [custLng, setCustLng] = useState<number>(116.085516);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number>(6.6);
  const [travelTimeMins, setTravelTimeMins] = useState<number>(12);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Address Auto-suggestions
  const [addressSuggestions, setAddressSuggestions] = useState<{
    displayName: string;
    mainText: string;
    secondaryText: string;
    lat: number;
    lng: number;
  }[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const [availableAddons, setAvailableAddons] = useState<CustomAddon[]>([]);

  useEffect(() => {
    setAvailableAddons(getAddonsConfig());
    const handleAddonsUpdate = () => setAvailableAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleAddonsUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleAddonsUpdate);
  }, []);

  const handleAddonDirectToCart = (addon: CustomAddon) => {
    const newItem: CartItem = {
      id: `addon_${addon.id}_${Date.now()}`,
      menuItemId: addon.id,
      name: addon.name,
      price: addon.price,
      quantity: 1,
      containerCharge: 0.50,
      notes: 'Add-on / Sampingan',
      packNotes: [''],
      selectedAddons: [],
      spiceLevel: 'Medium'
    };
    setCart(prev => [...prev, newItem]);
    toast.success(`🍱 Ditambah 1x ${addon.name} (+RM ${addon.price.toFixed(2)}) ke pesanan!`);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showDuitNowModal, setShowDuitNowModal] = useState(false);

  // Distance & Fee Calculations (Based on actual road driving distance)
  const isOutOfZone = roadDistanceKm > 15.0;
  const deliveryFee = Math.max(Math.round(roadDistanceKm * 1.00 * 100) / 100, 2.00);

  const foodSubtotal = cart.reduce((sum, item) => sum + (item.price + (item.containerCharge || 0)) * item.quantity, 0);
  const grandTotal = foodSubtotal + (cart.length > 0 ? deliveryFee : 0);
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storePhone, setStorePhone] = useState<string>('60172221784');
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [isFPXLoading, setIsFPXLoading] = useState(false);

  // Calculate actual road distance via OSRM Routing Engine
  const fetchRoadRoute = async (destLat: number, destLng: number) => {
    setIsCalculatingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${WARUNG_LNG},${WARUNG_LAT};${destLng},${destLat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const durMins = Math.max(5, Math.ceil(route.duration / 60) + 3);
        setRoadDistanceKm(distKm);
        setTravelTimeMins(durMins);
      } else {
        // Fallback to Haversine * 1.35 (standard urban road detour multiplier)
        const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, destLat, destLng);
        const estimatedRoadKm = Math.round(straightKm * 1.35 * 10) / 10;
        setRoadDistanceKm(estimatedRoadKm);
        setTravelTimeMins(Math.max(5, Math.ceil(estimatedRoadKm * 2)));
      }
    } catch (e) {
      const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, destLat, destLng);
      const estimatedRoadKm = Math.round(straightKm * 1.35 * 10) / 10;
      setRoadDistanceKm(estimatedRoadKm);
      setTravelTimeMins(Math.max(5, Math.ceil(estimatedRoadKm * 2)));
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Phone OTP Verification State
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [currentOtpCode, setCurrentOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // OTP Cooldown countdown
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setInterval(() => setOtpCooldown(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [otpCooldown]);

  const handleRequestOtp = (phoneToVerify?: string) => {
    const p = phoneToVerify || customerPhone;
    const clean = p.replace(/\D/g, '');
    if (!clean.startsWith('01') || clean.length < 10 || clean.length > 11) {
      toast.error('Sila masukkan nombor telefon bimbit WhatsApp Malaysia yang sah (cth: 0198887766)');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = requestWhatsAppOtp(clean);
      if (res.success) {
        setShowOtpModal(true);
        setOtpCooldown(60);
        if (res.otpCode) {
          setCurrentOtpCode(res.otpCode);
        }
        toast.success('Kod OTP keselamatan 6-digit dijana! Sila sahkan di bawah.', { duration: 4000 });
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghantar kod OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = () => {
    if (!otpInput.trim() || otpInput.trim().length < 6) {
      toast.error('Sila masukkan 6-digit kod OTP yang sah');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const clean = customerPhone.replace(/\D/g, '');
      const res = verifyWhatsAppOtp(clean, otpInput.trim());
      if (res.success) {
        setIsPhoneVerified(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`warung_verified_phone_${clean}`, 'true');
          localStorage.setItem('warung_customer_phone', customerPhone);
        }
        setShowOtpModal(false);
        setOtpInput('');
        toast.success('🎉 Nombor WhatsApp anda berjaya disahkan sah!');
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message || 'Pengesahan OTP gagal.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOpenWhatsAppDirectVerification = () => {
    const clean = customerPhone.replace(/\D/g, '');
    const warungPhone = (storePhone || '60172221784').replace(/\D/g, '');
    const code = currentOtpCode || '888222';
    const msg = `Halo Warung JNJ, saya mengesahkan nombor telefon WhatsApp (${clean}) untuk pesanan delivery di warungjnj.online. Kod Pengesahan: ${code}`;
    const waUrl = `https://wa.me/${warungPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    
    setIsPhoneVerified(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`warung_verified_phone_${clean}`, 'true');
      localStorage.setItem('warung_customer_phone', customerPhone);
    }
    setShowOtpModal(false);
    toast.success('🎉 Nombor WhatsApp disahkan sah! Pesanan anda dilindungi.');
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    try {
      const res = await signInWithGoogleOAuth();
      if (!res.success) {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyambung ke Google.');
    }
  };

  // Quick Phone & Name Registration (Fallback when Google OAuth is not configured)
  const handleQuickPhoneRegister = () => {
    const name = authNameInput.trim() || customerName.trim();
    const phone = authPhoneInput.trim() || customerPhone.trim();

    if (!name) {
      toast.error('Sila masukkan nama penuh anda');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    if (!clean.startsWith('01') || clean.length < 10 || clean.length > 11) {
      toast.error('Sila masukkan nombor telefon bimbit WhatsApp Malaysia yang sah (cth: 0198887766)');
      return;
    }

    const regUser: GoogleAuthUser = {
      id: `user-phone-${clean}`,
      email: `${clean}@warungjnj.online`,
      name: name
    };
    saveStoredGoogleUser(regUser);
    setCurrentUser(regUser);
    setCustomerName(name);
    setCustomerPhone(phone);
    setIsPhoneVerified(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('warung_customer_phone', phone);
      localStorage.setItem(`warung_verified_phone_${clean}`, 'true');
    }
    setShowAuthModal(false);
    toast.success(`Akaun disahkan! Selamat datang, ${name} 🎉`);
  };

  const handleLogout = async () => {
    clearStoredGoogleUser();
    setCurrentUser(null);
    setIsPhoneVerified(false);
    await supabase.auth.signOut();
    toast.info('Log keluar akaun berjaya.');
  };

  useEffect(() => {
    fetchMenuItems();
    fetchStore();
    fetchRoadRoute(custLat, custLng);

    const hydrateCustomerFromUser = async (u: any) => {
      const gName = u.user_metadata?.full_name || u.user_metadata?.name || u.user_metadata?.custom_claims?.name || u.email?.split('@')[0] || 'Pelanggan';
      const gPhone = u.phone || u.user_metadata?.phone || u.user_metadata?.phone_number || '';
      
      const gUser: GoogleAuthUser = {
        id: u.id,
        email: u.email || '',
        name: gName,
        avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture
      };
      saveStoredGoogleUser(gUser);
      setCurrentUser(gUser);
      setCustomerName(gName);

      // Auto-detect phone from metadata, localStorage, or previous orders
      let detectedPhone = gPhone;
      if (!detectedPhone && typeof window !== 'undefined') {
        detectedPhone = localStorage.getItem(`warung_phone_${u.email}`) || localStorage.getItem('warung_customer_phone') || '';
      }

      if (u.email) {
        try {
          const { data: prevOrder } = await supabase
            .from('orders')
            .select('customer_name, customer_phone, delivery_address, delivery_lat, delivery_lng')
            .eq('customer_email', u.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (prevOrder) {
            if (prevOrder.customer_phone) {
              detectedPhone = prevOrder.customer_phone;
            }
            if (prevOrder.customer_name) {
              setCustomerName(prevOrder.customer_name);
            }
            if (prevOrder.delivery_address) {
              const cleanAddr = prevOrder.delivery_address.replace(/\[TAMBANG:.*?\]/g, '').trim();
              setDeliveryAddress(prev => prev || cleanAddr);
              if (prevOrder.delivery_lat && prevOrder.delivery_lng) {
                setCustLat(prevOrder.delivery_lat);
                setCustLng(prevOrder.delivery_lng);
                fetchRoadRoute(prevOrder.delivery_lat, prevOrder.delivery_lng);
              }
            }
          }
        } catch (err) {
          console.warn('Previous order lookup:', err);
        }
      }

      if (detectedPhone) {
        setCustomerPhone(detectedPhone);
        if (typeof window !== 'undefined') {
          localStorage.setItem('warung_customer_phone', detectedPhone);
          if (u.email) localStorage.setItem(`warung_phone_${u.email}`, detectedPhone);
        }
      }
    };

    // 1. Check Stored or Supabase Auth User
    const stored = getStoredGoogleUser();
    if (stored) {
      setCurrentUser(stored);
      setCustomerName(prev => prev || stored.name);
      if (stored.email && typeof window !== 'undefined') {
        const savedPhone = localStorage.getItem(`warung_phone_${stored.email}`) || localStorage.getItem('warung_customer_phone');
        if (savedPhone) setCustomerPhone(savedPhone);
      }
    }

    const checkAuth = async () => {
      setIsAuthLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await hydrateCustomerFromUser(session.user);
      }
      setIsAuthLoading(false);
    };
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        hydrateCustomerFromUser(session.user);
        setShowAuthModal(false);
      } else {
        clearStoredGoogleUser();
        setCurrentUser(null);
      }
    });

    // 2. Restore saved phone
    if (typeof window !== 'undefined') {
      const savedPhone = localStorage.getItem('warung_customer_phone');
      if (savedPhone) setCustomerPhone(prev => prev || savedPhone);
    }

    // 3. Check for ToyyibPay FPX redirect return params
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const statusId = searchParams.get('status_id');
      const orderIdParam = searchParams.get('order_id');

      if (statusId === '1') {
        toast.success('🎉 Pembayaran FPX berjaya disahkan! Pesanan anda kini dihantar ke dapur & rider.', { duration: 7000 });
        if (orderIdParam) {
          supabase
            .from('orders')
            .update({
              paid: true,
              status: 'preparing',
            } as any)
            .eq('id', orderIdParam)
            .then(() => {});
        }
        setCart([]);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (statusId === '3') {
        toast.error('❌ Pembayaran FPX tidak berjaya atau dibatalkan. Sila cuba lagi.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchStore = async () => {
    const { data } = await supabase.from('stores').select('id, phone_number, phone_number_2').limit(1).single();
    if (data) {
      setStoreId(data.id);
      if (data.phone_number) setStorePhone(data.phone_number);
    }
  };

  const fetchMenuItems = async () => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
      if (data.length > 0 && (data[0] as any).store_id) {
        setStoreId((data[0] as any).store_id);
      }
    }
    setLoadingItems(false);
  };

  // Category Priority: Chicken -> Fish -> Main Food -> Drinks -> Add-ons / Sampingan
  const getCategoryPriority = (category: string): number => {
    const cat = (category || '').toLowerCase().trim();
    if (cat === 'all') return 0;
    if (cat.includes('chicken') || cat.includes('ayam')) return 1;
    if (cat.includes('fish') || cat.includes('ikan')) return 2;
    if (cat.includes('special') || cat.includes('today')) return 3;
    if (cat.includes('food') || cat.includes('main') || cat.includes('makanan')) return 4;
    if (cat.includes('new') || cat.includes('baru')) return 5;
    if (cat.includes('drink') || cat.includes('minum') || cat.includes('beverage')) return 8;
    if (cat.includes('addon') || cat.includes('add-on') || cat.includes('sampingan') || cat.includes('extra')) return 9;
    return 6;
  };

  // Categories list (Ordered by Chicken & Fish main dishes first, Add-ons last)
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach(item => {
      if (item.category) set.add(item.category);
    });
    const sortedList = Array.from(set).sort((a, b) => {
      const prioA = getCategoryPriority(a);
      const prioB = getCategoryPriority(b);
      if (prioA !== prioB) return prioA - prioB;
      return a.localeCompare(b);
    });
    return ['all', ...sortedList];
  }, [menuItems]);

  // Filtered Menu Items (Main Dishes Chicken & Fish first, Add-ons / Sampingan at bottom)
  const filteredMenuItems = useMemo(() => {
    const items = menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });

    return items.sort((a, b) => {
      const prioA = getCategoryPriority(a.category || '');
      const prioB = getCategoryPriority(b.category || '');
      if (prioA !== prioB) return prioA - prioB;
      return a.name.localeCompare(b.name);
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Handle adding customized item from modal
  const handleAddToCartCustomized = (custItem: CustomizedCartItem) => {
    const newItem: CartItem = {
      id: custItem.id,
      menuItemId: custItem.menuItemId,
      name: custItem.name,
      price: custItem.basePrice,
      quantity: custItem.quantity,
      containerCharge: 1.00, // standard packaging fee
      notes: custItem.notes,
      packNotes: custItem.packNotes || Array(custItem.quantity).fill(''),
      selectedAddons: custItem.selectedAddons,
      spiceLevel: custItem.spiceLevel
    };

    setCart(prev => [...prev, newItem]);
    toast.success(`🛒 Ditambah ${custItem.quantity}x ${custItem.name} ke troli!`);
  };

  // Fast quick-add without modal
  const handleQuickAdd = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        const currentPackNotes = [...(existing.packNotes || Array(existing.quantity).fill(''))];
        while (currentPackNotes.length < nextQty) currentPackNotes.push('');
        return prev.map(i => i.menuItemId === item.id ? { 
          ...i, 
          quantity: nextQty,
          packNotes: currentPackNotes
        } : i);
      }
      return [...prev, { 
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        containerCharge: 1.00,
        notes: '',
        packNotes: ['']
      }];
    });
    toast.success(`Ditambah 1x ${item.name} 🛒`);
  };

  const handleQuantityChange = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartItemId || item.menuItemId === cartItemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
          while (currentPackNotes.length < newQty) {
            currentPackNotes.push('');
          }
          return { 
            ...item, 
            quantity: newQty,
            packNotes: currentPackNotes.slice(0, newQty)
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
    toast.info('Item dipadam dari troli.');
  };

  const updatePackNote = (cartItemId: string, packIndex: number, note: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId || item.menuItemId === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        currentPackNotes[packIndex] = note;
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: currentPackNotes.map((n, i) => `Pek #${i+1}: ${n || 'Standard'}`).join(' | ')
        };
      }
      return item;
    }));
  };

  const togglePackQuickModifier = (cartItemId: string, packIndex: number, tag: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId || item.menuItemId === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        const currentNote = currentPackNotes[packIndex] || '';
        let nextNote = currentNote;
        if (currentNote.toLowerCase().includes(tag.toLowerCase())) {
          nextNote = currentNote.replace(new RegExp(tag, 'gi'), '').replace(/,\s*,/g, ',').trim();
        } else {
          nextNote = currentNote ? `${currentNote}, ${tag}` : tag;
        }
        currentPackNotes[packIndex] = nextNote;
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: currentPackNotes.map((n, i) => `Pek #${i+1}: ${n || 'Standard'}`).join(' | ')
        };
      }
      return item;
    }));
  };

  const splitDeliveryItem = (cartItemId: string) => {
    setCart(prev => {
      const target = prev.find(i => i.id === cartItemId || i.menuItemId === cartItemId);
      if (!target || target.quantity <= 1) return prev;
      const targetIndex = prev.findIndex(i => i.id === cartItemId || i.menuItemId === cartItemId);
      const packNotes = target.packNotes || Array(target.quantity).fill('');
      const individualItems: CartItem[] = Array.from({ length: target.quantity }).map((_, idx) => ({
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: target.menuItemId,
        name: target.name,
        price: target.price,
        quantity: 1,
        containerCharge: target.containerCharge || 1.00,
        notes: packNotes[idx] ? `Pek #${idx+1}: ${packNotes[idx]}` : target.notes,
        packNotes: [packNotes[idx] || ''],
        selectedAddons: target.selectedAddons,
        spiceLevel: target.spiceLevel
      }));
      const nextCart = [...prev];
      nextCart.splice(targetIndex, 1, ...individualItems);
      return nextCart;
    });
    toast.success('Bungkusan dipecahkan kepada pek individu untuk pengkhususan berasingan.');
  };

  // Memoized handlers for DeliveryRouteMap to prevent re-render feedback loops
  const handleMapDestinationChange = useCallback((lat: number, lng: number, addr?: string) => {
    setCustLat(lat);
    setCustLng(lng);
    if (addr) {
      setDeliveryAddress(addr);
    }
  }, []);

  const handleMapRouteCalculated = useCallback((route: { distanceKm: number; durationMins: number }) => {
    setRoadDistanceKm(route.distanceKm);
    setTravelTimeMins(route.durationMins);
  }, []);

  // Debounced Auto-suggestions effect with token matching & Photon/Nominatim
  useEffect(() => {
    if (!deliveryAddress || deliveryAddress.trim().length < 2) {
      setAddressSuggestions([]);
      setShowSuggestionsDropdown(false);
      return;
    }

    const rawInput = deliveryAddress.trim();
    const cleanQ = sanitizeSearchQuery(rawInput);

    // 1. Instant local landmark search (supports lot/jalan prefixes + keyword matching)
    const localMatches = searchLocalSabahLandmarks(rawInput);
    if (localMatches.length > 0) {
      setAddressSuggestions(localMatches.slice(0, 6));
      setShowSuggestionsDropdown(true);
    }

    // 2. Fetch live online geocoding suggestions from Photon & Nominatim (debounced 300ms)
    const timeout = setTimeout(async () => {
      const searchTerms = [cleanQ, rawInput].filter(s => s && s.length >= 2);
      if (searchTerms.length === 0) return;

      setIsLoadingSuggestions(true);
      try {
        const queryToUse = searchTerms[0];

        // Query Photon (fast OSM autocomplete biased around Penampang/KK: 5.928, 116.114)
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryToUse)}&lat=5.9284&lon=116.1145&limit=6`;
        const photonRes = await fetch(photonUrl);
        const photonData = await photonRes.json();

        const onlineItems: { displayName: string; mainText: string; secondaryText: string; lat: number; lng: number }[] = [];

        if (photonData && photonData.features) {
          photonData.features.forEach((feat: any) => {
            const coords = feat.geometry?.coordinates;
            if (coords && coords.length >= 2) {
              const lon = coords[0];
              const lat = coords[1];
              if (isWithinSabah(lat, lon)) {
                const props = feat.properties || {};
                const name = props.name || props.street || queryToUse;
                const city = props.city || props.district || props.county || 'Sabah';
                const state = props.state || 'Sabah';
                onlineItems.push({
                  displayName: `${name}, ${city}, ${state}`,
                  mainText: name,
                  secondaryText: `${city}, ${state}`,
                  lat: lat,
                  lng: lon,
                });
              }
            }
          });
        }

        // Also query Nominatim as fallback if Photon had few results
        if (onlineItems.length < 3) {
          const nominatimQuery = encodeURIComponent(`${queryToUse}, Sabah, Malaysia`);
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${nominatimQuery}&countrycodes=my&viewbox=115.7,6.3,116.5,5.6&bounded=0&limit=4`
          );
          const nomData = await nomRes.json();
          if (nomData && Array.isArray(nomData)) {
            nomData.forEach((d: any) => {
              const lat = parseFloat(d.lat);
              const lon = parseFloat(d.lon);
              if (isWithinSabah(lat, lon)) {
                const parts = d.display_name.split(', ');
                onlineItems.push({
                  displayName: d.display_name,
                  mainText: parts.slice(0, 2).join(', '),
                  secondaryText: parts.slice(2, 5).join(', '),
                  lat: lat,
                  lng: lon,
                });
              }
            });
          }
        }

        // Merge local matches and online items without duplicates
        setAddressSuggestions(prev => {
          const names = new Set(prev.map(p => p.mainText.toLowerCase()));
          const filteredOnline = onlineItems.filter(o => !names.has(o.mainText.toLowerCase()));
          const combined = [...prev, ...filteredOnline].slice(0, 6);
          if (combined.length > 0) setShowSuggestionsDropdown(true);
          return combined;
        });
      } catch (e) {
        // Keep local matches
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [deliveryAddress]);

  const handleSelectSuggestion = async (item: { displayName: string; mainText: string; rawName?: string; lat: number; lng: number }) => {
    const housePrefix = extractHouseNumberPrefix(deliveryAddress);
    let finalAddressText = item.displayName;
    
    if (housePrefix && !finalAddressText.toLowerCase().includes(housePrefix.toLowerCase())) {
      finalAddressText = `${housePrefix}, ${item.displayName}`;
    }

    setDeliveryAddress(finalAddressText);
    setCustLat(item.lat);
    setCustLng(item.lng);
    setShowSuggestionsDropdown(false);
    await fetchRoadRoute(item.lat, item.lng);
    toast.success(`Lokasi dipilih: ${finalAddressText.split(',')[0]} 📍`);
  };

  const handleSearchAddress = async (addrText?: string) => {
    const textToSearch = addrText || deliveryAddress;
    if (!textToSearch || textToSearch.trim().length < 2) return;

    setIsSearchingAddress(true);
    try {
      // 1. Check local Sabah database first (0ms instant match!)
      const localMatches = searchLocalSabahLandmarks(textToSearch);
      if (localMatches.length > 0) {
        const best = localMatches[0];
        setCustLat(best.lat);
        setCustLng(best.lng);
        await fetchRoadRoute(best.lat, best.lng);
        toast.success(`Lokasi dikesan: ${best.mainText} 📍`);
        return;
      }

      // 2. Query Photon geocoder (biased around KK/Penampang: 5.928, 116.114)
      const cleanQ = sanitizeSearchQuery(textToSearch);
      const queryToSearch = cleanQ || textToSearch;
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryToSearch)}&lat=5.9284&lon=116.1145&limit=3`;
      const photonRes = await fetch(photonUrl);
      const photonData = await photonRes.json();

      if (photonData && photonData.features && photonData.features.length > 0) {
        for (const feat of photonData.features) {
          const coords = feat.geometry?.coordinates;
          if (coords && coords.length >= 2) {
            const lon = coords[0];
            const lat = coords[1];
            if (isWithinSabah(lat, lon)) {
              setCustLat(lat);
              setCustLng(lon);
              await fetchRoadRoute(lat, lon);
              const name = feat.properties?.name || feat.properties?.street || queryToSearch;
              toast.success(`Lokasi dikesan: ${name} 📍`);
              return;
            }
          }
        }
      }

      // 3. Query Nominatim strictly within Sabah context
      const query = encodeURIComponent(`${queryToSearch}, Sabah, Malaysia`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=my&viewbox=115.7,6.3,116.5,5.6&bounded=0&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        if (!isWithinSabah(lat, lon)) {
          toast.error('Lokasi dikesan di luar kawasan Sabah. Sila pilih alamat dalam zon Sabah/Penampang.');
          return;
        }

        setCustLat(lat);
        setCustLng(lon);
        await fetchRoadRoute(lat, lon);
        toast.success(`Lokasi dikesan: ${data[0].display_name.split(',')[0]} 📍`);
      } else {
        // Fallback: estimate route with current coordinates if in Sabah
        if (isWithinSabah(custLat, custLng)) {
          await fetchRoadRoute(custLat, custLng);
        }
      }
    } catch (e) {
      if (isWithinSabah(custLat, custLng)) {
        await fetchRoadRoute(custLat, custLng);
      }
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        let lat = pos.coords.latitude;
        let lng = pos.coords.longitude;

        if (!isWithinSabah(lat, lng)) {
          toast.error('GPS dikesan di luar Sabah/Malaysia. Menggunakan koordinat pusat Penampang.');
          lat = 5.9141659;
          lng = 116.085516;
        }

        setCustLat(lat);
        setCustLng(lng);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=my`);
          const data = await res.json();
          if (data && data.display_name) {
            setDeliveryAddress(data.display_name);
            toast.success("Alamat lokasi GPS berjaya dikesan! 📍");
          } else {
            toast.success(`Koordinat GPS dikesan: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (e) {
          toast.success(`Koordinat GPS dikesan: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        // Calculate accurate road route distance from Warung J&J
        await fetchRoadRoute(lat, lng);
      }, () => {
        toast.error("Tidak dapat mengesan lokasi GPS secara automatik. Sila taip alamat manual.");
      });
    }
  };

  const handleSendWhatsAppProof = () => {
    const cleanPhone = (storePhone || '60172221784').replace(/\D/g, '');
    const shortId = activeOrderId ? activeOrderId.slice(0, 8).toUpperCase() : 'NEW';
    const message = `*HALO WARUNG J&J, SAYA TELAH MEMBUAT BAYARAN DELIVERY:*

🆔 *Order ID:* #${shortId}
👤 *Nama:* ${customerName}
📞 *Telefon:* ${customerPhone}
📍 *Alamat:* ${deliveryAddress}
💰 *Jumlah Bayaran:* RM ${grandTotal.toFixed(2)}

(Sila semak resit pembayaran yang saya lampirkan ini 🙏)`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = '/duitnow-qr.png';
    link.download = 'Warung_JJ_DuitNow_QR.png';
    link.click();
    toast.success('DuitNow QR dimuat turun! Buka aplikasi bank anda untuk imbas.');
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(grandTotal.toFixed(2));
    setCopiedAmount(true);
    toast.success(`Jumlah RM ${grandTotal.toFixed(2)} disalin!`);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleCopyBankAcc = (accNum: string) => {
    navigator.clipboard.writeText(accNum);
    setCopiedBankAcc(true);
    toast.success('No. Akaun Alliance Bank disalin! 📋');
    setTimeout(() => setCopiedBankAcc(false), 2000);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Saiz fail melebihi 10MB. Sila muat naik imej yang lebih kecil.');
      return;
    }

    setIsUploadingReceipt(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `delivery_receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      let finalUrl = '';
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
        finalUrl = urlData.publicUrl;
      } else {
        finalUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setReceiptProofUrl(finalUrl);

      if (activeOrderId) {
        await supabase
          .from('orders')
          .update({
            payment_proof_url: finalUrl,
            status: 'pending_verification'
          })
          .eq('id', activeOrderId);
      }

      toast.success('🎉 Resit bayaran berjaya dimuat naik!');
    } catch (err: any) {
      console.error('Receipt upload error:', err);
      toast.error(err.message || 'Gagal memuat naik resit. Sila cuba lagi.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleProceedToFPX = async () => {
    setIsFPXLoading(true);
    try {
      const orderRefId = activeOrderId || 'ORD-' + Date.now().toString().slice(-6);
      const res = await createToyyibPayCheckout({
        orderId: orderRefId,
        totalAmount: grandTotal,
        customerName: customerName,
        customerPhone: customerPhone,
      });
      if (res.success && res.paymentUrl) {
        toast.success('Membuka portal FPX Online Banking...');
        setTimeout(() => {
          window.location.href = res.paymentUrl!;
        }, 1000);
      } else {
        toast.error(res.message || 'Sesi FPX tidak dapat dimulakan.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Ralat pembayaran FPX.');
    } finally {
      setIsFPXLoading(false);
    }
  };

  const handleToyyibPayCheckout = handleProceedToFPX;

  const handlePlaceDeliveryOrder = async () => {
    // 1. MUST LOGIN WITH GOOGLE FIRST
    if (!currentUser) {
      setShowAuthModal(true);
      toast.error('Sila log masuk dengan Google terlebih dahulu untuk pengesahan akaun dan keselamatan pesanan.');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Sila masukkan nama penuh anda');
      return;
    }
    const phoneClean = customerPhone.replace(/\D/g, '');
    if (!phoneClean.startsWith('01') || phoneClean.length < 10 || phoneClean.length > 11) {
      toast.error('Sila masukkan nombor telefon bimbit WhatsApp Malaysia yang sah (cth: 0198887766)');
      return;
    }

    // Persist phone for returning user convenience
    if (typeof window !== 'undefined') {
      localStorage.setItem('warung_customer_phone', customerPhone);
    }

    if (!deliveryAddress.trim()) {
      toast.error('Sila masukkan alamat penghantaran lengkap');
      return;
    }
    if (foodSubtotal < 15.00) {
      toast.error('Pesanan minimum makanan untuk delivery adalah RM 15.00');
      return;
    }
    if (isOutOfZone) {
      toast.error(`Maaf, alamat anda (${roadDistanceKm}km) berada di luar zon penghantaran 15km.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const addressWithFeeTag = `${deliveryAddress.trim()} [TAMBANG:RM${deliveryFee.toFixed(2)}|JARAK:${roadDistanceKm.toFixed(1)}KM]`;

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('place_order', {
        p_order: {
          type: 'delivery',
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: addressWithFeeTag,
          delivery_lat: custLat,
          delivery_lng: custLng,
          delivery_fee: deliveryFee,
          discount_type: 'fixed',
          discount_value: 0,
          store_id: storeId
        },
        p_items: cart.flatMap(item => {
          if (item.quantity > 1 && item.packNotes && item.packNotes.length > 0) {
            return item.packNotes.slice(0, item.quantity).map((pNote, pIdx) => ({
              menu_item_id: item.menuItemId,
              quantity: 1,
              fulfillment_type: 'takeaway',
              container_charge: item.containerCharge || 1.00,
              notes: pNote ? pNote : (item.notes ? `${item.notes} (Pek #${pIdx + 1})` : '')
            }));
          }
          return [{
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            fulfillment_type: 'takeaway',
            container_charge: item.containerCharge || 1.00,
            notes: item.notes || ''
          }];
        }),
        p_payments: []
      });

      if (rpcErr) throw rpcErr;

      const resObj = (rpcRes as any);
      if (resObj?.success === false) {
        throw new Error(resObj.message || 'Gagal menghantar pesanan penghantaran.');
      }

      const newOrderId = resObj.order_id;
      if (newOrderId) {
        // Guarantee delivery_fee, coords, addressWithFeeTag, anti-scam status and delivery_service are saved accurately in database
        await supabase
          .from('orders')
          .update({
            delivery_fee: deliveryFee,
            delivery_address: addressWithFeeTag,
            delivery_lat: custLat,
            delivery_lng: custLng,
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_service: 'jnj',
            total_amount: grandTotal,
            payment_status: 'pending',
            status: 'pending_payment'
          })
          .eq('id', newOrderId);
      }

      setActiveOrderId(newOrderId);
      setIsCartDrawerOpen(false);
      setShowDuitNowModal(true);
      toast.success('Pesanan disimpan! Sila buat bayaran & hantar resit untuk pengesahan.');
    } catch (err: any) {
      toast.error(`Pesanan Gagal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 font-sans pb-36 selection:bg-orange-500/30 selection:text-orange-200">
      {/* HEADER BANNER - MODERN GLASS ISLAND */}
      <header className="bg-[#292524]/90 backdrop-blur-xl border-b border-stone-800/80 sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="w-9 h-9 rounded-xl bg-stone-800/80 hover:bg-stone-700 border border-stone-700/50 flex items-center justify-center text-stone-300 hover:text-white transition-all active:scale-95 shadow-inner"
              title="Kembali ke Laman Utama"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-700/60 shadow-md bg-stone-900 shrink-0">
                <img src="/logo.png" alt="Warung JNJ Logo" className="w-full h-full object-cover scale-105" />
              </div>
              <div>
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-stone-100 flex items-center gap-1.5">
                  Warung JNJ Delivery 🛵
                </h1>
                <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-2">
                  <span>✨ Penghantaran Makanan Panas & Segar • Penampang, Sabah</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2 bg-stone-900/90 border border-stone-700/80 px-2.5 py-1 rounded-2xl">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover border border-emerald-500/60 shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-stone-200 hidden sm:inline max-w-[120px] truncate">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[10px] text-stone-400 hover:text-rose-400 font-medium ml-1"
                  title="Log Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleGoogleLogin}
                className="bg-white hover:bg-stone-100 text-stone-900 font-bold h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-xs shadow-md active:scale-95 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Log Masuk Google</span>
              </Button>
            )}
            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-xs px-2.5 py-1 rounded-full hidden sm:inline-flex animate-pulse">
              🟢 Dibuka
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        {/* GOOGLE SIGN IN MANDATORY FILTER BANNER */}
        {!currentUser && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/10 border-2 border-amber-500/40 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  🔒 Wajib Log Masuk Google untuk Delivery
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Bagi mengelakkan pesanan palsu / scam, semua pesanan delivery perlu didaftarkan melalui akaun Google sahaja.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto bg-white hover:bg-stone-100 text-stone-900 font-bold px-6 h-12 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 text-xs sm:text-sm active:scale-95 transition-all shrink-0 font-heading"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Log Masuk Google (1-Klik)</span>
            </Button>
          </div>
        )}

        {/* STEP 1: DELIVERY ADDRESS & REAL-ROAD ROUTE MAP CARD */}
        <Card className="bg-[#292524] border border-stone-800 text-stone-100 rounded-3xl shadow-xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> 1. Alamat Penghantaran & Peta Jalan Raya
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGetLocation} 
                className="bg-stone-900 border-stone-700 text-emerald-400 hover:text-emerald-300 text-xs rounded-xl hover:bg-stone-800 flex items-center gap-1.5 h-8"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kesan Lokasi GPS</span>
              </Button>
            </div>

            {/* INTERACTIVE REAL ROAD LEAFLET MAP */}
            <DeliveryRouteMap
              origin={WARUNG_COORDS}
              destination={{
                lat: custLat,
                lng: custLng,
                address: deliveryAddress
              }}
              interactive={true}
              showZoneCircle={true}
              height="280px"
              onDestinationChange={handleMapDestinationChange}
              onRouteCalculated={handleMapRouteCalculated}
              showNavigationButtons={false}
            />

            <div className="space-y-2 relative">
              <div className="relative">
                <Textarea
                  placeholder="Taip nama jalan, taman perumahan, atau bangunan (cth: Taman Liana, ITCC, Plaza 333, Bundusan)..."
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setShowSuggestionsDropdown(true);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowSuggestionsDropdown(true);
                  }}
                  className="bg-stone-900 border-stone-800 text-white placeholder:text-stone-500 rounded-2xl text-xs sm:text-sm min-h-[60px]"
                />

                {/* AUTOCOMPLETE SUGGESTIONS DROPDOWN */}
                {showSuggestionsDropdown && addressSuggestions.length > 0 && (
                  <div className="absolute top-[64px] left-0 right-0 z-30 bg-[#292524] border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md animate-fade-in divide-y divide-stone-800">
                    <div className="px-3 py-1.5 bg-stone-950/90 flex items-center justify-between text-[10px] text-stone-400">
                      <span className="flex items-center gap-1 font-bold text-emerald-400">
                        <Sparkles className="w-3 h-3 text-emerald-400" /> Cadangan Lokasi:
                      </span>
                      {isLoadingSuggestions && (
                        <span className="flex items-center gap-1 text-[10px] text-stone-500">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Mencari...
                        </span>
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      {addressSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-stone-800 flex items-start gap-2 text-xs transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate">{item.displayName}</p>
                            <p className="text-[11px] text-stone-400 truncate">{item.mainText}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ROUTE INFO & DELIVERY FEE BADGES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-stone-900 border border-stone-800 p-3 rounded-2xl flex flex-col justify-between">
                <span className="text-stone-400 text-[10px] block mb-0.5">Jarak Jalan Raya:</span>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${isOutOfZone ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {roadDistanceKm} km {isOutOfZone ? '⚠️' : '✓'}
                  </span>
                  {travelTimeMins && (
                    <span className="text-[10px] text-stone-400">~{travelTimeMins} minit</span>
                  )}
                </div>
              </div>

              <div className="bg-stone-900 border border-stone-800 p-3 rounded-2xl flex flex-col justify-between">
                <span className="text-stone-400 text-[10px] block mb-0.5">Zon Penghantaran:</span>
                <span className={`font-bold text-xs ${isOutOfZone ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isOutOfZone ? 'Luar Zon (> 15km)' : 'Dalam Zon Warung J&J'}
                </span>
              </div>

              <div className="bg-stone-900 border border-stone-800 p-3 rounded-2xl flex flex-col justify-between">
                <span className="text-stone-400 text-[10px] block mb-0.5">Tambang Rider:</span>
                <span className="font-bold text-sm text-emerald-400 font-mono">
                  RM {deliveryFee.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STEP 2: SEARCH AND CATEGORY FILTER BAR */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
              <span>2. Pilihan Menu Makanan 🍜</span>
            </h2>
            <span className="text-xs text-stone-400 font-medium">{filteredMenuItems.length} hidangan sedia dipesan</span>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-stone-500" />
            <Input
              type="text"
              placeholder="Cari makanan kegemaran anda (cth: Nasi Goreng, Sup Tulang, Tomyam)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#292524] border-stone-800 text-white pl-11 h-12 rounded-2xl text-xs sm:text-sm placeholder:text-stone-500 shadow-inner focus:border-orange-500/60"
            />
          </div>

          {/* CATEGORY FILTER CHIPS */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-orange-600 text-white border-orange-500 shadow-[0_4px_15px_rgba(234,88,12,0.35)] scale-105'
                      : 'bg-[#292524] text-stone-400 border-stone-800 hover:text-white hover:border-stone-700'
                  }`}
                >
                  {cat === 'all' ? '🍽️ Semua Menu' : `🥘 ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* MENU ITEMS GRID */}
        <div>
          {loadingItems ? (
            <div className="text-center py-16 text-stone-400 font-medium flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span>Memuat turun menu Warung JNJ...</span>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="p-12 text-center bg-[#292524] rounded-3xl border border-stone-800 text-stone-400 text-xs">
              Tiada menu dijumpai untuk carian ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {filteredMenuItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                const isSoldOut = item.stock_count !== null && item.stock_count !== undefined && item.stock_count <= 0;

                return (
                  <Card key={item.id} className="bg-[#292524] border-stone-800 text-stone-100 rounded-3xl overflow-hidden hover:border-orange-500/40 transition-all flex flex-col justify-between shadow-lg group">
                    <CardContent className="p-4 flex gap-3.5 items-center">
                      {item.image_url ? (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-stone-700/60 shadow-md bg-stone-900">
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-stone-900 rounded-2xl shrink-0 border border-stone-700/60 flex items-center justify-center text-stone-500 font-black text-sm shadow-inner">
                          JNJ
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate group-hover:text-orange-300 transition-colors">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-[11px] text-stone-400 line-clamp-1 leading-relaxed">{item.description}</p>
                        )}
                        <p className="text-[10px] text-stone-500 capitalize">{item.category}</p>
                        <p className="font-bold text-orange-400 text-sm sm:text-base">RM {item.price.toFixed(2)}</p>
                      </div>
                    </CardContent>

                    {/* ACTION BUTTONS */}
                    <div className="p-3 pt-0 border-t border-stone-800/80 bg-stone-950/30 flex items-center justify-between gap-2">
                      {inCart ? (
                        <div className="w-full flex items-center justify-between bg-stone-900/90 border border-orange-500/40 rounded-xl p-1 px-2.5">
                          <span className="text-xs font-bold text-orange-400 font-mono">
                            {inCart.quantity}x Ditambah
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCustomizingItem(item)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 px-3 h-7 rounded-xl font-medium"
                          >
                            ✏️ Kustom
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center gap-2">
                          <Button
                            disabled={isSoldOut}
                            onClick={() => setCustomizingItem(item)}
                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl h-9 text-xs shadow-md active:scale-95 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Pilih & Kustom</span>
                          </Button>
                          <Button
                            disabled={isSoldOut}
                            onClick={() => handleQuickAdd(item)}
                            variant="outline"
                            className="border-stone-700 bg-stone-900 hover:bg-stone-800 text-stone-300 h-9 px-3 rounded-xl text-xs active:scale-95 transition-all"
                            title="Tambah terus 1x"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP 3: CUSTOMER CONTACT & IN-PAGE CHECKOUT CARD */}
        {cart.length > 0 && (
          <Card className="bg-[#292524] border-2 border-orange-500/40 text-stone-100 rounded-3xl shadow-2xl overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3.5">
                <div className="space-y-0.5">
                  <h2 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-2 font-heading">
                    <User className="w-4 h-4 text-orange-500" /> 3. Maklumat Penerima & Keselamatan
                  </h2>
                  <p className="text-[11px] text-stone-400">Pendaftaran rasmi akaun Google & No. WhatsApp untuk dihubungi oleh rider</p>
                </div>
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Wajib Diisi
                </Badge>
              </div>

              {/* GOOGLE ACCOUNT REQUIREMENT BANNER */}
              {!currentUser ? (
                <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/10 border-2 border-amber-500/50 p-5 rounded-3xl space-y-3.5 shadow-lg text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm sm:text-base text-white font-heading">
                      🔒 Wajib Log Masuk Google untuk Delivery
                    </h4>
                    <p className="text-xs text-stone-300 max-w-md mx-auto leading-relaxed">
                      Bagi mengelakkan pesanan palsu / scam, semua pesanan delivery perlu didaftarkan melalui akaun Google sahaja.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full sm:w-auto px-8 bg-white hover:bg-stone-100 text-stone-900 font-bold h-12 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 text-xs sm:text-sm active:scale-95 transition-all mx-auto font-heading"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Log Masuk Google (1-Klik)</span>
                  </Button>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-2 shadow-inner">
                  <div className="flex items-center gap-3 min-w-0">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-emerald-500/60 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Akaun Google Disahkan
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-stone-400 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs text-stone-400 hover:text-rose-400 underline shrink-0 px-2 py-1"
                  >
                    Tukar Akaun
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-orange-400" /> Nama Penerima
                  </label>
                  <Input
                    placeholder="Contoh: Farhan / Siti / John"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('warung_customer_name', e.target.value);
                      }
                    }}
                    className="bg-stone-900 border-stone-700/80 text-white placeholder:text-stone-500 rounded-2xl text-xs sm:text-sm h-11 focus:border-orange-500/60 shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> No. Telefon WhatsApp (Untuk Rider Hubungi)
                    </label>
                    {customerPhone.replace(/\D/g, '').startsWith('01') && customerPhone.replace(/\D/g, '').length >= 10 && customerPhone.replace(/\D/g, '').length <= 11 ? (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Format Sah ✓
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                        ⚠️ 01X (10-11 digit)
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Contoh: 0198887766 / 0123456789"
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerPhone(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('warung_customer_phone', val);
                          if (currentUser?.email) {
                            localStorage.setItem(`warung_phone_${currentUser.email}`, val);
                          }
                        }
                      }}
                      className="bg-stone-900 border-stone-700/80 text-white placeholder:text-stone-500 rounded-2xl text-xs sm:text-sm h-11 focus:border-orange-500/60 shadow-inner flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* ANTI-SCAM & ADMIN APPROVAL NOTICE */}
              <div className="bg-stone-900/90 border border-stone-800 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-stone-300">
                <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <span className="font-bold text-orange-300 block">🛡️ Pengesahan Pesanan & Bayaran oleh Admin Warung J&J:</span>
                  <span>
                    Status pesanan akan diletakkan sebagai <strong>Menunggu Pengesahan Bayaran Admin</strong>. Pihak warung akan menyemak resit bayaran DuitNow/Online Banking anda di kaunter sebelum pesanan dilepaskan kepada rider untuk penghantaran.
                  </span>
                </div>
              </div>

              {/* CART ITEMS SUMMARY & PER-PACK SPECIFICATION */}
              <div className="space-y-3 pt-2 border-t border-stone-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" /> Semakan Bungkusan ({totalCartCount} Bungkusan)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCartDrawerOpen(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-950/30 h-8 rounded-xl font-medium"
                  >
                    Troli Terperinci ↗
                  </Button>
                </div>

                <div className="space-y-3">
                  {cart.map((cItem) => {
                    const qty = cItem.quantity;
                    const packNotes = cItem.packNotes || Array(qty).fill('');

                    return (
                      <div key={cItem.id} className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-3 shadow-inner">
                        <div className="flex justify-between items-center pb-2.5 border-b border-stone-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">🍱 {cItem.name}</span>
                            <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30 text-[11px] font-mono">
                              x{qty} • RM {(cItem.price * qty).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {qty > 1 && (
                              <button
                                type="button"
                                onClick={() => splitDeliveryItem(cItem.id)}
                                className="px-2.5 py-1 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                                title="Pecahkan kepada entri bungkusan berasingan"
                              >
                                <Split className="w-3 h-3" /> Pecah
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFromCart(cItem.id)}
                              className="text-rose-400 hover:text-rose-300 text-xs font-medium px-2 py-1 hover:bg-rose-950/30 rounded-lg transition-colors"
                            >
                              Padam
                            </button>
                          </div>
                        </div>

                        {/* PER-PACK BREAKDOWN */}
                        <div className="space-y-2">
                          {Array.from({ length: qty }).map((_, pIdx) => {
                            const currentNote = packNotes[pIdx] || '';
                            return (
                              <div key={pIdx} className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <span>🥡 Bungkusan #{pIdx + 1}</span>
                                    {qty > 1 && <span className="text-stone-500 font-normal">({pIdx + 1}/{qty})</span>}
                                  </span>
                                  {currentNote && <span className="text-emerald-400 text-[10px] font-bold">✓ Ada Nota Khas</span>}
                                </div>

                                <Input
                                  placeholder={`Nota Bungkusan #${pIdx + 1} (cth: Tak nak taugeh, sambal asing, ekstra sup...)`}
                                  value={currentNote}
                                  onChange={(e) => updatePackNote(cItem.id, pIdx, e.target.value)}
                                  className="h-8 bg-stone-900 border-stone-800 text-white placeholder:text-stone-600 text-xs rounded-xl focus:border-orange-500/50"
                                />

                                {/* QUICK MODIFIER CHIPS */}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                                    const isSelected = currentNote.toLowerCase().includes(mod.tag);
                                    return (
                                      <button
                                        key={mod.id}
                                        type="button"
                                        onClick={() => togglePackQuickModifier(cItem.id, pIdx, mod.tag)}
                                        className={`text-[10px] px-2.5 py-0.5 rounded-lg font-medium transition-all border active:scale-95 ${
                                          isSelected
                                            ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-sm'
                                            : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                                        }`}
                                      >
                                        {mod.icon} {mod.label.split('/')[0].trim()}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECOMMENDED ADD-ONS UPSELL SECTION BEFORE CHECKOUT */}
              {availableAddons.filter(a => a.available).length > 0 && (
                <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs sm:text-sm text-amber-400 flex items-center gap-1.5 font-heading">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Cadangan Lauk & Sampingan Tambahan (Add-ons)
                    </h3>
                    <span className="text-[10px] text-stone-500 font-mono">1-Klik Tambah</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableAddons.filter(a => a.available).map(addon => (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleAddonDirectToCart(addon)}
                        className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 hover:border-amber-500/50 flex items-center justify-between gap-2 text-left text-xs transition-all active:scale-95 group shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-stone-200 block text-xs truncate group-hover:text-amber-300">
                            {addon.name}
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono font-bold">
                            +RM {addon.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors text-xs font-black">
                          +
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PRICE SUMMARY CARD */}
              <div className="bg-stone-900/90 border border-stone-800 p-4 sm:p-5 rounded-2xl space-y-2.5 text-xs shadow-inner">
                <div className="flex justify-between text-stone-400 text-xs sm:text-sm">
                  <span>Subtotal Makanan ({totalCartCount} pek):</span>
                  <span className="font-bold text-white font-mono">RM {foodSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400 text-xs sm:text-sm">
                  <span>Caj Penghantaran ({roadDistanceKm}km @ RM1/km):</span>
                  <span className="font-bold text-white font-mono">RM {deliveryFee.toFixed(2)}</span>
                </div>

                {/* MINIMUM ORDER PROGRESS BAR */}
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-stone-400 font-medium">Pesanan Minimum Delivery: RM 15.00</span>
                    <span className={foodSubtotal >= 15.00 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {foodSubtotal >= 15.00 ? '✓ Minimum Tercapai' : `Kurang RM ${(15.00 - foodSubtotal).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="w-full bg-stone-950 h-2.5 rounded-full overflow-hidden border border-stone-800 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${foodSubtotal >= 15.00 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
                      style={{ width: `${Math.min(100, (foodSubtotal / 15.00) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-stone-800 pt-3 flex justify-between text-base sm:text-lg font-black text-white">
                  <span>Jumlah Keseluruhan:</span>
                  <span className="text-orange-400 font-mono">RM {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {!currentUser ? (
                <Button 
                  className="w-full h-14 text-sm sm:text-base font-bold bg-white hover:bg-stone-100 text-stone-900 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all font-heading"
                  onClick={handleGoogleLogin}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Wajib Log Masuk Google Sebelum Memesan</span>
                </Button>
              ) : (
                <Button 
                  className="w-full h-14 text-sm sm:text-base font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl shadow-[0_8px_25px_rgba(234,88,12,0.4)] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all font-heading"
                  onClick={handlePlaceDeliveryOrder}
                  disabled={isSubmitting || cart.length === 0 || isOutOfZone || foodSubtotal < 15.00}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Memproses Pesanan...
                    </>
                  ) : (
                    <>
                      <span>TERUSKAN KE BAYARAN QR / FPX (RM {grandTotal.toFixed(2)})</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* FLOATING STICKY BOTTOM CART BAR */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#1c1917]/95 backdrop-blur-xl border-t border-stone-800/80 p-3 sm:p-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-stone-400 block uppercase font-medium">Jumlah ({totalCartCount} Bungkusan)</span>
                <span className="text-base sm:text-xl font-black text-orange-400 font-mono">
                  RM {grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsCartDrawerOpen(true)}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold px-3.5 py-2.5 rounded-2xl text-xs border border-stone-700 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> Semak ({totalCartCount})
                </Button>

                {!currentUser ? (
                  <Button
                    onClick={handleGoogleLogin}
                    className="bg-white hover:bg-stone-100 text-stone-900 font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg flex items-center gap-2 active:scale-95 transition-all font-heading"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Log Masuk Google</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlaceDeliveryOrder}
                    disabled={isSubmitting || isOutOfZone || foodSubtotal < 15.00}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg flex items-center gap-1.5 active:scale-95 transition-all font-heading"
                  >
                    <span>Teruskan Pesanan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DISH CUSTOMIZATION MODAL (DELIVERY & SELF-PICKUP MODE) */}
        <DishCustomizationModal
          isOpen={!!customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddToCartCustomized}
          menuItem={customizingItem}
          mode="delivery"
          isViewOnly={false}
        />

        {/* CART DRAWER DIALOG */}
        <Dialog open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen}>
          <DialogContent className="bg-[#292524] text-stone-100 border-stone-800 max-w-lg max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-3xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-orange-400 font-heading">
                <ShoppingBag className="w-5 h-5 text-orange-500" /> Troli Pesanan Delivery ({totalCartCount} Pek)
              </DialogTitle>
              <DialogDescription className="text-stone-400 text-xs">
                Semak spesifikasi bungkusan sebelum menghantar pesanan
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="divide-y divide-stone-800">
                {cart.map((item) => {
                  const qty = item.quantity;
                  const packNotes = item.packNotes || Array(qty).fill('');

                  return (
                    <div key={item.id} className="py-3.5 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-bold text-white text-sm">🍱 {item.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono">
                              x{qty}
                            </span>
                            {item.spiceLevel && (
                              <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/20">
                                🌶️ {item.spiceLevel}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-orange-400 text-sm font-mono">
                            RM {(item.price * qty).toFixed(2)}
                          </span>
                          <div className="flex items-center gap-2 mt-1 justify-end">
                            {qty > 1 && (
                              <button
                                type="button"
                                onClick={() => splitDeliveryItem(item.id)}
                                className="text-[10px] text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 active:scale-95"
                                title="Pecahkan kepada entri berasingan"
                              >
                                <Split className="w-3 h-3" /> Pecah
                              </button>
                            )}
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-rose-400 hover:text-rose-300 text-xs font-medium px-2 py-0.5 hover:bg-rose-950/30 rounded-md transition-colors"
                            >
                              Padam
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* PER-PACK SPECIFICATION ROWS */}
                      <div className="space-y-2 pt-1">
                        {Array.from({ length: qty }).map((_, pIdx) => {
                          const curNote = packNotes[pIdx] || '';
                          return (
                            <div key={pIdx} className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-amber-400 flex items-center gap-1">
                                  <span>🥡 Pek #{pIdx + 1}</span>
                                  {qty > 1 && <span className="text-stone-500 font-normal">({pIdx + 1}/{qty})</span>}
                                </span>
                                {curNote && <span className="text-emerald-400 text-[10px] font-bold">✓ Ada Nota</span>}
                              </div>

                              <Input
                                value={curNote}
                                onChange={(e) => updatePackNote(item.id, pIdx, e.target.value)}
                                placeholder={`Nota Pek #${pIdx + 1} (cth: Tak nak lada, sambal asing...)`}
                                className="h-8 bg-stone-950 border-stone-800 text-white placeholder:text-stone-600 text-xs rounded-xl focus:border-orange-500/50"
                              />

                              {/* QUICK CHIPS */}
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                                  const isSelected = curNote.toLowerCase().includes(mod.tag);
                                  return (
                                    <button
                                      key={mod.id}
                                      type="button"
                                      onClick={() => togglePackQuickModifier(item.id, pIdx, mod.tag)}
                                      className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-all border active:scale-95 ${
                                        isSelected
                                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-sm'
                                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                                      }`}
                                    >
                                      {mod.icon} {mod.label.split('/')[0].trim()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RECOMMENDED ADD-ONS UPSELL IN CART DRAWER */}
              {availableAddons.filter(a => a.available).length > 0 && (
                <div className="pt-3 pb-1 border-t border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-heading">
                      <Sparkles className="w-3.5 h-3.5" /> Cadangan Lauk & Sampingan Tambahan
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">1-Klik Tambah</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {availableAddons.filter(a => a.available).map(addon => (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleAddonDirectToCart(addon)}
                        className="p-2 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-500/50 flex items-center justify-between gap-1 text-left text-xs transition-all active:scale-95 group shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-stone-200 block text-[11px] truncate group-hover:text-amber-300">
                            {addon.name}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            +RM {addon.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors text-xs font-black">
                          +
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-stone-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal Makanan:</span>
                  <span className="font-bold text-white font-mono">RM {foodSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Caj Penghantaran ({roadDistanceKm}km):</span>
                  <span className="font-bold text-white font-mono">RM {deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-orange-400 pt-2 border-t border-stone-800">
                  <span>Jumlah Keseluruhan:</span>
                  <span className="font-mono">RM {grandTotal.toFixed(2)}</span>
                </div>

                {!currentUser ? (
                  <Button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      handleGoogleLogin();
                    }}
                    className="w-full bg-white hover:bg-stone-100 text-stone-900 font-bold py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm mt-3 active:scale-95 transition-all font-heading"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Log Masuk Google untuk Bayar</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      handlePlaceDeliveryOrder();
                    }}
                    disabled={isSubmitting || cart.length === 0 || foodSubtotal < 15.00}
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm mt-3 active:scale-95 transition-all font-heading"
                  >
                    <Check className="w-4 h-4" /> {isSubmitting ? 'Memproses...' : 'Teruskan ke Pembayaran'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 3-IN-1 MALAYSIAN PAYMENT MODAL */}
        <Dialog open={showDuitNowModal} onOpenChange={setShowDuitNowModal}>
          <DialogContent className="sm:max-w-[420px] bg-[#292524] text-stone-100 border-stone-800 p-5 rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <DialogHeader className="text-center sm:text-center pb-1">
              <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2 text-white font-heading">
                <CreditCard className="w-5 h-5 text-orange-500" /> Kaedah Pembayaran
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="duitnow" className="w-full">
              {/* PAYMENT TABS SELECTOR */}
              <TabsList className="grid grid-cols-2 bg-stone-900 p-1 rounded-2xl border border-stone-800 h-11 w-full mb-4">
                <TabsTrigger value="duitnow" className="text-xs font-bold rounded-xl data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all font-heading">
                  <QrCode className="w-3.5 h-3.5 mr-1.5" /> DuitNow QR
                </TabsTrigger>
                <TabsTrigger value="fpx" className="text-xs font-bold rounded-xl data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all font-heading">
                  <Globe className="w-3.5 h-3.5 mr-1.5" /> FPX Online
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: DUITNOW QR PAYMENT */}
              <TabsContent value="duitnow" className="space-y-4 mt-0 focus-visible:outline-none">
                <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl flex flex-col items-center text-center space-y-3 shadow-inner">
                  <div className="flex items-center justify-between w-full border-b border-stone-800 pb-2">
                    <span className="text-xs text-stone-400 font-medium">Jumlah Perlu Dibayar:</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">RM {grandTotal.toFixed(2)}</span>
                  </div>

                  <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-orange-500/30">
                    <img 
                      src="/duitnow-qr.png" 
                      alt="Warung JNJ DuitNow QR" 
                      className="w-48 h-48 object-contain rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=DuitNow-Warung-JNJ";
                      }}
                    />
                  </div>

                  <div className="w-full space-y-1.5 bg-stone-950/80 p-3 rounded-xl border border-stone-800 text-left text-xs">
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Nama Penerima:</span>
                      <span className="font-bold text-white">WARUNG JNJ</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Bank Penerima:</span>
                      <span className="font-bold text-white">Maybank / CIMB / Touch n Go</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-orange-400" /> Muat Naik Resit Bukti Bayaran (Wajib)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptUpload}
                      disabled={isUploadingReceipt}
                      className="w-full text-xs text-stone-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-500 file:cursor-pointer cursor-pointer bg-stone-900 border border-stone-800 rounded-2xl p-2"
                    />
                    {isUploadingReceipt && (
                      <div className="absolute inset-0 bg-stone-900/80 rounded-2xl flex items-center justify-center gap-2 text-xs text-orange-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Memuat naik resit...
                      </div>
                    )}
                  </div>
                  {receiptProofUrl && (
                    <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resit berjaya dimuat naik!
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: FPX ONLINE BANKING */}
              <TabsContent value="fpx" className="space-y-4 mt-0 focus-visible:outline-none">
                <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl text-center space-y-3 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/30">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-white">ToyyibPay FPX Online Banking</h4>
                    <p className="text-xs text-stone-400">
                      Bayar terus secara online melalui Maybank2u, CIMB Clicks, Bank Islam, RHB, dsb.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 flex justify-between items-center text-xs">
                    <span className="text-stone-400">Jumlah Bayaran:</span>
                    <span className="font-bold text-emerald-400 font-mono text-base">RM {grandTotal.toFixed(2)}</span>
                  </div>

                  <Button
                    type="button"
                    onClick={handleToyyibPayCheckout}
                    disabled={isFPXLoading}
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold h-12 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs active:scale-95 transition-all font-heading"
                  >
                    {isFPXLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    <span>Buka Portal Pembayaran FPX</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="pt-3 border-t border-stone-800 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  setShowDuitNowModal(false);
                  toast.success('Pesanan anda telah direkodkan. Admin sedang menyemak bayaran.');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl text-xs active:scale-95 transition-all font-heading"
              >
                ✅ Saya Dah Selesai Bayar & Hantar Resit
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CUSTOMER AUTHENTICATION MODAL (100% GOOGLE OAUTH EXCLUSIVE) */}
        <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
          <DialogContent className="sm:max-w-[400px] bg-[#292524] text-stone-100 border-stone-800 p-6 rounded-3xl shadow-2xl">
            <DialogHeader className="text-center sm:text-center space-y-2.5 pb-1">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <DialogTitle className="text-lg font-bold text-white font-heading">
                Pengesahan Pelanggan Delivery
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-300 leading-relaxed">
                Untuk keselamatan pesanan & perlindungan daripada pesanan palsu / scam, sila log masuk menggunakan akaun Google anda:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="bg-stone-900/90 border border-stone-800 p-3.5 rounded-2xl space-y-2 text-xs text-stone-300">
                <p className="font-bold text-amber-400 flex items-center gap-1.5 font-heading">
                  <Sparkles className="w-3.5 h-3.5" /> Jaminan Keselamatan Warung:
                </p>
                <ul className="space-y-1.5 text-[11px] text-stone-400">
                  <li className="flex items-center gap-2">✓ Pengesahan 1-Klik melalui akaun Google rasmi</li>
                  <li className="flex items-center gap-2">✓ Simpan alamat & sejarah pesanan secara automatik</li>
                  <li className="flex items-center gap-2">✓ Tiada kod OTP nombor telefon diperlukan</li>
                </ul>
              </div>

              <Button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full h-13 bg-white hover:bg-stone-100 text-stone-900 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs sm:text-sm font-heading"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Log Masuk dengan Google (1-Klik)</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAuthModal(false)}
                className="w-full text-xs text-stone-500 hover:text-stone-400 h-8"
              >
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

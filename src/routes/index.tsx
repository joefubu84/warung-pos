import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDishBadgesMap } from "@/lib/addons-config";
import { motion } from "framer-motion";
import { 
  UtensilsCrossed, 
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Flame,
  Star,
  ChefHat,
  Leaf,
  Bike,
  QrCode,
  ShoppingBag,
  Sparkles,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 }
  }
};

const item: any = {
  hidden: { y: 20, opacity: 0 },
  show: { 
    y: 0, 
    opacity: 1, 
    transition: { duration: 0.4, ease: "easeOut" } 
  }
};

function LandingPage() {
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [badgesMap, setBadgesMap] = useState<Record<string, any>>({});
  const [homepageSettings, setHomepageSettings] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [allMenuImages, setAllMenuImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchFeatured = async () => {
      // Fetch Homepage Settings and Store Info
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (storeData) {
        setStoreInfo(storeData);
        const hp = (storeData as any)?.settings?.homepage || null;
        setHomepageSettings(hp);
      }

      // Fetch Featured Items
      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_available", true)
        .not("image_url", "is", null)
        .neq("image_url", "")
        .order("name")
        .limit(6);
      
      if (data) {
        setFeaturedItems(data);
        setBadgesMap(getDishBadgesMap());
      }

      // Fetch all image_urls for the dropdown selections
      const { data: allMenuData } = await supabase
        .from("menu_items")
        .select("id, image_url")
        .not("image_url", "is", null);
      
      if (allMenuData) {
        const imageMap: Record<string, string> = {};
        allMenuData.forEach(item => {
          imageMap[item.id] = item.image_url;
        });
        setAllMenuImages(imageMap);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden font-sans">
      
      {/* Navigation (Floating Island) */}
      <div className="fixed top-5 w-full z-50 px-4 pointer-events-none flex justify-center">
        <motion.nav 
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-auto flex items-center justify-between gap-4 md:gap-8 px-3 py-2 rounded-full bg-[#292524]/90 backdrop-blur-xl border border-stone-700/60 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
        >
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 pl-2 pr-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border border-amber-500/40 shadow-inner shrink-0">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-full h-full object-cover" />
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-[15px] font-bold text-white block leading-none font-heading">Warung J&J</span>
              <span className="text-[10px] text-amber-400 font-bold">Penampang, Sabah</span>
            </div>
          </Link>
          
          {/* Links Box */}
          <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-full border border-stone-700/50">
            <a href="#menu" className="px-4 py-1.5 rounded-full text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all">Menu</a>
            <a href="#keistimewaan" className="px-4 py-1.5 rounded-full text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all">Keistimewaan</a>
            <a href="#location" className="px-4 py-1.5 rounded-full text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all">Lokasi & Waktu</a>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 pr-1">
            <a href="#menu">
              <Button className="rounded-full px-5 h-9 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs tracking-tight transition-all shadow-[0_0_15px_rgba(234,88,12,0.4)] flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Lihat Menu</span>
              </Button>
            </a>
          </div>
        </motion.nav>
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-44 md:pb-28 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-950/30 via-[#1c1917] to-[#1c1917] -z-10" />
        
        <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-16">
          
          {/* Text Content */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="flex-1 space-y-6 text-center lg:text-left z-10"
          >
            {/* Service Badges */}
            <motion.div variants={item} className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <div className="inline-flex items-center gap-1.5 py-1 px-3.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-bold text-orange-400">
                <Flame className="w-3.5 h-3.5" />
                <span>Sambal Gesek & Rempah Asli Sabah</span>
              </div>
              <div className="inline-flex items-center gap-1.5 py-1 px-3.5 rounded-full bg-stone-800/80 border border-stone-700 text-xs font-bold text-stone-300">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Dine-In & Takeaway Penampang</span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 variants={item} className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] text-stone-100 font-heading">
              {homepageSettings?.hero_title ? (
                <>{homepageSettings.hero_title}</>
              ) : (
                <>
                  Rasa Asli, Sambal Padu — <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500">
                    Dapur Warung J&J
                  </span>
                </>
              )}
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={item} className="text-base md:text-lg text-stone-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Nikmati hidangan Ayam Penyet, Ayam Geprek rangup, Ikan Talapia berlada, Telur Dadar Krikil, dan aneka lauk sampingan panas-panas. Disediakan segar setiap hari dengan sambal gesek asli resipi tersendiri.
            </motion.p>

            {/* Call to Actions */}
            <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <a href="#menu" className="w-full sm:w-auto">
                <Button size="lg" className="h-13 px-7 rounded-full text-base font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-[0_8px_25px_rgba(234,88,12,0.35)] transition-all w-full flex items-center justify-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  <span>Pilihan Menu Warung</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
              <Link to="/delivery" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-13 px-7 rounded-full text-base font-bold border-stone-700 text-stone-400 hover:text-white hover:bg-stone-800 transition-all w-full bg-stone-900/60">
                  <Bike className="w-4 h-4 mr-2 text-stone-500" />
                  <span>Delivery (Ditutup Sementara)</span>
                </Button>
              </Link>
            </motion.div>

            {/* 3 Core Services Icons */}
            <motion.div variants={item} className="grid grid-cols-3 gap-2 pt-4 border-t border-stone-800/80 max-w-md mx-auto lg:mx-0 text-left">
              <div className="p-2.5 rounded-xl bg-stone-900/40 border border-stone-800">
                <div className="text-amber-400 font-bold text-xs flex items-center gap-1 mb-0.5">
                  <Bike className="w-3.5 h-3.5" /> Delivery
                </div>
                <div className="text-[11px] text-stone-400 leading-tight">Hantar ke pintu rumah</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900/40 border border-stone-800">
                <div className="text-emerald-400 font-bold text-xs flex items-center gap-1 mb-0.5">
                  <QrCode className="w-3.5 h-3.5" /> QR Meja
                </div>
                <div className="text-[11px] text-stone-400 leading-tight">Dine-in imbas pantas</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900/40 border border-stone-800">
                <div className="text-sky-400 font-bold text-xs flex items-center gap-1 mb-0.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Takeaway
                </div>
                <div className="text-[11px] text-stone-400 leading-tight">Bungkus & bawa pulang</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex-1 w-full max-w-xl lg:max-w-none"
          >
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-stone-700/50 bg-stone-900">
              <img 
                src={homepageSettings?.hero_item_id && allMenuImages[homepageSettings.hero_item_id] ? allMenuImages[homepageSettings.hero_item_id] : (featuredItems.length > 0 && featuredItems[0]?.image_url ? featuredItems[0].image_url : "/logo.png")} 
                alt="Hidangan Warung J&J Penampang"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              
              {/* Floating Badge */}
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-black/80 backdrop-blur-md p-3.5 rounded-2xl border border-stone-700/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white font-heading">Warung J&J Penampang</p>
                  <p className="text-xs text-amber-400 font-bold">⭐ Pilihan No. 1 Penduduk Setempat</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Keistimewaan Warung J&J */}
      <section id="keistimewaan" className="py-20 px-6 bg-[#161412] border-y border-stone-800/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Keistimewaan Dapur Kami</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-100 font-heading">Kenapa Warung J&J Menjadi Pilihan</h2>
            <p className="text-sm md:text-base text-stone-400 font-medium">Kualiti rasa asli dan kesegaran ramuan tempatan yang dihidangkan panas setiap hari.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[280px]">
            {/* Card 1: Suasana Santai */}
            <div className="md:col-span-2 relative rounded-3xl overflow-hidden group bg-stone-900 border border-stone-800">
              <img 
                src={homepageSettings?.bento_1_item_id && allMenuImages[homepageSettings.bento_1_item_id] ? allMenuImages[homepageSettings.bento_1_item_id] : (featuredItems.length > 1 && featuredItems[1]?.image_url ? featuredItems[1].image_url : (featuredItems[0]?.image_url || "/logo.png"))} 
                alt="Suasana Warung J&J"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-1.5 font-heading">
                  {homepageSettings?.bento_1_title || 'Ruang Santai & Mesra Keluarga'}
                </h3>
                <p className="text-xs md:text-sm text-stone-300 font-medium">Sesuai untuk makan tengah hari bersama rakan sekerja mahupun makan malam santai bersama seisi keluarga di Penampang.</p>
              </div>
            </div>

            {/* Card 2: Sambal Gesek Asli */}
            <div className="relative rounded-3xl overflow-hidden bg-[#24201e] p-6 flex flex-col justify-between border border-stone-700/40 hover:border-amber-500/40 transition-colors">
              <div className="w-11 h-11 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1 font-heading">Sambal Gesek & Belacan Padu</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-medium">Dilecek segar setiap pagi menggunakan cili padi kampung berkualiti tinggi dan perahan limau segar.</p>
              </div>
            </div>

            {/* Card 3: Ayam & Ikan Segar */}
            <div className="relative rounded-3xl overflow-hidden bg-[#24201e] p-6 flex flex-col justify-between border border-stone-700/40 hover:border-emerald-500/40 transition-colors">
              <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1 font-heading">Bahan Mentah Segar Harian</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-medium">Ayam dan ikan segar dari pasar tempatan diperap dengan adunan kunyit dan rempah istimewa sebelum digoreng rangup.</p>
              </div>
            </div>

            {/* Card 4: Aneka Add-ons & Sampingan */}
            <div className="md:col-span-2 relative rounded-3xl overflow-hidden group bg-stone-900 border border-stone-800">
              <img 
                src={homepageSettings?.bento_2_item_id && allMenuImages[homepageSettings.bento_2_item_id] ? allMenuImages[homepageSettings.bento_2_item_id] : (featuredItems.length > 2 && featuredItems[2]?.image_url ? featuredItems[2].image_url : (featuredItems[0]?.image_url || "/logo.png"))} 
                alt="Pilihan Lauk Sampingan"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-1.5 font-heading">
                  {homepageSettings?.bento_2_title || 'Pilihan Tambahan & Lauk Sampingan Pelbagai'}
                </h3>
                <p className="text-xs md:text-sm text-stone-300 font-medium">Boleh beli terus secara berasingan: Telur Dadar Krikil, Popcorn Ayam, Telur Mata, Nasi Tambah, dan aneka sambal tambahan mengikut citarasa anda.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Teaser */}
      <section id="menu" className="py-24 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400 font-mono">Pilihan Utama Warung</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-100 font-heading">Hidangan Paling Digemari</h2>
              <p className="text-sm md:text-base text-stone-400 font-medium">Pilihan ramai pelanggan tetap Warung J&J Penampang.</p>
            </div>
            <Link to="/delivery">
              <Button variant="outline" className="rounded-full px-5 h-10 text-xs font-bold border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 bg-transparent hidden md:flex items-center gap-1.5">
                <span>Buka Menu Penuh</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredItems.map((item) => {
              const badge = badgesMap[item.id] || {};
              const tag = badge.customTag || (badge.isPopular ? "Paling Laris" : (badge.isHalal ? "Halal" : item.category));
              
              return (
                <div
                  key={item.id}
                  className="group bg-[#24201e] rounded-3xl overflow-hidden border border-stone-800 hover:border-orange-500/50 transition-all flex flex-col shadow-lg"
                >
                  <div className="aspect-[4/3] w-full bg-stone-900 overflow-hidden relative">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-stone-700" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">{tag}</span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-lg text-white font-heading leading-snug">{item.name}</h4>
                      {item.description && (
                        <p className="text-stone-400 text-xs mt-1 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                      <div className="font-black text-lg text-amber-400 font-heading">
                        RM {item.price.toFixed(2)}
                      </div>
                      <Link to="/delivery">
                        <Button size="sm" className="rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold h-8 px-3 flex items-center gap-1 shadow">
                          <span>Pesan</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center md:hidden pt-4">
            <Link to="/delivery" className="w-full">
              <Button size="lg" variant="outline" className="rounded-full px-6 h-12 font-bold border-stone-700 text-stone-300 w-full bg-stone-900/60">
                Lihat Seluruh Menu & Pesan Delivery 🛵
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location & Hours */}
      <section id="location" className="py-20 px-6 bg-[#161412] border-t border-stone-800/60">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Kunjungi Restoran Kami</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-100 font-heading mt-1">Lokasi & Waktu Operasi</h2>
              <p className="text-sm text-stone-400 font-medium mt-2 leading-relaxed">
                Nikmati hidangan panas dan lazat setiap hari di premis Warung J&J Penampang, Sabah.
              </p>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 shrink-0">
                  <MapPin className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white font-heading">Alamat Premis</h4>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5 whitespace-pre-wrap">{storeInfo?.address || 'Warung JNJ\na17, Jln Datuk Panglima Banting,\n89500 Penampang, Sabah, Malaysia'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 shrink-0">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white font-heading">Waktu Operasi</h4>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">Dibuka Setiap Hari: 10:00 AM - 10:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 shrink-0">
                  <Phone className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white font-heading">Hubungi / WhatsApp</h4>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">{storeInfo?.phone_number || '017-222 1784'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <a 
            href="https://www.google.com/maps/dir//Warung+JNJ,+a17,+Jln+Datuk+Panglima+Banting,+89500+Penampang,+Sabah/@5.9810544,116.0768506,9z/data=!4m8!4m7!1m0!1m5!1m1!1s0x323b692e917f9eb1:0x66ccb58dff90bc87!2m2!1d116.1146463!2d5.9284153?entry=ttu" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-stone-800 shadow-2xl block group bg-stone-900"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-transform group-hover:scale-105 duration-300">
              <div className="w-16 h-16 bg-orange-500/20 border border-orange-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                <MapPin className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-bold text-xl text-white mb-1 font-heading">Buka Navigasi Google Maps</h3>
              <p className="text-xs font-medium text-stone-400">Warung JNJ, Penampang • Klik untuk panduan arah jalan</p>
            </div>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-stone-800/60 bg-[#0c0a09]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border border-stone-700 shadow-inner">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-base font-bold text-stone-200 block leading-none font-heading">Warung J&J</span>
              <span className="text-[11px] text-stone-400">Penampang, Sabah • Citarasa Asli Malaysia</span>
            </div>
          </div>

          <p className="text-xs font-medium text-stone-400">
            © {new Date().getFullYear()} Warung J&J (Penampang, Sabah). Hak Cipta Terpelihara.
          </p>
        </div>
      </footer>
    </div>
  );
}


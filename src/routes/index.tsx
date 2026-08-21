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
    transition: { staggerChildren: 0.15 }
  }
};

const item: any = {
  hidden: { y: 30, opacity: 0 },
  show: { 
    y: 0, 
    opacity: 1, 
    transition: { type: "spring", damping: 1.2, bounce: 0, duration: 0.6 } 
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
      
      {/* Navigation (Floating Island - Warmer Theme) */}
      <div className="fixed top-6 w-full z-50 px-4 pointer-events-none flex justify-center">
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 1.2, bounce: 0, duration: 0.6, delay: 0.2 }}
          className="pointer-events-auto flex items-center justify-between gap-6 md:gap-10 px-2 py-2 rounded-full bg-[#292524]/80 backdrop-blur-[40px] saturate-[200%] border border-stone-700/50 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Brand */}
          <div className="flex items-center gap-3 pl-2 pr-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-stone-600/50 shadow-inner">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-full h-full object-cover scale-[1.05]" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-white hidden sm:block">Warung J&J</span>
          </div>
          
          {/* Links Box */}
          <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-full border border-stone-700/50 shadow-inner">
            <a href="#menu" className="px-5 py-1.5 rounded-full text-[14px] font-semibold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all active:scale-95">Menu</a>
            <a href="#about" className="px-5 py-1.5 rounded-full text-[14px] font-semibold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all active:scale-95">About</a>
            <a href="#location" className="px-5 py-1.5 rounded-full text-[14px] font-semibold text-stone-300 hover:text-white hover:bg-stone-700/50 transition-all active:scale-95">Visit Us</a>
          </div>

          {/* CTA */}
          <div className="pr-1">
            <Link to="/delivery">
              <Button className="rounded-full px-7 h-10 bg-orange-600 hover:bg-orange-500 text-white font-bold tracking-tight transition-all active:scale-[0.96] border-none shadow-[0_0_20px_rgba(234,88,12,0.3)]">
                Order Now
              </Button>
            </Link>
          </div>
        </motion.nav>
      </div>

      {/* Hero Section (Split Layout) */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/20 via-[#1c1917] to-[#1c1917] -z-10" />
        
        <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Text Content */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="flex-1 space-y-8 text-center lg:text-left z-10"
          >
            <motion.div variants={item}>
              <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-orange-500/10 border border-orange-500/20 text-sm font-semibold tracking-tight text-orange-400">
                <Flame className="w-4 h-4" />
                Authentic Malaysian Flavors
              </div>
            </motion.div>

            <motion.h1 variants={item} className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-stone-100">
              {homepageSettings?.hero_title ? (
                <>{homepageSettings.hero_title}</>
              ) : (
                <>Taste the <span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-500">Soul</span> of Malaysia</>
              )}
            </motion.h1>

            <motion.p variants={item} className="text-lg md:text-xl text-stone-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Rich, bold, and unforgettable. We serve generations of family recipes crafted with the finest local spices, bringing the true taste of home to your table.
            </motion.p>

            <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <Link to="/delivery" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 rounded-full text-[17px] font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-[0_8px_30px_rgba(234,88,12,0.3)] transition-all active:scale-[0.97] w-full border-none">
                  Order Delivery & Takeaway
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="#menu" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-[17px] font-semibold border-stone-600 text-stone-300 hover:text-white hover:bg-stone-800 transition-all active:scale-[0.97] w-full bg-transparent">
                  View Menu
                </Button>
              </a>
            </motion.div>
          </motion.div>

          {/* Hero Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 w-full max-w-2xl lg:max-w-none"
          >
            <div className="relative aspect-square lg:aspect-[4/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 bg-stone-800">
              <img 
                src={homepageSettings?.hero_item_id && allMenuImages[homepageSettings.hero_item_id] ? allMenuImages[homepageSettings.hero_item_id] : (featuredItems.length > 0 && featuredItems[0]?.image_url ? featuredItems[0].image_url : "https://images.unsplash.com/photo-1626804475297-41609ea004eb?q=80&w=1200&auto=format&fit=crop")} 
                alt="Delicious Malaysian Cuisine"
                className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              
              {/* Floating Badge on Image */}
              <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#1c1917] bg-stone-800 flex items-center justify-center">
                      <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                    </div>
                  ))}
                </div>
                <div className="text-white">
                  <p className="font-bold text-sm tracking-tight">Top Rated</p>
                  <p className="text-xs text-stone-400">Loved by locals</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Why Choose Us (Bento Grid) */}
      <section id="about" className="py-24 px-6 bg-[#161412] border-y border-stone-800/50">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-stone-100">Crafted with Passion</h2>
            <p className="text-lg text-stone-400 font-medium">We don't compromise on quality. Every dish is a labor of love, prepared fresh daily.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            {/* Large Bento Card */}
            <div className="md:col-span-2 relative rounded-[2.5rem] overflow-hidden group">
              <img 
                src={homepageSettings?.bento_1_item_id && allMenuImages[homepageSettings.bento_1_item_id] ? allMenuImages[homepageSettings.bento_1_item_id] : (featuredItems.length > 1 && featuredItems[1]?.image_url ? featuredItems[1].image_url : "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop")} 
                alt="Restaurant Vibe"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8 md:p-10">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{homepageSettings?.bento_1_title || 'The Perfect Atmosphere'}</h3>
                <p className="text-stone-300 font-medium">Whether you're dining in with family or grabbing a quick bite, our space is designed for comfort.</p>
              </div>
            </div>

            {/* Small Bento Card 1 */}
            <div className="relative rounded-[2.5rem] overflow-hidden group bg-[#292524] p-8 flex flex-col justify-end border border-stone-700/30 hover:border-orange-500/30 transition-colors">
              <div className="absolute top-8 right-8 w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Master Recipes</h3>
              <p className="text-stone-400 font-medium">Generations of family secrets packed into every single bite.</p>
            </div>

            {/* Small Bento Card 2 */}
            <div className="relative rounded-[2.5rem] overflow-hidden group bg-[#292524] p-8 flex flex-col justify-end border border-stone-700/30 hover:border-orange-500/30 transition-colors">
              <div className="absolute top-8 right-8 w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <Leaf className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Fresh Ingredients</h3>
              <p className="text-stone-400 font-medium">Sourced daily from local markets to ensure maximum flavor.</p>
            </div>

            {/* Medium Bento Card */}
            <div className="md:col-span-2 relative rounded-[2.5rem] overflow-hidden group">
              <img 
                src={homepageSettings?.bento_2_item_id && allMenuImages[homepageSettings.bento_2_item_id] ? allMenuImages[homepageSettings.bento_2_item_id] : (featuredItems.length > 2 && featuredItems[2]?.image_url ? featuredItems[2].image_url : "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop")} 
                alt="Spices"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8 md:p-10">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{homepageSettings?.bento_2_title || 'Uncompromised Spices'}</h3>
                <p className="text-stone-300 font-medium">We grind our own rempah (spice pastes) daily for that authentic, bold flavor.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Teaser (Large Food Cards) */}
      <section id="menu" className="py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-stone-100">Our Signatures</h2>
              <p className="text-xl text-stone-400 font-medium tracking-tight">Taste the dishes that put us on the map.</p>
            </div>
            <Link to="/delivery">
              <Button variant="outline" className="rounded-full px-6 h-12 font-semibold border-stone-600 text-stone-300 hover:text-white hover:bg-stone-800 bg-transparent hidden md:flex active:scale-95 transition-transform">
                View Full Menu
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredItems.map((item, i) => {
              const badge = badgesMap[item.id] || {};
              const tag = badge.customTag || (badge.isPopular ? "Best Seller" : (badge.isHalal ? "Halal" : item.category));
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ type: "spring", damping: 1.2, duration: 0.6, delay: i * 0.1 }}
                  className="group bg-[#292524] rounded-[2rem] overflow-hidden border border-stone-700/50 hover:border-orange-500/50 transition-colors cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] w-full bg-stone-800 overflow-hidden relative">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-stone-600" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{tag}</span>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-xl text-stone-100 tracking-tight">{item.name}</h4>
                      {item.description && (
                        <p className="text-stone-400 text-sm mt-2 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="font-bold text-xl text-orange-400">
                        RM {item.price.toFixed(2)}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-stone-700/50 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors text-stone-400">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex justify-center md:hidden pt-8">
            <Link to="/delivery" className="w-full">
              <Button size="lg" variant="outline" className="rounded-full px-8 h-14 font-bold border-stone-600 text-stone-300 w-full bg-transparent">
                View Full Menu
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location & Hours */}
      <section id="location" className="py-24 px-6 bg-[#161412] border-t border-stone-800/50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-stone-100 mb-4">Come Visit Us</h2>
              <p className="text-lg text-stone-400 font-medium leading-relaxed">
                Nikmati hidangan panas dan lazat setiap hari di Warung J&J Penampang, Sabah.
              </p>
            </div>
            
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="p-4 bg-[#292524] rounded-2xl border border-stone-700/50">
                  <MapPin className="w-6 h-6 text-orange-500" />
                </div>
                <div className="pt-1">
                  <h4 className="font-bold text-[17px] tracking-tight text-stone-200">Address</h4>
                  <p className="text-stone-400 leading-relaxed mt-1 whitespace-pre-wrap">{storeInfo?.address || 'Warung J&J\nJalan Penampang, 89500 Penampang,\nSabah, Malaysia'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-5">
                <div className="p-4 bg-[#292524] rounded-2xl border border-stone-700/50">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
                <div className="pt-1">
                  <h4 className="font-bold text-[17px] tracking-tight text-stone-200">Opening Hours</h4>
                  <p className="text-stone-400 leading-relaxed mt-1">Setiap Hari: 10:00 AM - 10:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="p-4 bg-[#292524] rounded-2xl border border-stone-700/50">
                  <Phone className="w-6 h-6 text-orange-500" />
                </div>
                <div className="pt-1">
                  <h4 className="font-bold text-[17px] tracking-tight text-stone-200">Contact</h4>
                  <p className="text-stone-400 leading-relaxed mt-1">{storeInfo?.phone_number || '017-222 1784'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <a 
            href="https://share.google/QnAwg0vYtPvytnOG5" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative aspect-square lg:aspect-[4/3] rounded-[3rem] overflow-hidden border border-stone-800 shadow-2xl block group"
          >
            <div className="absolute inset-0 bg-[#292524] transition-colors group-hover:bg-[#332f2e]" />
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay group-hover:opacity-30 transition-opacity" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center transition-transform group-hover:scale-105 duration-500">
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
                <MapPin className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="font-bold text-2xl text-white mb-2">Find Us on Maps</h3>
              <p className="font-medium text-stone-400">Click to open directions</p>
            </div>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-stone-800/50 bg-[#0c0a09]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-stone-700/80 shadow-inner">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-full h-full object-cover scale-[1.05]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-300">Warung J&J</span>
          </div>

          {/* QUICK PORTAL LINKS */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <Link to="/rider" className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-bold">
              🛵 Portal Rider (Daftar / Bertugas)
            </Link>
            <span className="text-stone-700">•</span>
            <Link to="/auth" className="text-stone-400 hover:text-stone-200 hover:underline">
              🔐 Staff Login
            </Link>
          </div>

          <p className="text-sm font-medium text-stone-500 tracking-tight">© {new Date().getFullYear()} Warung J&J. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}


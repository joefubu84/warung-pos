import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { 
  UtensilsCrossed, 
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  ChefHat,
  Star,
  Leaf,
  Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item: any = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } }
};

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <span className="text-xl font-black tracking-tighter">Warung J&J</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-muted-foreground">
            <a href="#menu" className="hover:text-primary transition-colors">Our Menu</a>
            <a href="#about" className="hover:text-primary transition-colors">About Us</a>
            <a href="#location" className="hover:text-primary transition-colors">Location & Hours</a>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick access for staff/admin */}
            <Link to="/auth">
              <Button variant="ghost" className="hidden lg:inline-flex rounded-full text-xs text-muted-foreground">Staff Login</Button>
            </Link>
            <Link to="/delivery">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold tracking-wide">
                Order Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-24 md:pt-60 md:pb-40 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-5xl mx-auto text-center space-y-10"
        >
          <motion.div variants={item}>
            <Badge variant="outline" className="py-2 px-5 rounded-full bg-primary/5 border-primary/20 text-primary font-bold text-xs tracking-wider uppercase">
              <span className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Authentic Malaysian Flavors
              </span>
            </Badge>
          </motion.div>

          <motion.h1 variants={item} className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] lg:text-9xl">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary to-orange-500">Warung J&J</span>
          </motion.h1>

          <motion.p variants={item} className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
            Serving the best local delicacies with a modern touch. Experience rich, bold, and unforgettable tastes right in your neighborhood.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
            <Link to="/delivery">
              <Button size="lg" className="h-16 px-10 rounded-2xl text-lg font-black shadow-[0_20px_50px_rgba(16,_185,_129,_0.3)] hover:shadow-[0_20px_50px_rgba(16,_185,_129,_0.5)] transition-all bg-emerald-600 hover:bg-emerald-500 text-white w-full sm:w-auto">
                🛵 ORDER DELIVERY
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </Link>
            <Link to="/t/$token" params={{ token: 'table-1' }}>
              <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl text-lg font-black border-2 border-slate-700 hover:bg-secondary transition-all w-full sm:w-auto">
                🍽️ DINE-IN MENU
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Why Choose Us */}
      <section id="about" className="py-24 px-6 border-y bg-muted/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            {
              icon: <ChefHat className="w-8 h-8" />,
              title: "Master Recipes",
              desc: "Crafted with generations of family secrets and the finest local spices.",
              color: "text-orange-500",
              bg: "bg-orange-500/10"
            },
            {
              icon: <Leaf className="w-8 h-8" />,
              title: "Fresh Ingredients",
              desc: "Sourced daily from local markets to ensure maximum flavor and quality.",
              color: "text-emerald-500",
              bg: "bg-emerald-500/10"
            },
            {
              icon: <Star className="w-8 h-8" />,
              title: "Top Rated",
              desc: "Loved by our community. Bringing smiles to thousands of happy customers.",
              color: "text-amber-500",
              bg: "bg-amber-500/10"
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-8 rounded-[2rem] border-border/50 bg-card hover:border-primary/30 transition-all text-center h-full flex flex-col items-center justify-center space-y-4 shadow-lg hover:shadow-xl">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${feature.bg} ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black">{feature.title}</h3>
                <p className="text-muted-foreground font-medium">{feature.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Popular Items / Menu Teaser */}
      <section id="menu" className="py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">Our Signatures</h2>
            <p className="text-xl text-muted-foreground font-medium">Taste the dishes that put us on the map.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Nasi Lemak Special", price: "RM 12.00", tag: "Best Seller" },
              { name: "Mee Goreng Mamak", price: "RM 8.50", tag: "Spicy" },
              { name: "Ayam Goreng Berempah", price: "RM 6.00", tag: "Crispy" },
              { name: "Teh Tarik Kaw", price: "RM 3.50", tag: "Classic" },
              { name: "Roti Canai Telur", price: "RM 4.00", tag: "Breakfast" },
              { name: "Maggi Goreng Double", price: "RM 9.00", tag: "Hearty" },
            ].map((item, idx) => (
              <Card key={idx} className="p-6 rounded-[2rem] flex justify-between items-center border-border/50 bg-card hover:bg-muted/50 transition-colors">
                <div>
                  <h4 className="font-bold text-lg">{item.name}</h4>
                  <Badge variant="secondary" className="mt-2 text-xs">{item.tag}</Badge>
                </div>
                <div className="font-black text-xl text-primary">{item.price}</div>
              </Card>
            ))}
          </div>

          <div className="flex justify-center pt-8">
            <Link to="/t/$token" params={{ token: 'table-1' }}>
              <Button size="lg" variant="outline" className="rounded-full px-8 h-14 font-bold border-2">
                View Full Menu
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location & Hours */}
      <section id="location" className="py-24 px-6 bg-primary text-primary-foreground rounded-t-[4rem] lg:rounded-t-[6rem]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Come Visit Us</h2>
            <p className="text-lg text-primary-foreground/80 font-medium">
              We're located in the heart of the city, ready to serve you piping hot meals every day.
            </p>
            
            <div className="space-y-6 pt-4">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 mt-1 text-white" />
                <div>
                  <h4 className="font-bold text-lg">Address</h4>
                  <p className="text-primary-foreground/80">123 Jalan Makan Sedap,<br/>50450 Kuala Lumpur, Malaysia</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 mt-1 text-white" />
                <div>
                  <h4 className="font-bold text-lg">Opening Hours</h4>
                  <p className="text-primary-foreground/80">Everyday: 8:00 AM - 10:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Phone className="w-6 h-6 mt-1 text-white" />
                <div>
                  <h4 className="font-bold text-lg">Contact</h4>
                  <p className="text-primary-foreground/80">+60 12-345 6789</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 p-2 rounded-[3rem] backdrop-blur-sm border border-white/20">
            <div className="aspect-square w-full bg-black/20 rounded-[2.5rem] flex items-center justify-center overflow-hidden">
               {/* Map placeholder or actual image of restaurant */}
               <div className="text-center space-y-4 p-8">
                 <MapPin className="w-16 h-16 mx-auto text-white opacity-50" />
                 <p className="font-bold text-lg opacity-80">Find us on Google Maps</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#0F172A] text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
            <span className="text-xl font-black tracking-tighter">Warung J&J</span>
          </div>
          <p className="text-sm font-medium text-white/50">© {new Date().getFullYear()} Warung J&J. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-bold text-white/50">
             <Link to="/auth" className="hover:text-white transition-colors">Staff Access</Link>
             <Link to="/dashboard" className="hover:text-white transition-colors">Admin Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

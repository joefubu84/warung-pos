import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { 
  ChefHat, 
  Store, 
  Users, 
  BarChart3, 
  QrCode, 
  ShieldCheck, 
  ArrowRight,
  ChevronRight,
  Smartphone,
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  CheckCircle2,
  Lock,
  Globe,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#solutions" className="hover:text-primary transition-colors">Solutions</a>
            <a href="#security" className="hover:text-primary transition-colors">Security</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex rounded-full">Login</Button>
            </Link>
            <Link to="/orders">
              <Button variant="ghost" className="hidden sm:inline-flex rounded-full">Orders</Button>
            </Link>
            <Link to="/tables">
              <Button variant="ghost" className="hidden sm:inline-flex rounded-full">Staff Portal</Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" className="hidden sm:inline-flex rounded-full">Settings</Button>
            </Link>
            <Button className="rounded-full px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-24 md:pt-60 md:pb-40 px-6 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
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
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                The Future of Malaysian Hospitality
              </span>
            </Badge>
          </motion.div>

          <motion.h1 variants={item} className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] lg:text-9xl">
            Scale Your <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary to-primary/50">Culinary Empire</span>
          </motion.h1>

          <motion.p variants={item} className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
            A professional multi-store POS ecosystem designed for speed, security, and seamless global growth.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
            <Button size="lg" className="h-16 px-10 rounded-2xl text-lg font-black shadow-[0_20px_50px_rgba(8,_112,_184,_0.3)] hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.5)] transition-all group bg-primary text-primary-foreground">
              Launch Your Store
              <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl text-lg font-black border-2 hover:bg-secondary transition-all">
              Watch Experience
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats / Proof Section */}
      <section className="py-20 px-6 border-y bg-muted/30">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
          {[
            { label: "Active Stores", value: "50+" },
            { label: "Daily Orders", value: "10k+" },
            { label: "Uptime", value: "99.9%" },
            { label: "Support", value: "24/7" },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center space-y-2"
            >
              <div className="text-4xl md:text-5xl font-black tracking-tighter text-primary">{stat.value}</div>
              <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter">Enterprise Power, <br/>Warung Simplicity.</h2>
            <p className="text-xl text-muted-foreground font-medium">Every tool you need to manage a single stall or a nationwide chain.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: <Layers className="w-10 h-10" />,
                title: "Multi-Store Control",
                desc: "Switch between branches in seconds. Unified reporting with isolated data security.",
                color: "bg-blue-500"
              },
              {
                icon: <QrCode className="w-10 h-10" />,
                title: "Instant QR Menus",
                desc: "Cut waiting times. Let customers scan, browse, and order directly from their seats.",
                color: "bg-emerald-500"
              },
              {
                icon: <Zap className="w-10 h-10" />,
                title: "Real-time Sync",
                desc: "Inventory and sales update instantly across all devices. Never oversell again.",
                color: "bg-amber-500"
              },
              {
                icon: <Users className="w-10 h-10" />,
                title: "Staff Management",
                desc: "Detailed role-based access control for waiters, chefs, and managers.",
                color: "bg-violet-500"
              },
              {
                icon: <Smartphone className="w-10 h-10" />,
                title: "Mobile First",
                desc: "A professional UI that works flawlessly on tablets, phones, and desktops.",
                color: "bg-rose-500"
              },
              {
                icon: <Globe className="w-10 h-10" />,
                title: "Cloud Native",
                desc: "Built on high-performance edge architecture for sub-second response times.",
                color: "bg-cyan-500"
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <Card className="group p-10 rounded-[3rem] border-border/50 bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden">
                  <div className={`w-20 h-20 ${f.color} rounded-[1.75rem] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                    {f.icon}
                  </div>
                  <h3 className="text-2xl font-black mb-4 tracking-tight">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Proof - Professional Version of the old Roadmap */}
      <section id="security" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-primary text-primary-foreground rounded-[4rem] p-10 md:p-24 flex flex-col lg:flex-row gap-20 items-center overflow-hidden relative">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
               <div className="absolute top-0 right-0 w-[500px] h-[500px] border-[50px] border-white rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="flex-1 space-y-10 relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-black uppercase tracking-widest">
                <Lock className="w-4 h-4" /> Security Architecture
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">
                Zero Trust <br/>Data Isolation.
              </h2>
              <p className="text-xl text-primary-foreground/80 font-medium leading-relaxed max-w-xl">
                Our proprietary RLS (Row Level Security) engine ensures that your branch data stays your branch data. Total isolation, verified by empirical testing.
              </p>
              
              <ul className="space-y-4">
                {[
                  "Cross-Store Data Leakage Prevention",
                  "Role-Based Access Control (RBAC)",
                  "End-to-End Encrypted Transactions",
                  "Automated Security Compliance Audits"
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 font-bold text-lg">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="pt-6">
                <Link to="/tables">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-[2rem] px-10 h-16 text-lg font-black shadow-2xl transition-all hover:scale-105 active:scale-95">
                    Experience the Platform
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full relative z-10">
              <div className="relative group">
                <div className="absolute -inset-4 bg-white/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Card className="relative bg-[#0F172A] p-8 rounded-[3rem] shadow-2xl border-white/10 overflow-hidden transform group-hover:rotate-2 transition-transform duration-700">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex gap-3">
                      <div className="w-4 h-4 rounded-full bg-rose-500" />
                      <div className="w-4 h-4 rounded-full bg-amber-500" />
                      <div className="w-4 h-4 rounded-full bg-emerald-500" />
                    </div>
                    <Badge variant="outline" className="text-[10px] text-white/40 border-white/10 uppercase tracking-[0.2em]">Security Audit v4.0</Badge>
                  </div>
                  
                  <div className="space-y-6 font-mono text-sm">
                    <div className="space-y-2">
                      <p className="text-blue-400"># verify_store_isolation --branch_a --branch_b</p>
                      <p className="text-emerald-400 font-bold">✓ AUTHENTICATION INJECTED</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Store A Orders</span>
                        <span className="text-emerald-400 font-bold">VISIBLE (1)</span>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: "100%" }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="bg-emerald-400 h-full"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Store B Orders</span>
                        <span className="text-rose-400 font-bold">PROTECTED (0)</span>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-400 w-0 h-full" />
                      </div>
                    </div>
                    <p className="text-emerald-400/80 italic text-xs">Isolation test PASSED. Fasa 0 RASMI SIAP.</p>
                  </div>

                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full" />
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-6xl md:text-8xl font-black tracking-tighter">Ready to <br/><span className="text-primary italic">Transform?</span></h2>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto font-medium">Join the growing community of Malaysian entrepreneurs building smarter businesses.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button size="lg" className="h-20 px-12 rounded-[2rem] text-xl font-black bg-primary text-primary-foreground shadow-2xl hover:shadow-primary/40 transition-all hover:scale-105">
              Get Started Now
            </Button>
            <Button size="lg" variant="outline" className="h-20 px-12 rounded-[2rem] text-xl font-black border-2 hover:bg-secondary transition-all">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t bg-muted/20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          <div className="col-span-1 md:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <UtensilsCrossed className="w-7 h-7" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase">Warung J&J</span>
            </div>
            <p className="text-lg text-muted-foreground max-w-sm font-medium leading-relaxed">
              Empowering Malaysian hospitality with world-class technology. Modernizing the warung experience, one table at a time.
            </p>
          </div>
          
          <div className="space-y-8">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Product</h4>
            <ul className="space-y-5 text-base font-bold text-muted-foreground/80">
              <li><a href="#" className="hover:text-primary transition-colors">POS Ecosystem</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Smart Kitchen</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Inventory AI</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Partner Program</a></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Connect</h4>
            <ul className="space-y-5 text-base font-bold text-muted-foreground/80">
              <li><a href="#" className="hover:text-primary transition-colors">Headquarters</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Support Center</a></li>
              <li><a href="/api/public/mcp" target="_blank" className="hover:text-primary transition-colors flex items-center gap-2"><span className="text-xl">🤖</span> Agent Integration API</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Legal Hub</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-bold text-muted-foreground/60">
          <p>© 2026 Warung J&J POS Systems. Engineered for scale.</p>
          <div className="flex gap-12">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

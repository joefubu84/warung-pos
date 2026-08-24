import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';
import { 
  Award, 
  Search, 
  Plus, 
  Gift, 
  Sparkles, 
  Crown, 
  Phone, 
  User, 
  TrendingUp, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  getLoyaltyMembers, 
  fetchMembersFromSupabase,
  clearAllLoyaltyMembers,
  registerOrUpdateMember, 
  redeemRewardForMember, 
  getRewardsCatalog, 
  LoyaltyMember, 
  RewardCatalogItem 
} from '@/lib/loyalty-config';
import { getWhatsAppWebUrl, sanitizePhone } from '@/lib/whatsapp-otp';
import { MessageSquare, Send, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/loyalty')({
  ssr: false,
  beforeLoad: async ({ context, location }: any) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: LoyaltyPage,
});

function LoyaltyPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>(getLoyaltyMembers());
  const [rewardsCatalog] = useState<RewardCatalogItem[]>(getRewardsCatalog());
  const [searchQuery, setSearchQuery] = useState('');

  // Register / Add Points Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regName, setRegName] = useState('');
  const [regAddPoints, setRegAddPoints] = useState(0);

  // Redeem Reward Modal State
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

  useEffect(() => {
    // Purge any legacy demo storage keys
    if (typeof window !== 'undefined') {
      localStorage.removeItem('warung_loyalty_members_v2');
      localStorage.removeItem('warung_loyalty_members_v1');
    }

    const handleUpdate = () => setMembers(getLoyaltyMembers());
    window.addEventListener('warung_loyalty_updated', handleUpdate);
    fetchMembersFromSupabase().then(loaded => setMembers(loaded));
    return () => window.removeEventListener('warung_loyalty_updated', handleUpdate);
  }, []);

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.tier.toLowerCase().includes(q);
  });

  const totalPointsIssued = members.reduce((sum, m) => sum + m.points, 0);
  const platinumCount = members.filter(m => m.tier === 'Platinum').length;
  const goldCount = members.filter(m => m.tier === 'Gold').length;

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone.trim()) {
      toast.error('Please enter customer phone number.');
      return;
    }

    const updated = registerOrUpdateMember(regPhone, regName, regAddPoints, 0);
    setMembers(getLoyaltyMembers());
    setIsRegisterOpen(false);
    setRegPhone('');
    setRegName('');
    setRegAddPoints(0);
    toast.success(`🎉 Member ${updated.name} updated! Points balance: ${updated.points} pts (${updated.tier} Tier).`);
  };

  const handleRedeem = (reward: RewardCatalogItem) => {
    if (!selectedMember) return;
    const result = redeemRewardForMember(selectedMember.id, reward);
    if (result.success) {
      toast.success(result.message);
      setMembers(getLoyaltyMembers());
      const updated = getLoyaltyMembers().find(m => m.id === selectedMember.id);
      if (updated) setSelectedMember(updated);
    } else {
      toast.error(result.message);
    }
  };

  const getTierBadge = (tier: string) => {
    if (tier === 'Platinum') return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full text-xs font-bold font-mono">💎 Platinum VIP</span>;
    if (tier === 'Gold') return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold font-mono">🥇 Gold VIP</span>;
    if (tier === 'Silver') return <span className="bg-slate-400/20 text-slate-200 border border-slate-400/30 px-2.5 py-1 rounded-full text-xs font-bold font-mono">🥈 Silver Member</span>;
    return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-bold font-mono">🥉 Bronze Member</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">


        {/* LOYALTY HEADER CARD */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-7 h-7 text-amber-400 animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Customer Loyalty & VIP Rewards</h1>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Manage member tiers, track points earned per RM spent, and issue reward vouchers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setIsRegisterOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-mono"
            >
              <Plus className="w-4 h-4" /> Register / Add Member Points
            </Button>
          </div>
        </div>

        {/* SUMMARY STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 block">Total VIP Members</span>
            <span className="text-2xl font-black text-emerald-400">{members.length}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 block">Total Active Points</span>
            <span className="text-2xl font-black text-amber-400">{totalPointsIssued} pts</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 block">Gold VIPs (500+ pts)</span>
            <span className="text-2xl font-black text-sky-400">{goldCount}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 block">Platinum VIPs (1k+ pts)</span>
            <span className="text-2xl font-black text-purple-400">{platinumCount}</span>
          </div>
        </div>

        {/* MAIN MEMBERS & REWARDS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT 2 COLS: MEMBERS DIRECTORY */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" /> Member Directory
                </h2>
                <p className="text-xs text-slate-400 font-mono">Search by phone number, customer name, or VIP tier</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search phone or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white pl-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            {/* MEMBERS TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">VIP Tier</th>
                    <th className="pb-3 text-right">Points</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 font-bold text-white">
                        <div>{member.name}</div>
                        <span className="text-[10px] text-slate-500 font-normal">Spent: RM {member.totalSpent.toFixed(2)}</span>
                      </td>
                      <td className="py-3 text-slate-300">{member.phone}</td>
                      <td className="py-3">{getTierBadge(member.tier)}</td>
                      <td className="py-3 text-right font-black text-amber-400 text-sm">
                        {member.points} <span className="text-[10px] text-slate-500 font-normal">pts</span>
                      </td>
                      <td className="py-3 text-right flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => {
                            const promoMsg = `🌟 *SPECIAL WARUNG J&J PROMO FOR ${member.name.toUpperCase()}!*\n\nHi ${member.name}! As a valued ${member.tier} VIP Member, you currently have *${member.points} points* balance! 💎\n\nEnjoy our Special Weekend Special: Claim 1 Free Teh Tarik or RM 5.00 Off on your next dine-in or takeaway order at Warung J&J! ☕🍱\n\nShow this message on your next visit!`;
                            const waUrl = getWhatsAppWebUrl(member.phone, promoMsg);
                            window.open(waUrl, '_blank');
                            toast.success(`💬 Opening WhatsApp to send promo message to ${member.name}!`);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg gap-1 shadow-sm font-mono"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WA Promo
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedMember(member);
                            setIsRedeemOpen(true);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] px-3 py-1 rounded-lg gap-1 shadow-sm"
                        >
                          <Gift className="w-3.5 h-3.5" /> Redeem
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Award className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                        <p className="font-bold text-slate-300 text-sm">Tiada Ahli Berdaftar Buat Masa Ini</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                          Program ganjaran ahli belum dilancarkan secara rasmi. Pendaftaran ahli boleh ditambah pada bila-bila masa menggunakan butang "Register / Add Member Points".
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COL: REWARDS CATALOG */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" /> Rewards Catalog
              </h2>
              <p className="text-xs text-slate-400 font-mono">Available reward vouchers & free items</p>
            </div>

            <div className="space-y-3 font-mono">
              {rewardsCatalog.map((reward) => (
                <div key={reward.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{reward.emoji}</span>
                      <div>
                        <h4 className="font-bold text-white text-xs">{reward.title}</h4>
                        <p className="text-[10px] text-slate-400">{reward.description}</p>
                      </div>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                      {reward.pointsRequired} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* REGISTER / ADD POINTS DIALOG */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-400 font-mono">
              <User className="w-5 h-5" /> Register / Credit Member Points
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono">
              Enter customer phone number to credit points or register as a new VIP member
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMember} className="space-y-4 my-2">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">Customer Phone Number *</Label>
              <Input
                required
                placeholder="e.g. 60172221784"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">Customer Name</Label>
              <Input
                placeholder="e.g. Ahmad Razak"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">Add Bonus Points</Label>
              <Input
                type="number"
                value={regAddPoints}
                onChange={(e) => setRegAddPoints(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
              <p className="text-[10px] text-slate-500 font-mono">New members automatically receive 50 bonus welcome points!</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                Save & Issue Points
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REDEEM REWARD DIALOG */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-400 font-mono">
              <Gift className="w-5 h-5" /> Redeem Reward Voucher
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono">
              {selectedMember && `Select a reward to claim for ${selectedMember.name} (Current: ${selectedMember.points} pts)`}
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-3 my-2 font-mono">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <span>Member: <strong className="text-white">{selectedMember.name}</strong></span>
                <span className="text-amber-400 font-black">{selectedMember.points} pts available</span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {rewardsCatalog.map((reward) => {
                  const canAfford = selectedMember.points >= reward.pointsRequired;
                  return (
                    <div key={reward.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{reward.emoji}</span>
                        <div>
                          <div className="font-bold text-white text-xs">{reward.title}</div>
                          <span className="text-[10px] text-amber-400">{reward.pointsRequired} pts required</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={!canAfford}
                        onClick={() => handleRedeem(reward)}
                        className={`text-xs font-bold ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {canAfford ? 'Redeem' : 'Need Points'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsRedeemOpen(false)} className="border-slate-800 text-slate-300">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

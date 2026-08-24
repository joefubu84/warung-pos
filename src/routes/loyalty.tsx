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
  addRewardItem,
  updateRewardItem,
  deleteRewardItem,
  clearAllRewards,
  saveRewardsCatalog,
  DEFAULT_REWARDS_CATALOG,
  LoyaltyMember, 
  RewardCatalogItem 
} from '@/lib/loyalty-config';
import { getWhatsAppWebUrl, sanitizePhone } from '@/lib/whatsapp-otp';
import { MessageSquare, Send, Share2, Trash2, Pencil, RotateCcw, Tag } from 'lucide-react';
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
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardCatalogItem[]>(getRewardsCatalog());
  const [searchQuery, setSearchQuery] = useState('');

  // Register / Add Points Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regName, setRegName] = useState('');
  const [regAddPoints, setRegAddPoints] = useState(0);

  // Redeem Reward Modal State
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

  // Add / Edit Reward Modal State
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardCatalogItem | null>(null);
  const [rewEmoji, setRewEmoji] = useState('💎');
  const [rewTitle, setRewTitle] = useState('');
  const [rewPoints, setRewPoints] = useState(50);
  const [rewType, setRewType] = useState<'discount_rm' | 'free_item' | 'percentage_off'>('discount_rm');
  const [rewValue, setRewValue] = useState(5.00);
  const [rewDesc, setRewDesc] = useState('');

  useEffect(() => {
    // Purge any legacy demo storage keys
    if (typeof window !== 'undefined') {
      localStorage.removeItem('warung_loyalty_members_v2');
      localStorage.removeItem('warung_loyalty_members_v1');
    }

    const handleUpdate = () => {
      setMembers(getLoyaltyMembers());
      setRewardsCatalog(getRewardsCatalog());
    };
    window.addEventListener('warung_loyalty_updated', handleUpdate);
    window.addEventListener('warung_rewards_catalog_updated', handleUpdate);
    fetchMembersFromSupabase().then(loaded => setMembers(loaded));
    return () => {
      window.removeEventListener('warung_loyalty_updated', handleUpdate);
      window.removeEventListener('warung_rewards_catalog_updated', handleUpdate);
    };
  }, []);

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.tier.toLowerCase().includes(q);
  });

  const totalPointsIssued = members.reduce((sum, m) => sum + m.points, 0);
  const platinumCount = members.filter(m => m.tier === 'Platinum').length;
  const goldCount = members.filter(m => m.tier === 'Gold').length;

  const handleOpenAddReward = () => {
    setEditingReward(null);
    setRewEmoji('💎');
    setRewTitle('');
    setRewPoints(50);
    setRewType('discount_rm');
    setRewValue(5.00);
    setRewDesc('');
    setIsRewardModalOpen(true);
  };

  const handleOpenEditReward = (reward: RewardCatalogItem) => {
    setEditingReward(reward);
    setRewEmoji(reward.emoji || '💎');
    setRewTitle(reward.title);
    setRewPoints(reward.pointsRequired);
    setRewType(reward.rewardType || 'discount_rm');
    setRewValue(reward.value || 0);
    setRewDesc(reward.description || '');
    setIsRewardModalOpen(true);
  };

  const handleDeleteReward = (id: string, title: string) => {
    deleteRewardItem(id);
    setRewardsCatalog(getRewardsCatalog());
    toast.success(`Baucar ganjaran "${title}" telah dipadam.`);
  };

  const handleSaveReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewTitle.trim()) {
      toast.error('Sila masukkan nama baucar ganjaran.');
      return;
    }

    if (editingReward) {
      updateRewardItem({
        id: editingReward.id,
        title: rewTitle.trim(),
        emoji: rewEmoji,
        pointsRequired: Number(rewPoints) || 10,
        rewardType: rewType,
        value: Number(rewValue) || 0,
        description: rewDesc.trim() || `${rewEmoji} ${rewTitle}`
      });
      toast.success(`Ganjaran "${rewTitle}" berjaya dikemaskini!`);
    } else {
      addRewardItem({
        title: rewTitle.trim(),
        emoji: rewEmoji,
        pointsRequired: Number(rewPoints) || 10,
        rewardType: rewType,
        value: Number(rewValue) || 0,
        description: rewDesc.trim() || `${rewEmoji} ${rewTitle}`
      });
      toast.success(`Ganjaran baru "${rewTitle}" berjaya ditambah!`);
    }
    setRewardsCatalog(getRewardsCatalog());
    setIsRewardModalOpen(false);
  };

  const handleResetRewardsToDefault = () => {
    saveRewardsCatalog(DEFAULT_REWARDS_CATALOG);
    setRewardsCatalog(DEFAULT_REWARDS_CATALOG);
    toast.success('Katalog ganjaran telah ditetapkan semula.');
  };

  const handleClearAllRewards = () => {
    clearAllRewards();
    setRewardsCatalog([]);
    toast.success('Semua baucar ganjaran telah dikosongkan.');
  };

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

  const emojiPresets = ['💎', '🎁', '🥤', '☕', '🍗', '🍱', '🍔', '💵', '🌟', '🏷️', '🎉', '🔥'];

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" /> Rewards Catalog
                </h2>
                <p className="text-xs text-slate-400 font-mono">Available reward vouchers ({rewardsCatalog.length})</p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={handleOpenAddReward}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md font-mono"
                >
                  <Plus className="w-3.5 h-3.5" /> + Tambah Ganjaran
                </Button>
                {rewardsCatalog.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearAllRewards}
                    title="Kosongkan Semua Baucar"
                    className="border-slate-800 bg-slate-950 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs px-2 py-1.5 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3 font-mono max-h-[520px] overflow-y-auto pr-1">
              {rewardsCatalog.map((reward) => (
                <div key={reward.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-2xl shrink-0 mt-0.5">{reward.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-white text-xs truncate">{reward.title}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{reward.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {reward.rewardType === 'free_item' ? '🎁 Free Item' : reward.rewardType === 'percentage_off' ? `${reward.value}% Off` : `RM ${reward.value.toFixed(2)} Off`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {reward.pointsRequired} pts
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditReward(reward)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                          title="Edit Ganjaran"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteReward(reward.id, reward.title)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md"
                          title="Padam Ganjaran"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {rewardsCatalog.length === 0 && (
                <div className="py-10 text-center text-slate-500 space-y-3">
                  <Gift className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                  <p className="text-xs text-slate-400 font-bold">Tiada Baucar Ganjaran</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Klik butang <strong>"+ Tambah Ganjaran"</strong> untuk mencipta baucar baru, atau muat semula templat standard.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetRewardsToDefault}
                    className="border-slate-800 text-amber-300 hover:bg-slate-800 text-xs gap-1.5 mx-auto font-mono"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Muat Templat Contoh
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ADD / EDIT REWARD DIALOG */}
      <Dialog open={isRewardModalOpen} onOpenChange={setIsRewardModalOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-400 font-mono">
              <Gift className="w-5 h-5" /> {editingReward ? 'Edit Baucar Ganjaran' : 'Tambah Baucar Ganjaran Baru'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono">
              Tetapkan syarat mata, jenis diskaun, dan butiran baucar ganjaran ahli.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReward} className="space-y-4 my-2">
            {/* Emoji selector */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs font-bold">Pilih Ikon / Emoji</Label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                {emojiPresets.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setRewEmoji(emoji)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                      rewEmoji === emoji ? 'bg-amber-500/30 border border-amber-400 scale-110' : 'hover:bg-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">Nama Baucar / Ganjaran *</Label>
              <Input
                required
                placeholder="e.g. Diskaun RM 5.00 Ahli"
                value={rewTitle}
                onChange={(e) => setRewTitle(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-bold">Mata Diperlukan (pts) *</Label>
                <Input
                  required
                  type="number"
                  min="1"
                  value={rewPoints}
                  onChange={(e) => setRewPoints(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-bold">Jenis Ganjaran *</Label>
                <select
                  value={rewType}
                  onChange={(e) => setRewType(e.target.value as any)}
                  className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-white text-xs px-3 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="discount_rm">Potongan Nilai (RM)</option>
                  <option value="free_item">Item / Minuman Percuma</option>
                  <option value="percentage_off">Potongan Peratus (%)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">
                {rewType === 'discount_rm' ? 'Nilai Potongan (RM)' : rewType === 'percentage_off' ? 'Peratus Diskaun (%)' : 'Anggaran Nilai Item (RM)'}
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={rewValue}
                onChange={(e) => setRewValue(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-bold">Penerangan / Syarat Ganjaran</Label>
              <Input
                placeholder="e.g. Tebus 50 mata untuk potongan RM 5.00 pada jumlah bil."
                value={rewDesc}
                onChange={(e) => setRewDesc(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRewardModalOpen(false)} className="border-slate-800 text-slate-300 text-xs">
                Batal
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
                {editingReward ? 'Kemaskini Ganjaran' : 'Simpan Ganjaran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

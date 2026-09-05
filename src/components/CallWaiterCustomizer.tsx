import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  CallWaiterReason, 
  DEFAULT_CALL_WAITER_REASONS, 
  PRESET_CALL_WAITER_REASONS,
  AVAILABLE_ICONS,
  getIconComponent,
  getCallWaiterReasons, 
  syncCallWaiterReasonsToSupabase,
  fetchCallWaiterReasonsFromSupabase,
  resetCallWaiterReasonsToDefault
} from '@/lib/call-waiter-config';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  Bell, 
  ChevronUp, 
  ChevronDown, 
  Pencil, 
  Check, 
  Sparkles, 
  Loader2,
  Smartphone,
  Eye
} from 'lucide-react';

export function CallWaiterCustomizer() {
  const [reasons, setReasons] = useState<CallWaiterReason[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New Reason Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState('bell');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<CallWaiterReason | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('bell');
  const [editEnabled, setEditEnabled] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Preview Selected State (for interactive mobile mock)
  const [previewSelectedId, setPreviewSelectedId] = useState<string>('waiter');

  // Load from Supabase on mount
  useEffect(() => {
    setIsLoading(true);
    fetchCallWaiterReasonsFromSupabase()
      .then((data) => {
        setReasons(data);
        if (data.length > 0) {
          setPreviewSelectedId(data[0]?.id || 'waiter');
        }
      })
      .finally(() => setIsLoading(false));

    const handleUpdate = (e: any) => {
      if (e?.detail) setReasons(e.detail);
    };
    window.addEventListener('warung_call_waiter_reasons_updated', handleUpdate);
    return () => window.removeEventListener('warung_call_waiter_reasons_updated', handleUpdate);
  }, []);

  const handleToggleEnable = async (id: string) => {
    const updated = reasons.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setReasons(updated);
    await syncCallWaiterReasonsToSupabase(updated);
    toast.success('Status pilihan dikemas kini');
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newItems = [...reasons];
    const temp = newItems[index - 1]!;
    newItems[index - 1] = newItems[index]!;
    newItems[index] = temp;
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    setReasons(reordered);
    await syncCallWaiterReasonsToSupabase(reordered);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= reasons.length - 1) return;
    const newItems = [...reasons];
    const temp = newItems[index + 1]!;
    newItems[index + 1] = newItems[index]!;
    newItems[index] = temp;
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    setReasons(reordered);
    await syncCallWaiterReasonsToSupabase(reordered);
  };

  const handleDelete = async (id: string) => {
    if (reasons.length <= 1) {
      toast.error('Perlu ada sekurang-kurangnya 1 pilihan bantuan untuk pelanggan.');
      return;
    }
    const itemToDelete = reasons.find(r => r.id === id);
    if (!confirm(`Padam pilihan "${itemToDelete?.title}"?`)) return;

    const updated = reasons
      .filter(r => r.id !== id)
      .map((item, idx) => ({ ...item, order: idx }));
    setReasons(updated);
    await syncCallWaiterReasonsToSupabase(updated);
    toast.success('Pilihan bantuan dipadam');
  };

  const handleAddPreset = async (preset: { title: string; description: string; icon: string }) => {
    // Check if already exists
    if (reasons.some(r => r.title.toLowerCase() === preset.title.toLowerCase())) {
      toast.info(`"${preset.title}" sudah ada dalam senarai.`);
      return;
    }

    const newItem: CallWaiterReason = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: preset.title,
      description: preset.description,
      icon: preset.icon,
      enabled: true,
      order: reasons.length
    };

    const updated = [...reasons, newItem];
    setReasons(updated);
    await syncCallWaiterReasonsToSupabase(updated);
    toast.success(`Ditambah: ${preset.title}`);
  };

  const handleAddNewCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Sila masukkan tajuk tujuan bantuan.');
      return;
    }

    const newItem: CallWaiterReason = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Perlukan bantuan daripada staf meja',
      icon: newIcon,
      enabled: true,
      order: reasons.length
    };

    const updated = [...reasons, newItem];
    setReasons(updated);
    setNewTitle('');
    setNewDescription('');
    setNewIcon('bell');
    await syncCallWaiterReasonsToSupabase(updated);
    toast.success(`Berjaya menambah: ${newItem.title}`);
  };

  const handleOpenEdit = (item: CallWaiterReason) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditIcon(item.icon);
    setEditEnabled(item.enabled);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editTitle.trim()) return;

    const updated = reasons.map(r => {
      if (r.id === editingItem.id) {
        return {
          ...r,
          title: editTitle.trim(),
          description: editDescription.trim() || 'Perlukan bantuan daripada staf meja',
          icon: editIcon,
          enabled: editEnabled
        };
      }
      return r;
    });

    setReasons(updated);
    setIsEditModalOpen(false);
    await syncCallWaiterReasonsToSupabase(updated);
    toast.success('Pilihan bantuan dikemaskini');
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      const ok = await syncCallWaiterReasonsToSupabase(reasons);
      if (ok) {
        toast.success('🎉 Semua tetapan panggil pelayan berjaya disimpan ke Supabase!');
      } else {
        toast.error('Gagal menyimpan ke pangkalan data.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ralat menyimpan ke Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Kembalikan semua tujuan panggil pelayan kepada 4 tetapan asal? Pilihan tambahan anda akan digantikan.')) {
      setIsSaving(true);
      try {
        const res = await resetCallWaiterReasonsToDefault();
        setReasons(res);
        toast.success('Tetapan dikembalikan ke nilai lalai asal.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const activeCount = reasons.filter(r => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl shrink-0">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Tetapan Tujuan Panggil Pelayan
              </h2>
              <span className="text-[11px] font-mono px-2.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full font-bold">
                {activeCount} Aktif di Meja
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Ubahsuai senarai bantuan & tujuan buzzer yang boleh dipilih oleh pelanggan semasa mengimbas kod QR di meja makan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs gap-1.5 h-10"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Asal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs gap-2 h-10 px-4 shadow-lg shadow-orange-500/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
            Simpan ke Supabase
          </Button>
        </div>
      </div>

      {/* QUICK PRESET PILLS */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Cadangan Preset Pantas (1-Klik Tambah):
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Klik untuk masukkan ke senarai</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_CALL_WAITER_REASONS.map((preset, idx) => {
            const Icon = getIconComponent(preset.icon);
            const isAlreadyAdded = reasons.some(r => r.title.toLowerCase() === preset.title.toLowerCase());
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddPreset(preset)}
                disabled={isAlreadyAdded}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                  isAlreadyAdded
                    ? 'bg-slate-900/40 text-slate-600 border-slate-800/50 cursor-not-allowed'
                    : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:border-orange-400 hover:text-white hover:bg-slate-800 active:scale-95 shadow-sm'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-orange-400" />
                <span>{preset.title}</span>
                {isAlreadyAdded ? (
                  <span className="text-[10px] text-emerald-400">✓</span>
                ) : (
                  <span className="text-orange-400 font-black">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN GRID (Left: Management List + Form, Right: Live Phone Mockup) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE REASONS LIST & ADD FORM */}
        <div className="xl:col-span-7 space-y-5">
          
          {/* ACTIVE REASONS LIST */}
          <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl overflow-hidden shadow-xl">
            <CardHeader className="p-5 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Senarai Pilihan Bantuan Meja</span>
                  <span className="text-xs font-normal text-slate-400">({reasons.length} pilihan)</span>
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gunakan anak panah untuk susun turutan, atau togol suis untuk sembunyikan sementara.
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-2.5">
              {isLoading ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                  <span className="text-xs">Memuatkan tetapan...</span>
                </div>
              ) : reasons.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Tiada pilihan panggil pelayan. Sila tekan &quot;Reset Asal&quot;.
                </div>
              ) : (
                reasons.map((item, index) => {
                  const Icon = getIconComponent(item.icon);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        item.enabled 
                          ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700' 
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      {/* LEFT: ORDER CONTROLS & ICON */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                            title="Pindah ke Atas"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === reasons.length - 1}
                            onClick={() => handleMoveDown(index)}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                            title="Pindah ke Bawah"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                          item.enabled 
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                            : 'bg-slate-900 text-slate-600 border-slate-800'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white truncate">
                              {item.title}
                            </span>
                            {!item.enabled && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                Nyahaktif
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* RIGHT: TOGGLE SWITCH & ACTIONS */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 mr-1" title={item.enabled ? 'Pilihan Aktif' : 'Pilihan Ditutup'}>
                          <Switch
                            checked={item.enabled}
                            onCheckedChange={() => handleToggleEnable(item.id)}
                            className="data-[state=checked]:bg-orange-500"
                          />
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                          title="Sunting Pilihan"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                          title="Padam Pilihan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ADD NEW CUSTOM REASON FORM */}
          <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl shadow-xl">
            <CardHeader className="p-5 border-b border-slate-800">
              <CardTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-400" />
                Tambah Pilihan Bantuan Baru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleAddNewCustom} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Tajuk Bantuan <span className="text-orange-400">*</span>
                    </label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="cth: Bungkus Makanan (Tapau)"
                      className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Pilih Ikon Visual
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {AVAILABLE_ICONS.map((ic) => {
                        const Icon = ic.icon;
                        const isSel = newIcon === ic.id;
                        return (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setNewIcon(ic.id)}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                              isSel 
                                ? 'bg-orange-500 text-white border-orange-400 shadow-md ring-2 ring-orange-500/30' 
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-850'
                            }`}
                            title={ic.label}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Penerangan Ringkas Kepada Pelanggan
                  </label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="cth: Minta kotak / plastik untuk bawa pulang baki makanan"
                    className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10 focus:border-orange-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs gap-1.5 h-10 px-5 shadow-lg shadow-orange-500/20"
                  >
                    <Plus className="w-4 h-4" /> Tambah Pilihan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE LIVE MOBILE PHONE PREVIEW */}
        <div className="xl:col-span-5 space-y-3 sticky top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <Smartphone className="w-4 h-4 text-orange-400" /> Pratonton Langsung Telefon Pelanggan
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
              Live Preview
            </span>
          </div>

          {/* PHONE CONTAINER FRAME */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex justify-center">
            {/* PHONE INNER FRAME (FAUNA KITCHEN LIGHT MODAL MOCK) */}
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-xl border border-slate-200 text-slate-900 font-sans space-y-4">
              
              {/* MODAL HEADER */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-black shrink-0">
                    🛎️
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      Panggil Pelayan Meja #A3
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Pilih jenis bantuan yang anda perlukan. Staf kami akan segera ke meja anda.
                    </p>
                  </div>
                </div>
                <span className="text-slate-400 text-xs font-bold">✕</span>
              </div>

              {/* REASONS LIST */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                {reasons.filter(r => r.enabled).map((opt) => {
                  const Icon = getIconComponent(opt.icon);
                  const isSelected = previewSelectedId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPreviewSelectedId(opt.id)}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/20'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className={`block text-xs font-bold truncate ${isSelected ? 'text-orange-950' : 'text-slate-800'}`}>
                            {opt.title}
                          </span>
                          <span className="text-[10px] text-slate-500 line-clamp-1">{opt.description}</span>
                        </div>
                      </div>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}

                {reasons.filter(r => r.enabled).length === 0 && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs text-center">
                    Semua pilihan bantuan dinyahaktifkan. Sila hidupkan sekurang-kurangnya satu pilihan.
                  </div>
                )}
              </div>

              {/* OPTIONAL NOTE INPUT */}
              <div>
                <input
                  readOnly
                  placeholder="Catatan tambahan (pilihan, cth: Tolong bawa mangkuk cili)"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-500/20"
                >
                  🛎️ Hantar Panggilan
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* EDIT REASON MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-orange-400" />
              Sunting Pilihan Bantuan Meja
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Tajuk Bantuan
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tajuk bantuan"
                className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Penerangan Ringkas
              </label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Penerangan ringkas untuk pelanggan"
                className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Pilih Ikon
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {AVAILABLE_ICONS.map((ic) => {
                  const Icon = ic.icon;
                  const isSel = editIcon === ic.id;
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setEditIcon(ic.id)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                        isSel 
                          ? 'bg-orange-500 text-white border-orange-400 shadow-md ring-2 ring-orange-500/30' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-850'
                      }`}
                      title={ic.label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">Status Penggunaan</span>
                <span className="text-[11px] text-slate-400">Papar pada menu QR meja</span>
              </div>
              <Switch
                checked={editEnabled}
                onCheckedChange={setEditEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editTitle.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

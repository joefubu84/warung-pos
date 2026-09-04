import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Utensils, 
  Flame, 
  Check, 
  ShoppingBag,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getAddonsConfig, CustomAddon } from '@/lib/addons-config';
import { COMMON_MODIFIERS } from '@/lib/kitchen-checklist-config';

export interface CustomizedCartItem {
  id: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  finalPrice: number;
  quantity: number;
  fulfillmentType: 'dine_in' | 'takeaway' | 'delivery' | 'self_pickup';
  spiceLevel: 'Mild' | 'Medium' | 'Hot';
  selectedAddons: { name: string; price: number }[];
  specialInstructions: string;
  packNotes?: string[];
  notes: string;
}

export interface DishCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (customizedItem: CustomizedCartItem) => void;
  menuItem: {
    id: string;
    name: string;
    category: string;
    price: number;
    image_url?: string | null;
    description?: string | null;
  } | null;
  mode?: 'delivery' | 'dine_in' | 'table';
  isViewOnly?: boolean;
}

export const SPICE_LEVELS = [
  { id: 'Mild', label: 'Mild 🌿', icon: '🌿' },
  { id: 'Medium', label: 'Medium 🌶️', icon: '🌶️' },
  { id: 'Hot', label: 'Hot 🌶️🌶️', icon: '🔥' },
];

export function DishCustomizationModal({ isOpen, onClose, onAddToCart, menuItem, mode = 'dine_in', isViewOnly = false }: DishCustomizationModalProps) {
  const isDeliveryMode = mode === 'delivery';
  const [spiceLevel, setSpiceLevel] = useState<'Mild' | 'Medium' | 'Hot'>('Medium');
  const [fulfillmentType, setFulfillmentType] = useState<'dine_in' | 'takeaway' | 'delivery' | 'self_pickup'>(
    isDeliveryMode ? 'delivery' : 'dine_in'
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [plateNotes, setPlateNotes] = useState<string[]>(['']);
  const [availableAddons, setAvailableAddons] = useState<CustomAddon[]>(getAddonsConfig());

  useEffect(() => {
    const handleUpdate = () => setAvailableAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSpiceLevel('Medium');
      setFulfillmentType(isDeliveryMode ? 'delivery' : 'dine_in');
      setSelectedAddonIds([]);
      setSpecialInstructions('');
      setQuantity(1);
      setPlateNotes(['']);
    }
  }, [isOpen, menuItem, isDeliveryMode]);

  const updateQuantityClamped = (newQty: number) => {
    const clamped = Math.max(1, newQty);
    setQuantity(clamped);
    setPlateNotes(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push('');
      return next.slice(0, clamped);
    });
  };

  const updateSpecificPlateNote = (idx: number, text: string) => {
    setPlateNotes(prev => {
      const next = [...prev];
      next[idx] = text;
      return next;
    });
  };

  const togglePlateQuickModifier = (idx: number, tag: string) => {
    setPlateNotes(prev => {
      const next = [...prev];
      const cur = (next[idx] || '').trim();
      let nextVal = cur;
      if (cur.toLowerCase().includes(tag.toLowerCase())) {
        nextVal = cur.replace(new RegExp(tag, 'gi'), '').replace(/,\s*,/g, ',').trim();
      } else {
        nextVal = cur ? `${cur}, ${tag}` : tag;
      }
      next[idx] = nextVal;
      return next;
    });
  };

  if (!menuItem) return null;

  const basePrice = Number(menuItem.price || 0);

  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = availableAddons.find(a => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const unitPrice = basePrice + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const toggleAddon = (id: string) => {
    if (selectedAddonIds.includes(id)) {
      setSelectedAddonIds(selectedAddonIds.filter(aId => aId !== id));
    } else {
      setSelectedAddonIds([...selectedAddonIds, id]);
    }
  };

  const handleConfirmAddToCart = () => {
    const selectedAddonsList = selectedAddonIds.map(id => {
      const a = availableAddons.find(item => item.id === id);
      return { name: a?.name || id, price: a?.price || 0 };
    });

    const notesSummaryParts: string[] = [];
    if (fulfillmentType === 'delivery') {
      notesSummaryParts.push('DELIVERY (Penghantaran 🛵)');
    } else if (fulfillmentType === 'self_pickup') {
      notesSummaryParts.push('SELF PICKUP (Ambil Sendiri 🛍️)');
    } else if (fulfillmentType === 'takeaway') {
      notesSummaryParts.push('TAKEAWAY (Bungkus 🥡)');
    } else {
      notesSummaryParts.push('DINE IN (Makan Sini 🍽️)');
    }
    if (selectedAddonsList.length > 0) {
      notesSummaryParts.push(`Add-ons: ${selectedAddonsList.map(a => a.name).join(', ')}`);
    }

    if (quantity > 1) {
      const specifiedPlates = plateNotes.map((n, i) => `${fulfillmentType === 'dine_in' ? 'Pinggan' : 'Pek'} #${i+1}: ${n || 'Standard'}`).join(' | ');
      notesSummaryParts.push(specifiedPlates);
    } else if (specialInstructions.trim()) {
      notesSummaryParts.push(`Nota: "${specialInstructions.trim()}"`);
    }

    const customizedItem: CustomizedCartItem = {
      id: `${menuItem.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      basePrice: unitPrice,
      finalPrice: totalPrice,
      quantity,
      fulfillmentType,
      spiceLevel,
      selectedAddons: selectedAddonsList,
      specialInstructions: quantity > 1 ? plateNotes.join(' | ') : specialInstructions.trim(),
      packNotes: quantity > 1 ? plateNotes : (specialInstructions.trim() ? [specialInstructions.trim()] : ['']),
      notes: notesSummaryParts.join(' | ')
    };

    onAddToCart(customizedItem);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md max-h-[90vh] overflow-y-auto font-sans p-0 rounded-2xl">
        {/* DISH HERO IMAGE HEADER */}
        <div className="relative h-48 sm:h-52 bg-slate-950 w-full flex items-center justify-center border-b border-slate-800 p-2">
          {menuItem.image_url ? (
            <img
              src={menuItem.image_url}
              alt={menuItem.name}
              className="w-full h-full object-contain drop-shadow-xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Utensils className="w-12 h-12" />
              <span className="text-xs font-mono">No Image Available</span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 font-mono font-bold text-xs shadow-md">
            RM {basePrice.toFixed(2)}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* TITLE & DESCRIPTION */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white tracking-tight">{menuItem.name}</h3>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                ⭐ 4.8 / 5
              </span>
            </div>
            {menuItem.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{menuItem.description}</p>
            )}
          </div>

          {/* 1. FULFILLMENT TYPE SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>1. Jenis Pesanan</span>
              <span className="text-[10px] text-emerald-400 font-normal">Pilih Satu</span>
            </label>
            {isDeliveryMode ? (
              <div className="grid grid-cols-2 gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('delivery')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'delivery'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400 shadow-md scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">🛵</span>
                  <span>Penghantaran (Delivery)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType('self_pickup')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'self_pickup'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-md scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">🛍️</span>
                  <span>Ambil Sendiri (Self-Pickup)</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('dine_in')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'dine_in'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400 shadow-md scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">🍽️</span>
                  <span>Dine In (Makan Sini)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType('takeaway')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'takeaway'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-md scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">🥡</span>
                  <span>Takeaway (Bungkus)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. QUANTITY SELECTOR */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center font-mono">
            <div>
              <span className="text-xs text-slate-300 font-bold uppercase block">
                2. Bilangan {isDeliveryMode || fulfillmentType !== 'dine_in' ? 'Bungkusan / Pek' : 'Pinggan'} (Kuantiti)
              </span>
              <span className="text-[10px] text-slate-500">Pilih berapa kuantiti untuk hidangan ini</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateQuantityClamped(quantity - 1)}
                className="h-8 w-8 text-slate-300 hover:bg-slate-800 active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-base font-black text-amber-400 w-8 text-center">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateQuantityClamped(quantity + 1)}
                className="h-8 w-8 text-slate-300 hover:bg-slate-800 active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 3. SPICE LEVEL SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>3. Tahap Kepedasan</span>
              <span className="text-[10px] text-amber-400 font-normal">Pilihan Rasa</span>
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {SPICE_LEVELS.map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSpiceLevel(lvl.id as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    spiceLevel === lvl.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{lvl.icon}</span>
                  <span>{lvl.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. SPECIAL INSTRUCTIONS (PER-PLATE IF QTY > 1) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                {quantity > 1 
                  ? `4. Permintaan Khas Setiap ${fulfillmentType === 'dine_in' ? 'Pinggan' : 'Pek'} (1 hingga ${quantity})` 
                  : '4. Permintaan Khas Dapur (Optional)'}
              </label>
              <span className="text-[10px] text-amber-400 font-mono">Pilihan Pantas 👇</span>
            </div>

            {quantity > 1 ? (
              <div className="space-y-3">
                {Array.from({ length: quantity }).map((_, pIdx) => {
                  const curNote = plateNotes[pIdx] || '';
                  return (
                    <div key={pIdx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 shadow-inner">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black text-amber-400 font-mono flex items-center gap-1">
                          <span>{fulfillmentType === 'dine_in' ? '🍽️ Pinggan' : '🥡 Bungkusan'} #{pIdx + 1}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({pIdx + 1} daripada {quantity})</span>
                        </span>
                        {curNote && (
                          <span className="text-[10px] text-emerald-400 font-bold">
                            ✓ Nota Ditetapkan
                          </span>
                        )}
                      </div>

                      <Textarea
                        value={curNote}
                        onChange={(e) => updateSpecificPlateNote(pIdx, e.target.value)}
                        placeholder={`Nota Pinggan #${pIdx + 1} (cth: Tak nak lada, ekstra pedas, kuah banjir...)`}
                        className="bg-slate-900 border-slate-800 text-white text-xs min-h-[45px] resize-none"
                      />

                      {/* QUICK MODIFIER PILLS FOR THIS SPECIFIC PLATE */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {COMMON_MODIFIERS.map(mod => {
                          const isSelected = curNote.toLowerCase().includes(mod.tag);
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              onClick={() => togglePlateQuickModifier(pIdx, mod.tag)}
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all border flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm scale-102'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{mod.icon}</span>
                              <span>{(mod.label.split('/')[0] ?? mod.label).trim()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* QUICK MODIFIER CHIPS */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {COMMON_MODIFIERS.map(mod => {
                    const isSelected = specialInstructions.toLowerCase().includes(mod.tag);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSpecialInstructions(prev => prev.replace(new RegExp(mod.tag, 'gi'), '').replace(/,\s*,/g, ',').trim());
                          } else {
                            setSpecialInstructions(prev => prev ? `${prev}, ${mod.tag}` : mod.tag);
                          }
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm scale-105'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>{mod.icon}</span>
                        <span>{mod.label}</span>
                      </button>
                    );
                  })}
                </div>

                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Contoh: Tak nak lada, sambal asing, kuah banjir..."
                  className="bg-slate-950 border-slate-800 text-white text-xs min-h-[50px] resize-none"
                />
              </div>
            )}
          </div>

          {/* ADD TO CART ACTION BUTTON OR VIEW ONLY NOTICE */}
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2 font-mono">
            {isViewOnly ? (
              <div className="space-y-2">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-xs text-amber-300 font-medium">
                  🍽️ Sila imbas Kod QR di atas meja anda atau pesan terus di kaunter Warung JNJ Penampang untuk menikmati hidangan ini!
                </div>
                <Button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold py-3 rounded-xl active:scale-98 transition-all"
                >
                  Tutup Paparan Menu
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleConfirmAddToCart}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-xl flex items-center justify-between text-sm active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Masukkan {quantity}x Hidangan ke Troli</span>
                </div>
                <span className="font-mono text-base font-black">RM {totalPrice.toFixed(2)}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

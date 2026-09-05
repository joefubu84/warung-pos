import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Utensils, 
  Check, 
  ShoppingBag,
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
import { COMMON_MODIFIERS } from '@/lib/kitchen-checklist-config';

export interface CustomizedCartItem {
  id: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  finalPrice: number;
  quantity: number;
  fulfillmentType: 'dine_in' | 'takeaway' | 'delivery' | 'self_pickup';
  spiceLevel?: string;
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

export function DishCustomizationModal({ isOpen, onClose, onAddToCart, menuItem, mode = 'dine_in', isViewOnly = false }: DishCustomizationModalProps) {
  const isDeliveryMode = mode === 'delivery';
  const [fulfillmentType, setFulfillmentType] = useState<'dine_in' | 'takeaway' | 'delivery' | 'self_pickup'>(
    isDeliveryMode ? 'delivery' : 'dine_in'
  );
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [plateNotes, setPlateNotes] = useState<string[]>(['']);

  useEffect(() => {
    if (isOpen) {
      setFulfillmentType(isDeliveryMode ? 'delivery' : 'dine_in');
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
  const unitPrice = basePrice;
  const totalPrice = unitPrice * quantity;

  const handleConfirmAddToCart = () => {
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
      selectedAddons: [],
      specialInstructions: quantity > 1 ? plateNotes.join(' | ') : specialInstructions.trim(),
      packNotes: quantity > 1 ? plateNotes : (specialInstructions.trim() ? [specialInstructions.trim()] : ['']),
      notes: notesSummaryParts.join(' | ')
    };

    onAddToCart(customizedItem);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white text-slate-900 border border-slate-200/90 max-w-md max-h-[90vh] overflow-y-auto font-sans p-0 rounded-3xl shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* DISH HERO IMAGE HEADER */}
        <div className="relative h-48 sm:h-52 bg-gradient-to-b from-stone-100 to-stone-50 w-full flex items-center justify-center border-b border-stone-100 p-3">
          {menuItem.image_url ? (
            <img
              src={menuItem.image_url}
              alt={menuItem.name}
              className="w-full h-full object-contain drop-shadow-md rounded-2xl hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <Utensils className="w-12 h-12 stroke-[1.5]" />
              <span className="text-xs font-medium">Gambar Hidangan Warung J&J</span>
            </div>
          )}

          {/* FLOATING PRICE BADGE */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-orange-200 px-3.5 py-1 rounded-full text-orange-600 font-black text-xs shadow-sm">
            RM {basePrice.toFixed(2)}
          </div>

          {/* RATING BADGE */}
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black text-amber-700 shadow-sm flex items-center gap-1">
            ⭐ 4.8 / 5
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* TITLE & DESCRIPTION */}
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{menuItem.name}</h3>
            {menuItem.description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{menuItem.description}</p>
            )}
          </div>

          {/* 1. FULFILLMENT TYPE SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center justify-between">
              <span>1. Pilihan Hidangan</span>
              <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Pilih Satu</span>
            </label>
            {isDeliveryMode ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('delivery')}
                  className={`p-3 rounded-2xl border text-xs font-extrabold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'delivery'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 ring-2 ring-orange-500/20 shadow-sm scale-[1.01]'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl">🛵</span>
                  <span>Penghantaran (Delivery)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType('self_pickup')}
                  className={`p-3 rounded-2xl border text-xs font-extrabold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'self_pickup'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 ring-2 ring-orange-500/20 shadow-sm scale-[1.01]'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl">🛍️</span>
                  <span>Ambil Sendiri (Self-Pickup)</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('dine_in')}
                  className={`p-3 rounded-2xl border text-xs font-extrabold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'dine_in'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 ring-2 ring-orange-500/20 shadow-sm scale-[1.01]'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl">🍽️</span>
                  <span>Dine In (Makan Sini)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType('takeaway')}
                  className={`p-3 rounded-2xl border text-xs font-extrabold transition-all flex flex-col items-center gap-1 ${
                    fulfillmentType === 'takeaway'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 ring-2 ring-orange-500/20 shadow-sm scale-[1.01]'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl">🥡</span>
                  <span>Takeaway (Bungkus)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. QUANTITY SELECTOR */}
          <div className="p-3.5 bg-stone-50/90 rounded-2xl border border-stone-200 flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-900 font-black uppercase tracking-wide block">
                2. Bilangan {isDeliveryMode || fulfillmentType !== 'dine_in' ? 'Bungkusan / Pek' : 'Pinggan'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Pilih berapa kuantiti untuk hidangan ini</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateQuantityClamped(quantity - 1)}
                className="h-8 w-8 text-stone-600 hover:bg-stone-100 active:scale-95 rounded-lg"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </Button>
              <span className="text-base font-black text-orange-600 w-7 text-center">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateQuantityClamped(quantity + 1)}
                className="h-8 w-8 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-lg shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </Button>
            </div>
          </div>

          {/* 3. SPECIAL INSTRUCTIONS (PER-PLATE IF QTY > 1) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-900">
                {quantity > 1 
                  ? `3. Permintaan Khas Setiap ${fulfillmentType === 'dine_in' ? 'Pinggan' : 'Pek'} (1 - ${quantity})` 
                  : '3. Permintaan Khas Dapur (Pilihan)'}
              </label>
              <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Pilihan Pantas ⚡</span>
            </div>

            {quantity > 1 ? (
              <div className="space-y-3">
                {Array.from({ length: quantity }).map((_, pIdx) => {
                  const curNote = plateNotes[pIdx] || '';
                  return (
                    <div key={pIdx} className="p-3 rounded-2xl bg-stone-50/90 border border-stone-200 space-y-2 shadow-sm">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black text-slate-800 flex items-center gap-1">
                          <span>{fulfillmentType === 'dine_in' ? '🍽️ Pinggan' : '🥡 Bungkusan'} #{pIdx + 1}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({pIdx + 1} daripada {quantity})</span>
                        </span>
                        {curNote && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Nota Tersimpan
                          </span>
                        )}
                      </div>

                      <Textarea
                        value={curNote}
                        onChange={(e) => updateSpecificPlateNote(pIdx, e.target.value)}
                        placeholder={`Nota Pinggan #${pIdx + 1} (cth: Tak nak lada, sambal asing, kuah banjir...)`}
                        className="bg-white border-stone-200 text-slate-900 text-xs min-h-[45px] resize-none rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-stone-400"
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
                              className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-all border flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                  : 'bg-white text-stone-700 border-stone-200 hover:border-orange-300 hover:text-orange-600'
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
              <div className="space-y-2">
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
                        className={`text-[11px] px-2.5 py-1 rounded-xl font-bold transition-all border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-stone-100 text-stone-700 border-stone-200 hover:border-orange-300 hover:text-orange-600'
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
                  className="bg-stone-50 border-stone-200 text-slate-900 text-xs min-h-[50px] resize-none rounded-xl p-3 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-stone-400"
                />
              </div>
            )}
          </div>

          {/* ADD TO CART ACTION BUTTON OR VIEW ONLY NOTICE */}
          <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
            {isViewOnly ? (
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs text-amber-800 font-medium">
                  🍽️ Sila imbas Kod QR di atas meja anda atau pesan terus di kaunter Warung J&J Penampang untuk menikmati hidangan ini!
                </div>
                <Button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-3 rounded-2xl active:scale-98 transition-all"
                >
                  Tutup Paparan Menu
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleConfirmAddToCart}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 px-5 rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-between text-sm active:scale-98 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Masukkan {quantity}x ke Troli</span>
                </div>
                <span className="text-base font-black">RM {totalPrice.toFixed(2)}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

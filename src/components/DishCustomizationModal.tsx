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
  fulfillmentType: 'dine_in' | 'takeaway';
  portionSize: 'Small' | 'Medium' | 'Large';
  spiceLevel: 'Mild' | 'Medium' | 'Hot';
  selectedAddons: { name: string; price: number }[];
  specialInstructions: string;
  notes: string;
}

interface DishCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (customizedItem: CustomizedCartItem) => void;
  menuItem: {
    id: string;
    name: string;
    category: string;
    price: number;
    image_url: string | null;
    description?: string;
  } | null;
}

export const PORTION_SIZES = [
  { id: 'Small', label: 'Regular / Small', priceAdd: 0 },
  { id: 'Medium', label: 'Medium (+RM 2.00)', priceAdd: 2.00 },
  { id: 'Large', label: 'Large / Feast (+RM 4.00)', priceAdd: 4.00 },
];

export const SPICE_LEVELS = [
  { id: 'Mild', label: 'Mild 🌿', icon: '🌿' },
  { id: 'Medium', label: 'Medium 🌶️', icon: '🌶️' },
  { id: 'Hot', label: 'Hot 🌶️🌶️', icon: '🔥' },
];

export function DishCustomizationModal({ isOpen, onClose, onAddToCart, menuItem }: DishCustomizationModalProps) {
  const [portionSize, setPortionSize] = useState<'Small' | 'Medium' | 'Large'>('Small');
  const [spiceLevel, setSpiceLevel] = useState<'Mild' | 'Medium' | 'Hot'>('Medium');
  const [fulfillmentType, setFulfillmentType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [availableAddons, setAvailableAddons] = useState<CustomAddon[]>(getAddonsConfig());

  useEffect(() => {
    const handleUpdate = () => setAvailableAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPortionSize('Small');
      setSpiceLevel('Medium');
      setFulfillmentType('dine_in');
      setSelectedAddonIds([]);
      setSpecialInstructions('');
      setQuantity(1);
    }
  }, [isOpen, menuItem]);

  if (!menuItem) return null;

  const basePrice = Number(menuItem.price || 0);
  const sizeOption = PORTION_SIZES.find(s => s.id === portionSize);
  const sizeAddonPrice = sizeOption ? sizeOption.priceAdd : 0;

  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = availableAddons.find(a => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const unitPrice = basePrice + sizeAddonPrice + addonsTotal;
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
    if (fulfillmentType === 'takeaway') {
      notesSummaryParts.push('TAKEAWAY (Bungkus 🥡)');
    } else {
      notesSummaryParts.push('DINE IN (Makan Sini 🍽️)');
    }
    if (portionSize !== 'Small') notesSummaryParts.push(`Size: ${portionSize}`);
    notesSummaryParts.push(`Spice: ${spiceLevel}`);
    if (selectedAddonsList.length > 0) {
      notesSummaryParts.push(`Add-ons: ${selectedAddonsList.map(a => a.name).join(', ')}`);
    }
    if (specialInstructions.trim()) {
      notesSummaryParts.push(`Note: "${specialInstructions.trim()}"`);
    }

    const customizedItem: CustomizedCartItem = {
      id: `${menuItem.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      basePrice: unitPrice,
      finalPrice: totalPrice,
      quantity,
      fulfillmentType,
      portionSize,
      spiceLevel,
      selectedAddons: selectedAddonsList,
      specialInstructions: specialInstructions.trim(),
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

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-slate-950 text-slate-300 rounded-full border border-slate-800 transition-colors shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>

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

          {/* 0. FULFILLMENT TYPE SELECTOR (Dine In vs Takeaway) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>0. Order Type for this Dish</span>
              <span className="text-[10px] text-emerald-400 font-normal">Select One</span>
            </label>
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
          </div>

          {/* 1. PORTION SIZE SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>1. Choose Portion Size</span>
              <span className="text-[10px] text-emerald-400 font-normal">Required</span>
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {PORTION_SIZES.map(size => {
                const isSelected = portionSize === size.id;
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setPortionSize(size.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md scale-[1.02]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{size.id}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {size.priceAdd > 0 ? `+RM ${size.priceAdd.toFixed(2)}` : 'Base'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SPICE LEVEL SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>2. Choose Spice Level</span>
              <span className="text-[10px] text-amber-400 font-normal">Required</span>
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {SPICE_LEVELS.map(spice => {
                const isSelected = spiceLevel === spice.id;
                return (
                  <button
                    key={spice.id}
                    type="button"
                    onClick={() => setSpiceLevel(spice.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md scale-[1.02]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{spice.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. OPTIONAL ADD-ONS CHECKBOXES */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>3. Extra Add-ons (Optional)</span>
              <span className="text-[10px] text-slate-500 font-normal">Multi-select</span>
            </label>
            <div className="space-y-1.5 font-mono">
              {availableAddons.filter(a => a.available).map(addon => {
                const isChecked = selectedAddonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon.id)}
                    className={`w-full p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      isChecked
                        ? 'bg-slate-800 border-emerald-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        isChecked ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-900'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{addon.name}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">+RM {addon.price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. SPECIAL INSTRUCTIONS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>4. Permintaan Khas Dapur (Optional)</span>
              <span className="text-[10px] text-amber-400">Pilihan Pantas 👇</span>
            </label>
            
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

          {/* QUANTITY COUNTER & ADD TO CART BUTTON */}
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-3 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold uppercase">Quantity</span>
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-7 w-7 text-slate-300 hover:bg-slate-800"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-sm font-bold text-white w-6 text-center">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-7 w-7 text-slate-300 hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleConfirmAddToCart}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-xl flex items-center justify-between text-sm active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>Add Custom Dish to Cart</span>
              </div>
              <span className="font-mono text-base font-black">RM {totalPrice.toFixed(2)}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  KitchenComponent, 
  DEFAULT_GLOBAL_COMPONENTS, 
  PRESET_ICONS, 
  getGlobalChecklistComponents, 
  saveGlobalChecklistComponents, 
  getMenuItemChecklistMap, 
  saveMenuItemChecklist 
} from '@/lib/kitchen-checklist-config';
import { Plus, Trash2, RotateCcw, CheckCircle2, UtensilsCrossed } from 'lucide-react';

interface Props {
  menuItems?: { id: string; name: string }[];
}

export function KitchenChecklistCustomizer({ menuItems = [] }: Props) {
  // Global defaults
  const [globalComponents, setGlobalComponents] = useState<KitchenComponent[]>([]);
  const [newIcon, setNewIcon] = useState('🍚');
  const [newLabel, setNewLabel] = useState('');

  // Per menu item customization
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('');
  const [menuItemMap, setMenuItemMap] = useState<Record<string, KitchenComponent[]>>({});
  const [customDishIcon, setCustomDishIcon] = useState('🍗');
  const [customDishLabel, setCustomDishLabel] = useState('');

  useEffect(() => {
    setGlobalComponents(getGlobalChecklistComponents());
    setMenuItemMap(getMenuItemChecklistMap());
  }, []);

  // Handlers for Global Checklist
  const handleAddGlobalComponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast.error('Sila masukkan nama komponen');
      return;
    }
    const newComp: KitchenComponent = {
      key: `comp_${Date.now()}`,
      icon: newIcon,
      label: newLabel.trim()
    };
    const updated = [...globalComponents, newComp];
    setGlobalComponents(updated);
    saveGlobalChecklistComponents(updated);
    setNewLabel('');
    toast.success(`Komponen "${newComp.label}" ditambah ke senarai semak am dapur!`);
  };

  const handleRemoveGlobalComponent = (key: string) => {
    const updated = globalComponents.filter(c => c.key !== key);
    setGlobalComponents(updated);
    saveGlobalChecklistComponents(updated);
    toast.info('Komponen dipadamkan.');
  };

  const handleResetGlobal = () => {
    if (confirm('Reset semula senarai semak dapur kepada tetapan asal?')) {
      setGlobalComponents(DEFAULT_GLOBAL_COMPONENTS);
      saveGlobalChecklistComponents(DEFAULT_GLOBAL_COMPONENTS);
      toast.success('Senarai semak dapur dikembalikan kepada asal.');
    }
  };

  // Handlers for Specific Menu Item Checklist
  const currentDishComponents = selectedMenuItemId 
    ? (menuItemMap[selectedMenuItemId] || globalComponents) 
    : [];

  const handleAddDishComponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemId) return;
    if (!customDishLabel.trim()) {
      toast.error('Sila masukkan nama komponen');
      return;
    }
    const newComp: KitchenComponent = {
      key: `custom_${Date.now()}`,
      icon: customDishIcon,
      label: customDishLabel.trim()
    };
    const base = menuItemMap[selectedMenuItemId] || [...globalComponents];
    const updated = [...base, newComp];
    const newMap = { ...menuItemMap, [selectedMenuItemId]: updated };
    setMenuItemMap(newMap);
    saveMenuItemChecklist(selectedMenuItemId, updated);
    setCustomDishLabel('');
    toast.success(`Komponen "${newComp.label}" disimpan untuk menu ini!`);
  };

  const handleRemoveDishComponent = (key: string) => {
    if (!selectedMenuItemId) return;
    const base = menuItemMap[selectedMenuItemId] || [...globalComponents];
    const updated = base.filter(c => c.key !== key);
    const newMap = { ...menuItemMap, [selectedMenuItemId]: updated };
    setMenuItemMap(newMap);
    saveMenuItemChecklist(selectedMenuItemId, updated);
    toast.info('Komponen khusus menu dipadam.');
  };

  const handleResetDishToGlobal = () => {
    if (!selectedMenuItemId) return;
    const newMap = { ...menuItemMap };
    delete newMap[selectedMenuItemId];
    setMenuItemMap(newMap);
    saveMenuItemChecklist(selectedMenuItemId, []);
    toast.success('Menu ini dikembalikan mengikut senarai semak am.');
  };

  const selectedItemName = menuItems.find(m => m.id === selectedMenuItemId)?.name;

  return (
    <Card className="border-slate-800 bg-slate-900 text-white shadow-xl mt-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle className="text-lg font-black flex items-center gap-2 text-emerald-400">
            <UtensilsCrossed className="w-5 h-5 text-emerald-400" />
            <span>🍱 Tetapan Butang Senarai Semak Dapur (Kitchen QC Checklist)</span>
          </CardTitle>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleResetGlobal}
            className="text-xs border-slate-700 bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Tetapan Asal</span>
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Kawal butang-butang semakan (Nasi, Lauk, Sambal, Sup, Ulam) yang mesti ditekan oleh staf dapur semasa membungkus pesanan.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* SECTION 1: GLOBAL DEFAULT CHECKLIST */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
              <span>🌟 Senarai Semak Asas (Global Default untuk Semua Set Makanan)</span>
            </h4>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
              {globalComponents.length} Butang Aktif
            </span>
          </div>

          {/* ACTIVE GLOBAL BUTTONS PREVIEW */}
          <div className="flex flex-wrap gap-2 pt-1">
            {globalComponents.map((comp) => (
              <div 
                key={comp.key} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/40 text-white text-xs font-bold shadow-sm"
              >
                <span>{comp.icon}</span>
                <span>{comp.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveGlobalComponent(comp.key)}
                  className="text-slate-400 hover:text-rose-400 ml-1 p-0.5 rounded transition-colors"
                  title="Padam butang ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* ADD NEW GLOBAL COMPONENT FORM */}
          <form onSubmit={handleAddGlobalComponent} className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
              <span className="text-xs text-slate-400 shrink-0 font-medium">Pilih Ikon:</span>
              <select 
                value={newIcon} 
                onChange={(e) => setNewIcon(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-sm"
              >
                {PRESET_ICONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>

            <Input 
              type="text" 
              placeholder="Contoh: 🥚 Telur Mata / 🧀 Cheese / 🥖 Roti" 
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 min-w-[200px] h-9 text-xs bg-slate-900 border-slate-700 text-white"
            />

            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Tambah Butang</span>
            </Button>
          </form>
        </div>

        {/* SECTION 2: PER-MENU ITEM SPECIFIC CUSTOMIZATION */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
              <span>🎯 Butang Khas Mengikut Menu Makanan Tertentu</span>
            </h4>
            {selectedMenuItemId && menuItemMap[selectedMenuItemId] && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetDishToGlobal}
                className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 h-7 px-2"
              >
                Kembalikan Menu Ini ke Asas
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Contoh: Jika <em>Roti Canai</em> hanya perlukan <strong>[Roti, Kari Dhal, Sambal]</strong> dan tidak perlukan Ulam/Nasi.
          </p>

          {/* SELECT MENU DROPDOWN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Pilih Menu untuk Disesuaikan:</label>
            <select
              value={selectedMenuItemId}
              onChange={(e) => setSelectedMenuItemId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-xs font-bold"
            >
              <option value="">-- Pilih Menu (cth: Nasi Lalapan / Roti Canai / Burger) --</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} {menuItemMap[item.id] ? '✨ (Ada Butang Khas)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedMenuItemId && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-400">
                  Butang Semakan Untuk: <span className="text-white underline">{selectedItemName}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentDishComponents.length} komponen
                </span>
              </div>

              {/* DISH BUTTONS PREVIEW */}
              <div className="flex flex-wrap gap-2">
                {currentDishComponents.map((comp) => (
                  <div 
                    key={comp.key} 
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/50 text-white text-xs font-bold shadow-sm"
                  >
                    <span>{comp.icon}</span>
                    <span>{comp.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDishComponent(comp.key)}
                      className="text-slate-400 hover:text-rose-400 ml-1 p-0.5 rounded transition-colors"
                      title="Padam butang untuk menu ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ADD COMPONENT TO SELECTED MENU */}
              <form onSubmit={handleAddDishComponent} className="pt-2 flex items-center gap-2 flex-wrap">
                <select 
                  value={customDishIcon} 
                  onChange={(e) => setCustomDishIcon(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-sm"
                >
                  {PRESET_ICONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>

                <Input 
                  type="text" 
                  placeholder={`Contoh: 🥣 Kari Dhal / 🥜 Kuah Kacang / 🥟 Dumpling`} 
                  value={customDishLabel}
                  onChange={(e) => setCustomDishLabel(e.target.value)}
                  className="flex-1 min-w-[200px] h-9 text-xs bg-slate-900 border-slate-700 text-white"
                />

                <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pada Menu Ini</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

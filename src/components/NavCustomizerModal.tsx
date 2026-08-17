import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, SlidersHorizontal, RotateCcw, X } from 'lucide-react';
import { 
  getNavOrderConfig, 
  saveNavOrderConfig, 
  resetNavOrderConfig, 
  NavItemConfig 
} from '@/lib/addons-config';
import { toast } from 'sonner';

interface NavCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavCustomizerModal({ isOpen, onClose }: NavCustomizerModalProps) {
  const [navItems, setNavItems] = useState<NavItemConfig[]>(getNavOrderConfig());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNavItems(getNavOrderConfig());
    }
  }, [isOpen]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...navItems];
    const movedItem = updated[draggedIdx];
    if (!movedItem) return;

    updated.splice(draggedIdx, 1);
    updated.splice(dropIdx, 0, movedItem);

    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success(`Reordered "${movedItem.label}" to position ${dropIdx + 1}!`);

    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= navItems.length) return;
    const currentItem = navItems[index];
    const targetItem = navItems[targetIdx];
    if (!currentItem || !targetItem) return;

    const updated = [...navItems];
    updated[index] = targetItem;
    updated[targetIdx] = currentItem;

    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success(`Moved ${currentItem.label} ${direction === 'up' ? 'left' : 'right'}!`);
  };

  const handleToggleVisibility = (id: string) => {
    const updated = navItems.map(item => item.id === id ? { ...item, visible: !item.visible } : item);
    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success("Tab visibility updated.");
  };

  const handleReset = () => {
    resetNavOrderConfig();
    setNavItems(getNavOrderConfig());
    setDraggedIdx(null);
    setDragOverIdx(null);
    toast.info("Header navigation reset to default order.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-white p-6 rounded-2xl shadow-2xl font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
              <span>🎛️ Rearrange Header Navigation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-mono mt-0.5">
              Drag & drop tabs below to reorder your top navigation bar.
            </DialogDescription>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            className="text-slate-400 hover:text-white font-mono text-xs gap-1 border border-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </DialogHeader>

        {/* LIVE HEADER PREVIEW BAR inside Modal */}
        <div className="space-y-2 py-2">
          <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">Live Preview (Drag items directly here):</span>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-slate-800 font-black text-emerald-400 text-xs select-none">
              <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded-full" />
              <span>Warung J&J</span>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map((item, idx) => {
                if (!item.visible) return null;
                const isBeingDragged = draggedIdx === idx;
                const isTargetSlot = dragOverIdx === idx;

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                    className={`bg-slate-900 border px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${
                      isBeingDragged 
                        ? 'opacity-40 border-amber-400 scale-95' 
                        : (isTargetSlot ? 'border-2 border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-500/50' : 'border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800')
                    }`}
                  >
                    <GripVertical className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FULL ITEMS REORDER LIST WITH TOUCH DRAG HANDLES */}
        <div className="space-y-2 font-mono text-xs max-h-80 overflow-y-auto pr-1">
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {navItems.map((item, idx) => {
              const isBeingDragged = draggedIdx === idx;
              const isTargetSlot = dragOverIdx === idx;

              return (
                <div 
                  key={item.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                  className={`p-2.5 flex items-center justify-between transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                    isBeingDragged 
                      ? 'opacity-40 bg-amber-500/10 border-amber-400' 
                      : (isTargetSlot ? 'bg-emerald-950/60 border-y-2 border-emerald-400' : 'hover:bg-slate-900/70')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-500 hover:text-white shrink-0 cursor-grab" />
                    <Switch
                      checked={item.visible}
                      onCheckedChange={() => handleToggleVisibility(item.id)}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.emoji}</span>
                      <span className={`font-bold text-sm ${item.visible ? 'text-white' : 'text-slate-500 line-through'}`}>
                        {item.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }}
                      className="h-7 w-7 p-0 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-800"
                      title="Move Left"
                    >
                      ⬅️
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === navItems.length - 1}
                      onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }}
                      className="h-7 w-7 p-0 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-800"
                      title="Move Right"
                    >
                      ➡️
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-6">
            Done & Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  // Desktop HTML5 Drag Handlers
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
    reorderItem(draggedIdx, dropIdx);
  };

  // Tablet & Mobile Touch Event Handlers
  const handleTouchStart = (index: number) => {
    setDraggedIdx(index);
    setDragOverIdx(index);
  };

  const handleTouchMove = (e: React.TouchEvent, attrName: string) => {
    if (draggedIdx === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    // Find the element under the finger
    const elemUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!elemUnderFinger) return;

    const container = elemUnderFinger.closest(`[${attrName}]`);
    if (container) {
      const targetIdxStr = container.getAttribute(attrName);
      if (targetIdxStr !== null) {
        const targetIdx = parseInt(targetIdxStr, 10);
        if (!isNaN(targetIdx) && targetIdx !== dragOverIdx) {
          setDragOverIdx(targetIdx);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (draggedIdx !== null && dragOverIdx !== null) {
      reorderItem(draggedIdx, dragOverIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const reorderItem = (sourceIdx: number | null, dropIdx: number | null) => {
    if (sourceIdx === null || dropIdx === null || sourceIdx === dropIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...navItems];
    const movedItem = updated[sourceIdx];
    if (!movedItem) return;

    updated.splice(sourceIdx, 1);
    updated.splice(dropIdx, 0, movedItem);

    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success(`Susun semula "${movedItem.label}" ke posisi ${dropIdx + 1}!`);

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
      <DialogContent className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200/90 text-slate-900 rounded-3xl shadow-2xl font-sans">
        {/* PINNED HEADER */}
        <DialogHeader className="shrink-0 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-orange-500" />
              <span>🎛️ Susun Turutan Navigasi Bar</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
              Tarik & susun semula kedudukan tab navigasi atas mengikut keutamaan warung anda.
            </DialogDescription>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-mono text-xs gap-1 border-slate-200 rounded-xl h-8"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </DialogHeader>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* LIVE HEADER PREVIEW BAR inside Modal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-orange-600 uppercase tracking-wider block">
                Pratonton Bar Langsung (Boleh seret terus di sini):
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Tablet / Skrin Lebar
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shadow-inner">
              <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-slate-200 font-black text-slate-900 text-xs select-none">
                <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded-full object-cover border border-orange-400" />
                <span>Warung J&J</span>
              </div>

              <div className="flex items-center gap-1.5 flex-nowrap">
                {navItems.map((item, idx) => {
                  if (!item.visible) return null;
                  const isBeingDragged = draggedIdx === idx;
                  const isTargetSlot = dragOverIdx === idx;

                  return (
                    <div
                      key={item.id}
                      data-preview-idx={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                      onTouchStart={() => handleTouchStart(idx)}
                      onTouchMove={(e) => handleTouchMove(e, 'data-preview-idx')}
                      onTouchEnd={handleTouchEnd}
                      style={{ touchAction: 'none' }}
                      className={`bg-white border px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none transition-all shadow-2xs touch-none ${
                        isBeingDragged 
                          ? 'opacity-80 scale-105 shadow-md border-orange-500 ring-2 ring-orange-400 bg-orange-50 z-10' 
                          : (isTargetSlot 
                              ? 'border-orange-500 bg-orange-100/70 ring-2 ring-orange-400 text-orange-900 font-black' 
                              : 'border-slate-200 text-slate-700 hover:border-orange-300 hover:bg-orange-50/50')
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.emoji}</span>
                      <span className="whitespace-nowrap">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* FULL ITEMS REORDER LIST WITH TOUCH CONTROLS */}
          <div className="space-y-2 font-sans text-xs">
            <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
              {navItems.map((item, idx) => {
                const isBeingDragged = draggedIdx === idx;
                const isTargetSlot = dragOverIdx === idx;

                return (
                  <div 
                    key={item.id} 
                    data-item-idx={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                    onTouchStart={() => handleTouchStart(idx)}
                    onTouchMove={(e) => handleTouchMove(e, 'data-item-idx')}
                    onTouchEnd={handleTouchEnd}
                    className={`p-3 flex items-center justify-between transition-all cursor-grab active:cursor-grabbing select-none ${
                      isBeingDragged 
                        ? 'opacity-80 scale-[1.01] shadow-sm bg-orange-50 border-orange-400 z-10' 
                        : (isTargetSlot ? 'bg-orange-100/60 border-y-2 border-orange-400 text-orange-950 font-bold' : 'hover:bg-slate-50/80')
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        style={{ touchAction: 'none' }}
                        className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-4 h-4 text-slate-400 hover:text-orange-500 shrink-0" />
                      </div>
                      <Switch
                        checked={item.visible}
                        onCheckedChange={() => handleToggleVisibility(item.id)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.emoji}</span>
                        <span className={`font-bold text-sm ${item.visible ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {item.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-orange-600 hover:bg-orange-50 border-slate-200 rounded-xl disabled:opacity-30 active:scale-95"
                        title="Alih ke Kiri"
                      >
                        ⬅️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={idx === navItems.length - 1}
                        onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-orange-600 hover:bg-orange-50 border-slate-200 rounded-xl disabled:opacity-30 active:scale-95"
                        title="Alih ke Kanan"
                      >
                        ➡️
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* STICKY ACTION FOOTER */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 p-4 flex items-center justify-end gap-3">
          <Button 
            variant="outline"
            onClick={onClose}
            className="border-slate-200 hover:bg-white text-slate-700 font-semibold rounded-xl px-5 py-2.5 shadow-xs active:scale-95"
          >
            Tutup
          </Button>
          <Button 
            onClick={onClose} 
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm shadow-orange-500/20 active:scale-95"
          >
            Simpan & Selesai
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

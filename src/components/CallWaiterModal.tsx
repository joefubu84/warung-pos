import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Utensils, Receipt, Droplet, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CallWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  storeId?: string;
}

const SERVICE_OPTIONS = [
  { id: 'waiter', title: 'Panggil Pelayan', icon: Bell, desc: 'Perlukan bantuan pesanan atau pertanyaan' },
  { id: 'bill', title: 'Minta Bil Fizikal', icon: Receipt, desc: 'Sedia untuk bayar secara tunai / kad di meja' },
  { id: 'cutlery', title: 'Tambah Sudu / Garpu / Mangkuk', icon: Utensils, desc: 'Peralatan makan tambahan' },
  { id: 'water', title: 'Tambah Air Kosong', icon: Droplet, desc: 'Air suam / ais untuk meja' }
];

export function CallWaiterModal({ isOpen, onClose, tableNumber, storeId }: CallWaiterModalProps) {
  const [selectedType, setSelectedType] = useState<string>('waiter');
  const [customNote, setCustomNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSendBuzzer = async () => {
    try {
      setIsSending(true);
      const selectedOption = SERVICE_OPTIONS.find(o => o.id === selectedType);
      const requestText = (selectedOption ? selectedOption.title : 'Panggilan Meja') + (customNote.trim() ? (' (' + customNote.trim() + ')') : '');

      // Broadcast real-time message through Supabase Channel
      const buzzerPayload = {
        table_number: tableNumber,
        service_type: selectedType,
        message: requestText,
        timestamp: new Date().toISOString()
      };

      const channel = supabase.channel('warung_table_buzzer');
      await channel.send({
        type: 'broadcast',
        event: 'call_waiter',
        payload: buzzerPayload
      });

      // Also trigger a local event in case multiple tabs are running
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('warung_call_waiter_alert', { detail: buzzerPayload }));
      }

      setSentSuccess(true);
      toast.success('Panggilan telah dihantar ke kaunter meja ' + tableNumber + '!');
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      toast.error('Gagal menghantar panggilan: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-sm rounded-3xl p-5 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
            <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-black">
              🛎️
            </span>
            Panggil Pelayan Meja #{tableNumber}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Pilih jenis bantuan yang anda perlukan. Staf kami akan segera ke meja anda.
          </DialogDescription>
        </DialogHeader>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h4 className="font-extrabold text-slate-900 text-sm">Panggilan Berjaya Dihantar!</h4>
            <p className="text-xs text-slate-500">Pelayan sedang menuju ke Meja #{tableNumber}.</p>
          </div>
        ) : (
          <div className="space-y-3 my-2">
            <div className="space-y-2">
              {SERVICE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedType(opt.id)}
                    className={'w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ' + (
                      isSelected 
                        ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={'w-8 h-8 rounded-xl flex items-center justify-center text-xs ' + (
                        isSelected ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={'block text-xs font-bold ' + (isSelected ? 'text-orange-950' : 'text-slate-800')}>
                          {opt.title}
                        </span>
                        <span className="text-[10px] text-slate-500">{opt.desc}</span>
                      </div>
                    </div>
                    <span className={'w-4 h-4 rounded-full border flex items-center justify-center ' + (
                      isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'
                    )}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <input
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Catatan tambahan (pilihan, cth: Tolong bawa mangkuk cili)"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {!sentSuccess && (
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={onClose} className="border-slate-200 text-slate-700">
              Batal
            </Button>
            <Button
              disabled={isSending}
              onClick={handleSendBuzzer}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black"
            >
              {isSending ? 'Menghantar...' : '🛎️ Hantar Panggilan'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

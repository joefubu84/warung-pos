import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Clock 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReopenRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  closedAt?: string | null;
}

const REOPEN_REASONS = [
  "Customer complaint",
  "Wrong order entered",
  "Missing refund / transaction",
  "System error",
  "Cash discrepancy adjustment",
  "Other"
];

export function ReopenRegisterModal({ isOpen, onClose, onSuccess, closedAt }: ReopenRegisterModalProps) {
  const [reason, setReason] = useState<string>("Customer complaint");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Staff");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: userProfile } = await supabase
          .from('users')
          .select('name, role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (userProfile) {
          setUserRole(userProfile.role);
          if (userProfile.name) setUserName(userProfile.name);
        }
      }
    }
    if (isOpen) {
      checkUser();
    }
  }, [isOpen]);

  const isAuthorized = userRole === 'admin' || userRole === 'cashier';

  const handleReopen = async () => {
    if (!isAuthorized) {
      toast.error("Access Denied: Only Cashier or Admin can reopen the register");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason for reopening");
      return;
    }

    const todayDateStr = new Date().toLocaleDateString('en-CA');

    setIsSubmitting(true);
    try {
      // 1. Same-Day Reopen Enforcement (with fallback to cash_sessions)
      let todayCash: any = null;
      let isFallback = false;

      try {
        const { data: dData, error: fetchErr } = await supabase
          .from('daily_cash')
          .select('*')
          .eq('date', todayDateStr)
          .maybeSingle();

        if (!fetchErr && dData) {
          todayCash = dData;
        }
      } catch (e) {
        console.warn('daily_cash reopen fetch warning:', e);
      }

      if (!todayCash) {
        // Check cash_sessions fallback
        const { data: sData } = await supabase
          .from('cash_sessions')
          .select('*')
          .order('opened_at', { ascending: false })
          .limit(1);

        if (sData && sData.length > 0) {
          const s = sData[0];
          const openedDateStr = new Date(s.opened_at).toLocaleDateString('en-CA');
          if (openedDateStr === todayDateStr) {
            todayCash = s;
            isFallback = true;
          }
        }
      }

      if (!todayCash) {
        // Check localStorage fallback
        if (typeof window !== 'undefined') {
          const localStr = localStorage.getItem(`warung_cash_session_${todayDateStr}`);
          if (localStr) {
            try {
              todayCash = JSON.parse(localStr);
              isFallback = true;
            } catch (e) {}
          }
        }
      }

      if (!todayCash) {
        toast.error("No register session found for today");
        return;
      }

      // 2. Audit Trail Note Format
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newAuditNote = `[REOPENED at ${timestampStr} by ${userName} (${userRole}) - Reason: ${reason}${notes ? ` | Notes: ${notes}` : ''}]\n${todayCash.notes || ''}`;

      // 3. Clear closed_at to restore OPEN status
      if (isFallback) {
        try {
          if (todayCash.id && !todayCash.id.startsWith('session_') && !todayCash.id.startsWith('local_')) {
            await supabase
              .from('cash_sessions')
              .update({
                closed_at: null,
                closing_balance: null
              })
              .eq('id', todayCash.id);
          }
        } catch (e) {
          console.warn('cash_sessions reopen warning:', e);
        }
      } else {
        try {
          const { error: updateErr } = await supabase
            .from('daily_cash')
            .update({
              closed_at: null,
              closing_balance: null,
              expected_closing: null,
              variance: null,
              notes: newAuditNote
            })
            .eq('id', todayCash.id);

          if (updateErr) {
            // If table error, fallback to cash_sessions
            if (updateErr.code === 'PGRST205' || updateErr.message?.includes('daily_cash')) {
              await supabase
                .from('cash_sessions')
                .update({
                  closed_at: null,
                  closing_balance: null
                })
                .eq('id', todayCash.id);
            }
          }
        } catch (e) {
          console.warn('daily_cash reopen warning:', e);
        }
      }

      // 4. Update localStorage copy
      if (typeof window !== 'undefined') {
        const localStr = localStorage.getItem(`warung_cash_session_${todayDateStr}`);
        let baseObj = todayCash || {};
        if (localStr) {
          try {
            baseObj = { ...JSON.parse(localStr), ...baseObj };
          } catch (e) {}
        }
        baseObj.closed_at = null;
        baseObj.closing_balance = null;
        baseObj.expected_closing = null;
        baseObj.variance = null;
        baseObj.notes = newAuditNote;
        localStorage.setItem(`warung_cash_session_${todayDateStr}`, JSON.stringify(baseObj));
      }

      toast.success("Cash register reopened! Remember to re-close after making corrections.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen register");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-slate-900 border-slate-200/90 max-w-lg rounded-3xl p-6 shadow-2xl font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Unlock className="w-5 h-5 text-amber-600" /> Buka Semula Sesi Daftar Wang?
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Akses kecemasan: Membuka semula daftar tunai untuk menyunting atau membetulkan transaksi hari ini.
          </DialogDescription>
        </DialogHeader>

        {/* ROLE PERMISSION CHECK */}
        {!isAuthorized ? (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
            <h3 className="text-lg font-black text-rose-950">Akses Dikunci — Sila Hubungi Pengurus</h3>
            <p className="text-xs text-rose-700">
              Peranan anda (<span className="font-bold uppercase">{userRole || 'Staff'}</span>) tidak dibenarkan membuka semula sesi yang telah ditutup. Sila minta Admin atau Juruwang membuka kunci ini.
            </p>
            <Button onClick={onClose} variant="outline" className="border-slate-200 text-slate-700 mt-2 rounded-xl">
              Tutup
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            
            {/* WARNING ALERT BANNER */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> ⚠️ PERINGATAN INTEGRITI POS
              </div>
              <p className="text-amber-800">
                Tindakan ini akan membuka semula kaunter dan pesanan merentasi semua tablet. Anda <strong>WAJIB</strong> menutup semula daftar tunai selepas pembetulan selesai untuk tujuan rekod audit.
              </p>
            </div>

            {/* STATUS INFO */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Status Semasa:</span>
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">DITUTUP (CLOSED)</span>
              </div>
              {closedAt && (
                <div className="flex justify-between text-slate-500">
                  <span>Waktu Ditutup:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Staf Diberi Kuasa:</span>
                <span className="font-bold text-emerald-700">{userName} ({userRole?.toUpperCase()})</span>
              </div>
            </div>

            {/* REASON DROPDOWN */}
            <div>
              <label className="text-slate-700 uppercase font-bold block mb-1 text-[11px]">
                Sebab Buka Semula * (Wajib)
              </label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900 font-bold rounded-xl h-10 shadow-2xs">
                  <SelectValue placeholder="Pilih sebab..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 font-bold rounded-xl shadow-xl">
                  {REOPEN_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OPTIONAL NOTES */}
            <div>
              <label className="text-slate-700 uppercase font-bold block mb-1 text-[11px]">
                Catatan Tambahan Audit (Pilihan)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Butiran mengenai pembetulan atau permintaan pelanggan..."
                className="bg-white border-slate-200 text-slate-900 text-xs rounded-xl shadow-2xs"
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={onClose} className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl">
                Batal
              </Button>
              <Button onClick={handleReopen} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-sm shadow-amber-600/20">
                {isSubmitting ? 'Membuka Semula...' : 'Ya, Buka Semula Daftar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

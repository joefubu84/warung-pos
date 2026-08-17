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
      // 1. Same-Day Reopen Enforcement
      const { data: todayCash, error: fetchErr } = await supabase
        .from('daily_cash')
        .select('*')
        .eq('date', todayDateStr)
        .maybeSingle();

      if (fetchErr || !todayCash) {
        toast.error("No register session found for today");
        return;
      }

      if (todayCash.date !== todayDateStr) {
        toast.error("Security Rule: You can only reopen TODAY'S cash register session.");
        return;
      }

      // 2. Audit Trail Note Format
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newAuditNote = `[REOPENED at ${timestampStr} by ${userName} (${userRole}) - Reason: ${reason}${notes ? ` | Notes: ${notes}` : ''}]\n${todayCash.notes || ''}`;

      // 3. Clear closed_at on daily_cash to restore OPEN status
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

      if (updateErr) throw updateErr;

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
      <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-400">
            <Unlock className="w-5 h-5" /> Reopen Register for Corrections?
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Emergency override: Unlock the register to edit or delete today's transactions.
          </DialogDescription>
        </DialogHeader>

        {/* ROLE PERMISSION CHECK */}
        {!isAuthorized ? (
          <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-xl text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-rose-300">Reopen Locked — Contact Manager</h3>
            <p className="text-xs text-slate-400">
              Your role (<span className="font-bold text-white uppercase">{userRole || 'Staff'}</span>) is not authorized to reopen closed shifts. Please ask an Admin or Cashier to authorize this action.
            </p>
            <Button onClick={onClose} variant="outline" className="border-slate-700 text-slate-300 mt-2">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2 font-mono text-xs">
            
            {/* WARNING ALERT BANNER */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-400">
                <AlertTriangle className="w-4 h-4" /> ⚠️ WARNING
              </div>
              <p>
                This will unlock the counter and order management across all devices. You <strong>MUST</strong> re-close the register after making your corrections to ensure audit compliance.
              </p>
            </div>

            {/* STATUS INFO */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Current Status:</span>
                <span className="font-bold text-rose-400">CLOSED</span>
              </div>
              {closedAt && (
                <div className="flex justify-between text-slate-400">
                  <span>Closed At:</span>
                  <span className="font-bold text-white">
                    {new Date(closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Authorized Staff:</span>
                <span className="font-bold text-emerald-400">{userName} ({userRole?.toUpperCase()})</span>
              </div>
            </div>

            {/* REASON DROPDOWN */}
            <div>
              <label className="text-slate-400 uppercase font-bold block mb-1 text-[11px]">
                Reason for Reopen * (Required)
              </label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white font-bold">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white font-bold">
                  {REOPEN_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OPTIONAL NOTES */}
            <div>
              <label className="text-slate-400 uppercase font-bold block mb-1 text-[11px]">
                Additional Audit Notes (Optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details about customer request or error correction..."
                className="bg-slate-950 border-slate-800 text-white text-xs"
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
                No, Cancel
              </Button>
              <Button onClick={handleReopen} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
                {isSubmitting ? 'Reopening...' : 'Yes, Reopen Register'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

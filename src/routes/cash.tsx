import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { requireStaffAuth } from '@/lib/auth-guard';

export const Route = createFileRoute('/cash')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: CashPage,
});

function CashPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastVariance, setLastVariance] = useState<number | null>(null);

  async function checkSession() {
    setLoading(true);
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .is('closed_at', null)
      .maybeSingle();
    
    setSession(data);
    setLoading(false);
  }

  useEffect(() => {
    checkSession();
  }, []);

  const handleOpenSession = async () => {
    if (session) {
      toast.error("A session is already open");
      return;
    }

    const amount = prompt("Opening Balance (number):");
    if (amount === null) return;
    
    const openingBalance = parseFloat(amount);
    if (isNaN(openingBalance)) {
      toast.error("Please enter a valid number");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', user.id)
        .single();
      
      if (!profile) throw new Error("Store profile not found");

      const { error } = await supabase
        .from('cash_sessions')
        .insert({
          store_id: profile.store_id,
          staff_id: user.id,
          opening_balance: openingBalance,
          opened_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success("Session opened successfully");
      setLastVariance(null);
      await checkSession();
    } catch (error: any) {
      toast.error(error.message || "Failed to open session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;

    const amount = prompt("Closing Balance (number):");
    if (amount === null) return;
    
    const closingBalance = parseFloat(amount);
    if (isNaN(closingBalance)) {
      toast.error("Please enter a valid number");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closing_balance: closingBalance
        })
        .eq('id', session.id);

      if (error) throw error;
      
      const variance = closingBalance - session.opening_balance;
      setLastVariance(variance);
      toast.success("Session closed successfully");
      await checkSession();
    } catch (error: any) {
      toast.error(error.message || "Failed to close session");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {session ? (
        <div className="flex items-center gap-4">
          <p>Session open since {new Date(session.opened_at).toLocaleString()}, opening balance: RM{session.opening_balance}</p>
          <button 
            onClick={handleCloseSession}
            disabled={isSubmitting}
            className="border p-2 disabled:opacity-50 text-red-600 border-red-600"
          >
            {isSubmitting ? "Closing..." : "Close Session"}
          </button>
        </div>
      ) : (
        <>
          <p>No active session</p>
          {lastVariance !== null && (
            <p className="mt-2 font-bold">Variance: RM{lastVariance.toFixed(2)}</p>
          )}
          <button 
            onClick={handleOpenSession}
            disabled={isSubmitting}
            className="border p-2 mt-2 disabled:opacity-50"
          >
            {isSubmitting ? "Opening..." : "Open Session"}
          </button>
        </>
      )}
    </div>
  );
}

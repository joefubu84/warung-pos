import { supabase } from '@/integrations/supabase/client';

export type CashStatus = 'NOT_OPENED' | 'OPEN' | 'CLOSED';

export interface DailyCashStatusResult {
  status: CashStatus;
  dailyCash: any | null;
  closedAt: string | null;
}

export async function getTodayCashStatus(storeId?: string | null): Promise<DailyCashStatusResult> {
  const todayDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  try {
    // 1. Try querying daily_cash
    const { data, error } = await supabase
      .from('daily_cash')
      .select('*')
      .eq('date', todayDateStr)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const latestRecord = data[0];
      if (latestRecord.closed_at) {
        return {
          status: 'CLOSED',
          dailyCash: latestRecord,
          closedAt: latestRecord.closed_at,
        };
      }
      return {
        status: 'OPEN',
        dailyCash: latestRecord,
        closedAt: null,
      };
    }

    // 2. Fallback to cash_sessions table (which exists in Supabase)
    const { data: sessionData, error: sessionErr } = await supabase
      .from('cash_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!sessionErr && sessionData && sessionData.length > 0) {
      const latestSession = sessionData[0];
      const openedDateStr = new Date(latestSession.opened_at).toLocaleDateString('en-CA');
      if (openedDateStr === todayDateStr) {
        if (latestSession.closed_at) {
          return {
            status: 'CLOSED',
            dailyCash: latestSession,
            closedAt: latestSession.closed_at,
          };
        }
        return {
          status: 'OPEN',
          dailyCash: latestSession,
          closedAt: null,
        };
      }
    }

    // 3. Emergency client-side resilience fallback
    if (typeof window !== 'undefined') {
      const localStr = localStorage.getItem(`warung_cash_session_${todayDateStr}`);
      if (localStr) {
        try {
          const localSession = JSON.parse(localStr);
          if (localSession.closed_at) {
            return {
              status: 'CLOSED',
              dailyCash: localSession,
              closedAt: localSession.closed_at,
            };
          }
          return {
            status: 'OPEN',
            dailyCash: localSession,
            closedAt: null,
          };
        } catch (e) {
          console.warn('Local cash session parse warning:', e);
        }
      }
    }

    return {
      status: 'NOT_OPENED',
      dailyCash: null,
      closedAt: null,
    };
  } catch (err) {
    console.warn('Error checking daily cash status:', err);

    if (typeof window !== 'undefined') {
      const localStr = localStorage.getItem(`warung_cash_session_${todayDateStr}`);
      if (localStr) {
        try {
          const localSession = JSON.parse(localStr);
          return {
            status: localSession.closed_at ? 'CLOSED' : 'OPEN',
            dailyCash: localSession,
            closedAt: localSession.closed_at || null,
          };
        } catch (e) {
          // ignore
        }
      }
    }

    return {
      status: 'NOT_OPENED',
      dailyCash: null,
      closedAt: null,
    };
  }
}

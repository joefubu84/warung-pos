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
    // Query today's daily_cash session by exact YYYY-MM-DD date
    const { data, error } = await supabase
      .from('daily_cash')
      .select('*')
      .eq('date', todayDateStr)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        status: 'NOT_OPENED',
        dailyCash: null,
        closedAt: null,
      };
    }

    const latestRecord = data?.[0];

    if (!latestRecord) {
      return {
        status: 'NOT_OPENED',
        dailyCash: null,
        closedAt: null,
      };
    }

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
  } catch (err) {
    console.error('Error checking daily cash status:', err);
    return {
      status: 'NOT_OPENED',
      dailyCash: null,
      closedAt: null,
    };
  }
}

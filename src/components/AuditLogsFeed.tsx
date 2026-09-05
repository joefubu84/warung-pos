import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, 
  User, 
  Clock, 
  Pencil, 
  Trash2, 
  Broom, 
  FileText, 
  RefreshCw, 
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuditLogItem {
  id: string;
  daily_cash_id?: string | null;
  edited_by?: string | null;
  edited_by_name?: string | null;
  previous_values?: any;
  new_values?: any;
  change_reason?: string | null;
  edited_at?: string | null;
}

export function AuditLogsFeed() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_cash_edit_logs')
        .select('*')
        .order('edited_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error loading audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-5 font-sans shadow-xs">
      <div className="flex justify-between items-center border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" /> Expense & Storage Action Audit Trail
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Immutable system logs tracking staff edits, expense deletions, and storage cleanups.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9 font-bold rounded-xl shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Logs
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> Loading audit history...
        </div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-mono">
          No audit actions recorded yet.
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {logs.map((log) => {
            const isEdit = log.change_reason?.toLowerCase().includes('edit');
            const isDelete = log.change_reason?.toLowerCase().includes('delete');
            const isCleanup = log.change_reason?.toLowerCase().includes('clean') || log.change_reason?.toLowerCase().includes('purge');

            return (
              <div 
                key={log.id} 
                className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 shadow-2xs ${
                    isEdit ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    isDelete ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    isCleanup ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {isEdit ? <Pencil className="w-4 h-4" /> :
                     isDelete ? <Trash2 className="w-4 h-4" /> :
                     isCleanup ? <Broom className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <span>{log.change_reason || 'System Action'}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-4 mt-1 font-mono">
                      <span className="flex items-center gap-1 font-bold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {log.edited_by_name || 'System Staff'}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {new Date(log.edited_at || Date.now()).toLocaleString('en-GB')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

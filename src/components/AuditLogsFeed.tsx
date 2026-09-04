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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" /> Expense & Storage Action Audit Trail
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Immutable system logs tracking staff edits, expense deletions, and storage cleanups.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Logs
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Loading audit history...
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs font-mono">
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
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isEdit ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    isDelete ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    isCleanup ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {isEdit ? <Pencil className="w-4 h-4" /> :
                     isDelete ? <Trash2 className="w-4 h-4" /> :
                     isCleanup ? <Broom className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{log.change_reason || 'System Action'}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" /> {log.edited_by_name || 'System Staff'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> {new Date(log.edited_at || Date.now()).toLocaleString('en-GB')}
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

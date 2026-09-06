import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireAdminAuth } from '@/lib/auth-guard';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  ShieldCheck, 
  History, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  FileText,
  DollarSign,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { getSecurityLogs, SecurityLogEvent } from '@/lib/table-sessions';

export const Route = createFileRoute('/settings_/audit-log')({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    return await requireAdminAuth(location, context.auth);
  },
  component: AuditLogPage,
});

function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'cash' | 'security'>('orders');
  const [searchQuery, setSearchQuery] = useState('');

  // Order edit logs query
  const { data: orderLogs, isLoading: isOrderLoading, refetch: refetchOrderLogs } = useQuery({
    queryKey: ['order_edit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_edit_logs')
        .select(`
          *,
          users!order_edit_logs_edited_by_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000
  });

  // Daily cash / expense edit logs query
  const { data: cashLogs, isLoading: isCashLoading, refetch: refetchCashLogs } = useQuery({
    queryKey: ['daily_cash_edit_logs'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_cash_edit_logs')
          .select('*')
          .order('edited_at', { ascending: false })
          .limit(100);

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('daily_cash_edit_logs')) {
            return [];
          }
          throw error;
        }
        return data || [];
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.message?.includes('schema cache') || err?.message?.includes('daily_cash_edit_logs')) {
          return [];
        }
        throw err;
      }
    },
    refetchInterval: 30000
  });

  // Security & threat logs query
  const securityLogs: SecurityLogEvent[] = getSecurityLogs();

  // Calculate Metrics for Order Logs
  const todayStr = new Date().toDateString();
  const dailyEdits = (orderLogs || []).filter(log => new Date(log.created_at || '').toDateString() === todayStr).length;

  const pastWeek = new Date();
  pastWeek.setDate(pastWeek.getDate() - 7);
  const weeklyEdits = (orderLogs || []).filter(log => new Date(log.created_at || '') >= pastWeek).length;

  const reasonCounts: Record<string, number> = {};
  (orderLogs || []).forEach(log => {
    if (log.reason) {
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
    }
  });

  let topReason = 'None';
  let maxCount = 0;
  Object.entries(reasonCounts).forEach(([r, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topReason = r;
    }
  });

  // Filtered order logs
  const filteredOrderLogs = (orderLogs || []).filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const staffName = log.users?.name?.toLowerCase() || '';
    const orderId = log.order_id?.toLowerCase() || '';
    const reason = log.reason?.toLowerCase() || '';
    const action = log.action?.toLowerCase() || '';
    return staffName.includes(q) || orderId.includes(q) || reason.includes(q) || action.includes(q);
  });

  // Filtered cash logs
  const filteredCashLogs = (cashLogs || []).filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const staffName = log.edited_by_name?.toLowerCase() || '';
    const reason = log.change_reason?.toLowerCase() || '';
    return staffName.includes(q) || reason.includes(q);
  });

  // Filtered security logs
  const filteredSecurityLogs = securityLogs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return log.type.toLowerCase().includes(q) || log.details.toLowerCase().includes(q) || log.device_id.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 p-5 rounded-3xl shadow-xs">
          <div className="flex items-center gap-4">
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-2xl h-11 w-11">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">System Audit Log & Security Stream</h1>
                <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> AUDIT ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Immutable security trail for order modifications, register edits, rate-limiting, and threat monitoring.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchOrderLogs();
              refetchCashLogs();
            }}
            className="bg-white border-slate-200 text-emerald-700 hover:bg-slate-50 text-xs font-bold rounded-xl h-10 gap-2 shrink-0 shadow-xs"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Audit Stream
          </Button>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white border-slate-200/90 text-slate-900 shadow-xs rounded-3xl p-5">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Edits Today</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-3xl font-black text-emerald-600">{dailyEdits}</p>
              <span className="text-[10px] text-slate-400 font-sans">Recorded in last 24 hours</span>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/90 text-slate-900 shadow-xs rounded-3xl p-5">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Edits This Week</span>
                <History className="w-4 h-4 text-amber-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-3xl font-black text-amber-600">{weeklyEdits}</p>
              <span className="text-[10px] text-slate-400 font-sans">Past 7 days audit trail</span>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/90 text-slate-900 shadow-xs rounded-3xl p-5">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Security Threats Blocked</span>
                <ShieldAlert className="w-4 h-4 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-3xl font-black text-purple-600">{securityLogs.length}</p>
              <span className="text-[10px] text-slate-400 font-sans">Rate-limits & hijack blocks</span>
            </CardContent>
          </Card>
        </div>

        {/* LOG CATEGORY TABS & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-3xl p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Order Edits ({filteredOrderLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('cash')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'cash'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Cash & Register Edits ({filteredCashLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'security'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Security & Threat Stream ({filteredSecurityLogs.length})
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="bg-slate-50 border-slate-200 pl-10 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl h-10 focus:border-amber-500 focus:bg-white"
            />
          </div>
        </div>

        {/* MAIN AUDIT TABLE CARD */}
        <Card className="bg-white border-slate-200/90 text-slate-900 shadow-xs rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-5 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              <span>
                {activeTab === 'orders' ? 'Order Activity Logs (Top 100)' : activeTab === 'cash' ? 'Register & Cash Session Audit Trail' : 'Real-time Security Threat & Protection Stream'}
              </span>
            </CardTitle>
            <span className="text-xs bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-slate-600 font-mono">
              Live Realtime Feed
            </span>
          </CardHeader>

          <CardContent className="p-0">
            {activeTab === 'orders' ? (
              isOrderLoading ? (
                <p className="text-center text-slate-400 py-12 text-xs">Loading audit logs...</p>
              ) : filteredOrderLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-mono">
                        <th className="p-3.5">Time</th>
                        <th className="p-3.5">Action</th>
                        <th className="p-3.5">Order ID</th>
                        <th className="p-3.5">Staff</th>
                        <th className="p-3.5">Reason</th>
                        <th className="p-3.5 text-right">Before</th>
                        <th className="p-3.5 text-right">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrderLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors font-mono">
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at || '').toLocaleString('en-MY', {
                              dateStyle: 'short',
                              timeStyle: 'medium'
                            })}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              log.action === 'CANCELLED' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            #{log.order_id?.slice(0, 8)}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            {log.users?.name || log.edited_by || 'Staff'}
                          </td>
                          <td className="p-3.5 text-slate-500 max-w-xs truncate" title={log.reason || '-'}>
                            {log.reason || '-'}
                          </td>
                          <td className="p-3.5 text-right text-slate-500">
                            {log.before_total != null ? `RM ${Number(log.before_total).toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-600">
                            {log.after_total != null ? `RM ${Number(log.after_total).toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-400 py-12 text-xs">No order audit logs found matching filter.</p>
              )
            ) : activeTab === 'cash' ? (
              isCashLoading ? (
                <p className="text-center text-slate-400 py-12 text-xs">Loading cash logs...</p>
              ) : filteredCashLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-mono">
                        <th className="p-3.5">Time</th>
                        <th className="p-3.5">Edited By</th>
                        <th className="p-3.5">Reason</th>
                        <th className="p-3.5">Previous Values</th>
                        <th className="p-3.5">New Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredCashLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.edited_at || '').toLocaleString('en-MY', {
                              dateStyle: 'short',
                              timeStyle: 'medium'
                            })}
                          </td>
                          <td className="p-3.5 text-amber-700 font-bold">
                            {log.edited_by_name || 'Admin'}
                          </td>
                          <td className="p-3.5 text-slate-700 max-w-xs truncate" title={log.change_reason || undefined}>
                            {log.change_reason || '-'}
                          </td>
                          <td className="p-3.5 text-slate-500 max-w-xs text-[11px] truncate">
                            {typeof log.previous_values === 'object' ? JSON.stringify(log.previous_values) : log.previous_values || '-'}
                          </td>
                          <td className="p-3.5 text-emerald-700 max-w-xs text-[11px] truncate font-bold">
                            {typeof log.new_values === 'object' ? JSON.stringify(log.new_values) : log.new_values || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-400 py-12 text-xs">No cash edit audit logs found matching filter.</p>
              )
            ) : (
              /* SECURITY & THREAT AUDIT TAB */
              filteredSecurityLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-mono">
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5">Event Type</th>
                        <th className="p-3.5">Device ID</th>
                        <th className="p-3.5">Table</th>
                        <th className="p-3.5">Security Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredSecurityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-MY', {
                              dateStyle: 'short',
                              timeStyle: 'medium'
                            })}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              log.type === 'RATE_LIMIT_EXCEEDED' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : log.type === 'PRICE_MISMATCH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 font-bold">
                            {log.device_id.slice(0, 14)}...
                          </td>
                          <td className="p-3.5 text-amber-700 font-bold">
                            {log.table_id ? `#${log.table_id}` : '-'}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto animate-pulse" />
                  <p className="text-sm font-bold text-slate-900">No Threat Alerts Recorded</p>
                  <p className="text-xs text-slate-500 font-mono">Your rate limiting, HMAC signed tokens, and RLS policies are actively protecting the server.</p>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

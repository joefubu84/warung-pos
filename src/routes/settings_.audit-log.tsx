import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireAdminAuth } from '@/lib/auth-guard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Filter } from 'lucide-react';

export const Route = createFileRoute('/settings_/audit-log')({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    return await requireAdminAuth(location, context.auth);
  },
  component: AuditLogPage,
});

function AuditLogPage() {
  const { data: logs, isLoading } = useQuery({
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
      return data;
    },
    refetchInterval: 30000 // Refetch every 30s
  });

  const dailyEdits = logs?.filter(log => {
    const today = new Date();
    const logDate = new Date(log.created_at || '');
    return logDate.toDateString() === today.toDateString();
  }).length || 0;

  const weeklyEdits = logs?.filter(log => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const logDate = new Date(log.created_at || '');
    return logDate >= lastWeek;
  }).length || 0;

  const getReasonCounts = () => {
    if (!logs) return {};
    return logs.reduce((acc: any, log) => {
      acc[log.reason] = (acc[log.reason] || 0) + 1;
      return acc;
    }, {});
  };

  const reasonCounts = getReasonCounts();
  const topReason = Object.keys(reasonCounts).sort((a, b) => reasonCounts[b] - reasonCounts[a])[0] || 'N/A';

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/settings">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Audit Log & Reports</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Edits Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dailyEdits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Edits This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{weeklyEdits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Most Common Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate" title={topReason}>{topReason}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity (Top 100)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Loading audit logs...</p>
          ) : logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="p-3">Time</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Staff</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Value Impact</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          log.action === 'delete' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {log.order_id?.slice(0, 8)}
                      </td>
                      <td className="p-3">
                        {log.users?.name || log.edited_by?.slice(0, 8)}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold">{log.reason}</span>
                      </td>
                      <td className="p-3">
                        {(log.before_total !== undefined && log.after_total !== undefined) ? (
                          <div className="flex items-center gap-1">
                            <span className="line-through text-gray-400">RM{Number(log.before_total).toFixed(2)}</span>
                            <span>→</span>
                            <span className={log.after_total < log.before_total ? 'text-red-600 font-bold' : 'font-bold'}>
                              RM{Number(log.after_total).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-600 max-w-xs truncate">
                        {log.changes && log.changes.notes ? (
                          <div className="italic text-gray-500 mb-1">"{log.changes.notes}"</div>
                        ) : null}
                        {log.changes && log.changes.items_modified && log.changes.items_modified.length > 0 && (
                          <div className="truncate">Modified: {log.changes.items_modified.join(', ')}</div>
                        )}
                        {log.changes && log.changes.items_added && log.changes.items_added.length > 0 && (
                          <div className="truncate">Added: {log.changes.items_added.join(', ')}</div>
                        )}
                        {log.changes && log.changes.items_deleted && log.changes.items_deleted.length > 0 && (
                          <div className="truncate text-red-500">Deleted: {log.changes.items_deleted.join(', ')}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No audit logs found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

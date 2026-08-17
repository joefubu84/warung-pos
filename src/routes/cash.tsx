import { createFileRoute } from '@tanstack/react-router';
import { requireStaffAuth } from '@/lib/auth-guard';
import { CashManagementPage } from './cash-management';

interface CashSearch {
  reason?: string | undefined;
}

export const Route = createFileRoute('/cash')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): CashSearch => {
    return {
      reason: search['reason'] ? String(search['reason']) : undefined,
    };
  },
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: CashManagementPage,
});

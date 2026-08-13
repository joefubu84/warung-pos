import { createFileRoute } from '@tanstack/react-router';
import { resetUserPassword } from '@/lib/test-utils.functions';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/reset-test-user')({
  component: ResetTestUserPage,
});

function ResetTestUserPage() {
  const [status, setStatus] = useState<string | null>('Initializing reset...');

  useEffect(() => {
    const performReset = async () => {
      try {
        const result = await resetUserPassword({
          data: {
            email: 'teststaffa@test.com',
            password: 'password123'
          }
        });
        setStatus(`✅ SUCCESS: Password for ${result.email} reset to "password123". You can now login at /auth.`);
      } catch (e: any) {
        setStatus(`❌ ERROR: ${e.message}`);
      }
    };
    performReset();
  }, []);

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Auto-Resetting teststaffa@test.com</h1>
      <div className="p-4 bg-gray-100 rounded border">
        {status}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        This page automatically resets the password to <strong>password123</strong> on load.
      </div>
    </div>
  );
}

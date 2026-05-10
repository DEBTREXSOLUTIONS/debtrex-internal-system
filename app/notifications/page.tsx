import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: notifications } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Mark all as read
  await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="Notifications" />
        <div className="p-6 max-w-3xl mx-auto">
          <div className="card overflow-hidden">
            {notifications && notifications.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {notifications.map(n => (
                  <Link
                    key={n.id}
                    href={n.link || '#'}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-brand-red flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{n.title}</div>
                        {n.message && <div className="text-sm text-gray-600 mt-1">{n.message}</div>}
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Bell size={32} className="mx-auto text-gray-300 mb-3" />
                <h3 className="font-semibold text-gray-700">No notifications yet</h3>
                <p className="text-sm text-gray-500 mt-1">You'll see updates here as things happen.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

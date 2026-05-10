import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import FilesView from './FilesView';

export default async function FilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('google_drive_folder_id, google_refresh_token, full_name')
    .eq('id', user.id)
    .single();

  const isConnected = !!profile?.google_refresh_token;

  // Try to fetch files if connected
  let files: any[] = [];
  let fetchError = '';
  if (isConnected && profile?.google_drive_folder_id) {
    try {
      const { listFolderFiles } = await import('@/lib/google-drive');
      files = await listFolderFiles(user.id, profile.google_drive_folder_id);
    } catch (e: any) {
      fetchError = e.message || 'Could not load files';
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="My Files" />
        <div className="p-6 max-w-7xl mx-auto">
          <FilesView
            user={user}
            isConnected={isConnected}
            files={files}
            folderId={profile?.google_drive_folder_id}
            fetchError={fetchError}
          />
        </div>
      </main>
    </div>
  );
}

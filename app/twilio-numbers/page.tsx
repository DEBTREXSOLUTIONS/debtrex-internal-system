import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import { listTwilioNumbers, isTwilioConfigured } from '@/lib/twilio';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TwilioNumbersManager from './TwilioNumbersManager';

export default async function TwilioNumbersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isLeadership(user.role)) redirect('/');

  // Numbers from Twilio account
  const twilioNumbers = await listTwilioNumbers();

  // All active users
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, phone, twilio_phone_number, twilio_phone_label')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Twilio Numbers" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <TwilioNumbersManager
            twilioConfigured={isTwilioConfigured()}
            twilioNumbers={twilioNumbers}
            users={users || []}
            defaultNumber={process.env.TWILIO_PHONE_NUMBER || ''}
          />
        </div>
      </main>
    </div>
  );
}

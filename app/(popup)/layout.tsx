// Minimal layout for popup windows — no sidebar, no top bar.
// The popup is a control surface for an authenticated session that lives
// in the main window; the main window is what holds the Voice SDK device
// and the WebRTC audio. We still gate the route on auth so a stray popup
// URL can't be opened by an outsider.
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <div className="min-h-screen bg-brand-ink">{children}</div>;
}

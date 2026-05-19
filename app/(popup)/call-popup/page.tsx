import CallPopupClient from '@/components/CallPopupClient';

// `/call-popup` — the URL `window.open()`'d by the main CallWidget when
// the agent clicks Pop Out. Renders a minimal call-control surface and
// communicates with the main window via BroadcastChannel.
export default function CallPopupPage() {
  return <CallPopupClient />;
}

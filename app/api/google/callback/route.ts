import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, ensureUserFolder } from '@/lib/google-drive';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // user id
  const error = url.searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/files?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/files?error=missing_params`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    await supabaseAdmin
      .from('profiles')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      })
      .eq('id', state);

    // Get the user's name and create folder
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', state)
      .single();

    if (profile) {
      try {
        await ensureUserFolder(state, profile.full_name);
      } catch (e) {
        console.error('Folder creation failed:', e);
      }
    }

    return NextResponse.redirect(`${appUrl}/files`);
  } catch (e: any) {
    return NextResponse.redirect(`${appUrl}/files?error=${encodeURIComponent(e.message)}`);
  }
}

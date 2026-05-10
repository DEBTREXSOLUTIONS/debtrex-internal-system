import { google } from 'googleapis';
import { supabaseAdmin } from './supabase';

const oauth2Client = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

export function getAuthUrl(state: string) {
  const client = oauth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = oauth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getDriveClient(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', userId)
    .single();

  if (!profile?.google_refresh_token) {
    throw new Error('Google Drive not connected');
  }

  const client = oauth2Client();
  client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token,
  });

  // Auto-refresh if expired
  if (!profile.google_token_expires_at || new Date(profile.google_token_expires_at) < new Date()) {
    const { credentials } = await client.refreshAccessToken();
    await supabaseAdmin
      .from('profiles')
      .update({
        google_access_token: credentials.access_token,
        google_token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      })
      .eq('id', userId);
    client.setCredentials(credentials);
  }

  return google.drive({ version: 'v3', auth: client });
}

export async function ensureUserFolder(userId: string, fullName: string): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('google_drive_folder_id')
    .eq('id', userId)
    .single();

  if (profile?.google_drive_folder_id) return profile.google_drive_folder_id;

  const drive = await getDriveClient(userId);
  const rootFolder = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  const folder = await drive.files.create({
    requestBody: {
      name: `${fullName} - DEBTREX`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: rootFolder ? [rootFolder] : undefined,
    },
    fields: 'id',
  });

  const folderId = folder.data.id!;
  await supabaseAdmin
    .from('profiles')
    .update({ google_drive_folder_id: folderId })
    .eq('id', userId);

  return folderId;
}

export async function listFolderFiles(userId: string, folderId: string) {
  const drive = await getDriveClient(userId);
  const result = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime, size, iconLink, thumbnailLink)',
    orderBy: 'modifiedTime desc',
  });
  return result.data.files || [];
}

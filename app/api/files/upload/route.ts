import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDriveClient, ensureUserFolder } from '@/lib/google-drive';
import { Readable } from 'stream';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const folderId = await ensureUserFolder(user.id, user.full_name);
    const drive = await getDriveClient(user.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const result = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return NextResponse.json({ file: result.data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

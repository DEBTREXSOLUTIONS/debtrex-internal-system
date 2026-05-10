import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDriveClient } from '@/lib/google-drive';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const drive = await getDriveClient(user.id);
    await drive.files.delete({ fileId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

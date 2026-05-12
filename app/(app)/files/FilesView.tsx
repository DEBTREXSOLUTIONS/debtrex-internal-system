"use client";
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { File, FileText, Image, FileSpreadsheet, FolderOpen, Upload, Eye, Download, Trash2, X, AlertCircle, Cloud } from 'lucide-react';

export default function FilesView({ user, isConnected, files, folderId, fetchError }: any) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isConnected) {
    return (
      <div className="card p-12 text-center">
        <div className="inline-flex p-4 bg-brand-red-pale rounded-full mb-4">
          <Cloud size={32} className="text-brand-red" />
        </div>
        <h2 className="font-condensed text-3xl font-black uppercase mb-2">Connect Google Drive</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Connect your Google account to access your personal DEBTREX folder.
          A folder named "{user.full_name} - DEBTREX" will be auto-created in the master Drive.
        </p>
        <a href="/api/google/auth" className="btn-primary">
          <Cloud size={14} /> Connect Google Drive
        </a>
        <p className="text-xs text-gray-400 mt-4">
          Your files stay in Google Drive — DEBTREX never stores them.
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="card p-8">
        <div className="flex items-center gap-2 text-brand-red mb-3">
          <AlertCircle size={20} />
          <h3 className="font-condensed text-xl font-black uppercase">Connection Issue</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">{fetchError}</p>
        <a href="/api/google/auth" className="btn-primary">
          <Cloud size={14} /> Reconnect Google Drive
        </a>
      </div>
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    router.refresh();
  }

  function getFileIcon(mimeType: string) {
    if (mimeType?.includes('image')) return Image;
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return FileSpreadsheet;
    if (mimeType?.includes('document') || mimeType?.includes('word') || mimeType?.includes('pdf')) return FileText;
    if (mimeType?.includes('folder')) return FolderOpen;
    return File;
  }

  function fmtSize(bytes?: string | number) {
    if (!bytes) return '—';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return (
    <>
      {/* Header */}
      <div className="card p-6 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-condensed text-2xl font-black uppercase flex items-center gap-2">
            <FolderOpen size={20} className="text-brand-red" />
            {user.full_name}'s Folder
          </h2>
          <p className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? 's' : ''} · synced with Google Drive</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload File'}
          </button>
          {folderId && (
            <a
              href={`https://drive.google.com/drive/folders/${folderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              <Cloud size={14} /> Open in Drive
            </a>
          )}
        </div>
      </div>

      {/* Files Grid */}
      {files.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file: any) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div key={file.id} className="card p-4 hover:border-brand-red transition-colors group">
                <div className="aspect-square bg-gray-50 rounded mb-3 flex items-center justify-center overflow-hidden">
                  {file.thumbnailLink ? (
                    <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon size={36} className="text-gray-400" />
                  )}
                </div>
                <div className="text-sm font-semibold truncate" title={file.name}>{file.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {fmtSize(file.size)} · {new Date(file.modifiedTime).toLocaleDateString()}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setViewing(file)}
                    className="flex-1 px-2 py-1 text-xs font-bold uppercase tracking-wider hover:bg-brand-red hover:text-white rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye size={11} /> View
                  </button>
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-2 py-1 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Download size={11} /> Open
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="px-2 py-1 text-xs hover:bg-red-50 text-brand-red rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <FolderOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-700">Your folder is empty</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Upload your first file to get started.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary disabled:opacity-50"
          >
            <Upload size={14} /> Upload File
          </button>
        </div>
      )}

      {/* File Preview Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold truncate">{viewing.name}</h3>
                <p className="text-xs text-gray-500">{fmtSize(viewing.size)}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-brand-red">
                <X size={20} />
              </button>
            </div>
            <iframe
              src={`https://drive.google.com/file/d/${viewing.id}/preview`}
              className="flex-1 w-full"
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </>
  );
}

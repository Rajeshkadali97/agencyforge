'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Loader2 } from 'lucide-react';

export function ArchiveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/websites/${projectId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to archive project. Please try again.');
        setLoading(false);
        return;
      }
      router.push('/websites');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}
      <button
        onClick={handleArchive}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white/40 text-xs font-medium text-neutral-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Archive className="h-3.5 w-3.5" />
        )}
        Archive project
      </button>
    </div>
  );
}

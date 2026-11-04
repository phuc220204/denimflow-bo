import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEvidenceApi, uploadEvidenceApi } from '../../lib/api';
import { i18n } from '../../lib/i18n/dictionary';

// FR-14: reduce image dimensions and quality before sending; PDF remains unchanged.
async function prepare(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Không thể nén ảnh'))),
        'image/jpeg',
        0.8,
      ),
    );
    return blob.size < file.size ? blob : file;
  } finally {
    image.close();
  }
}
export function EvidencePanel({ stepId, token }: { stepId: string; token?: string | null }) {
  const client = useQueryClient();
  const { data = [], error } = useQuery({
    queryKey: ['evidence', stepId],
    queryFn: () => fetchEvidenceApi(stepId, token),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => uploadEvidenceApi(stepId, await prepare(file), token),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['evidence', stepId] });
    },
  });
  const t = i18n.evidence;
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <label className="block">
        {t.upload}
        <input
          aria-label={t.upload}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = '';
          }}
        />
      </label>
      <p>{t.limit}</p>
      {(error || upload.error) && (
        <p role="alert" className="text-danger-text">
          {(error || upload.error)?.message}
        </p>
      )}
      <ul>
        {data.map((e) => (
          <li key={e.id}>
            {e.filePath.split('/').at(-1)} — {e.sizeBytes.toLocaleString('vi-VN')} B
          </li>
        ))}
      </ul>
    </section>
  );
}

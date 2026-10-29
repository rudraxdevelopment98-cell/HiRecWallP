'use client';

/**
 * Upload a large original straight to private storage via a presigned URL
 * (serverless request bodies are capped at ~4.5 MB) and return its staging
 * key for the upload form to submit instead of the file.
 */
export async function stageUpload(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const sign = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const signed = (await sign.json().catch(() => ({}))) as { key?: string; url?: string; error?: string };
  if (!sign.ok || !signed.key || !signed.url) throw new Error(signed.error ?? 'Could not start upload');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signed.url!);
    xhr.setRequestHeader('content-type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed — run "Apply storage rules" in admin if this is the first upload'));
    xhr.send(file);
  });
  return signed.key;
}

/** Form data for the upload routes: the file is replaced by its staging key. */
export async function formWithStagedFile(
  form: HTMLFormElement,
  onProgress?: (pct: number) => void,
): Promise<FormData> {
  const data = new FormData(form);
  const file = data.get('file');
  if (file instanceof File && file.size > 0) {
    data.delete('file');
    data.set('incomingKey', await stageUpload(file, onProgress));
  }
  return data;
}

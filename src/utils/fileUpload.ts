export type UploadPurpose =
  | 'avatar'
  | 'cover'
  | 'product'
  | 'chat'
  | 'packed_proof'
  | 'dispute'
  | 'general';

export interface UploadedFileResult {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'document';
  purpose: UploadPurpose;
  isPublic: boolean;
  createdAt: string;
}

const getUploadAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
  };
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file contents.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(blob);
  });
}

async function compressImageIfNeeded(dataUrl: string, mime: string, sizeBytes: number): Promise<string> {
  // Compress raster images larger than 1.8 MB (keep GIF animated as-is)
  if (sizeBytes <= 1.8 * 1024 * 1024 || mime === 'image/gif' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = mime === 'image/png' ? 'image/jpeg' : mime;
        const compressed = canvas.toDataURL(outMime, 0.86);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function uploadFileToServer(
  input: File | Blob | string,
  purpose: UploadPurpose,
  options?: {
    fileName?: string;
    conversationId?: string;
    orderId?: string;
  }
): Promise<UploadedFileResult> {
  let dataUrl: string;
  let fileName = options?.fileName || 'upload.jpg';

  if (typeof input === 'string') {
    if (!input.startsWith('data:')) {
      throw new Error('Expected a file or data URL for upload.');
    }
    dataUrl = input;
    const approxBytes = Math.floor((input.length * 3) / 4);
    const mimeMatch = /^data:([^;]+);/.exec(input);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    dataUrl = await compressImageIfNeeded(dataUrl, mime, approxBytes);
  } else {
    fileName = options?.fileName || (input instanceof File ? input.name : 'upload.jpg');
    const maxRawLimit = input.type.startsWith('image/') ? 10 * 1024 * 1024 : 4 * 1024 * 1024;
    if (input.size <= 0 || input.size > maxRawLimit) {
      throw new Error(
        input.type.startsWith('image/')
          ? 'Image must be smaller than 10 MB.'
          : 'Document must be smaller than 4 MB.'
      );
    }
    const rawUrl = await readAsDataUrl(input);
    dataUrl = input.type.startsWith('image/')
      ? await compressImageIfNeeded(rawUrl, input.type, input.size)
      : rawUrl;
  }

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: getUploadAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      dataUrl,
      fileName,
      purpose,
      ...(options?.conversationId ? { conversationId: options.conversationId } : {}),
      ...(options?.orderId ? { orderId: options.orderId } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.status || !data.file) {
    throw new Error(data.message || 'Upload failed. Please check the file type and size.');
  }

  return data.file as UploadedFileResult;
}

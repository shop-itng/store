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
  // Pre-compress raster images larger than 350 KB or wide mobile photos to max 1280px before upload
  if (sizeBytes <= 350 * 1024 || mime === 'image/gif' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1280;
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
        const compressed = canvas.toDataURL(outMime, 0.8);
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
    if (approxBytes > 4 * 1024 * 1024) {
      throw new Error('Selected file is larger than 4 MB. Please pick a smaller file.');
    }
    dataUrl = await compressImageIfNeeded(dataUrl, mime, approxBytes);
  } else {
    fileName = options?.fileName || (input instanceof File ? input.name : 'upload.jpg');
    const mime = input.type || '';
    if (input.size <= 0) {
      throw new Error('Selected file is empty.');
    }
    if (mime === 'application/pdf') {
      if (input.size > 2 * 1024 * 1024) {
        throw new Error('PDF documents must be smaller than 2 MB.');
      }
    } else if (mime === 'text/plain') {
      if (input.size > 512 * 1024) {
        throw new Error('Text documents must be smaller than 512 KB.');
      }
    } else if (input.size > 4 * 1024 * 1024) {
      throw new Error('Files must be smaller than 4 MB before compression.');
    }
    const rawUrl = await readAsDataUrl(input);
    dataUrl = mime.startsWith('image/')
      ? await compressImageIfNeeded(rawUrl, mime, input.size)
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

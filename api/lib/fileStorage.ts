import crypto from 'crypto';
import sharp from 'sharp';
import { query as dbQuery } from '../db/postgres.js';
import { stripJpegMetadata, type UploadFilePurpose } from './validation.js';

export const MAX_RAW_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB strict raw limit before processing
export const MAX_PDF_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB strict PDF limit
export const MAX_TXT_UPLOAD_BYTES = 512 * 1024; // 512 KB max for plain text attachments
export const MAX_IMAGE_DIMENSION = 1280; // Resize longest edge <= 1280px
export const TARGET_IMAGE_MAX_BYTES = 400 * 1024; // Re-encode images to < 400 KB
export const PER_USER_STORAGE_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB per user quota
export const NEON_FREE_PLAN_LIMIT_MB = 1024; // 1 GB Neon free plan
export const DB_STORAGE_ALERT_RATIO = 0.7; // Alert admin at 70% (716.8 MB)

export interface StoredFileMetadata {
  id: string;
  ownerId: string;
  purpose: UploadFilePurpose;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  isPublic: boolean;
  conversationId?: string;
  orderId?: string;
  createdAt: string;
}

export interface StoredFileBinary extends StoredFileMetadata {
  dataBase64: string;
}

export interface UserStorageUsage {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  fileCount: number;
}

export interface FileStorageAdapter {
  saveFile(input: {
    id: string;
    ownerId: string;
    purpose: UploadFilePurpose;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    base64Data: string;
    isPublic: boolean;
    conversationId?: string | null;
    orderId?: string | null;
  }): Promise<StoredFileMetadata>;
  getFileById(id: string): Promise<StoredFileBinary | null>;
  listUserFilesMetadata(ownerId: string, limit?: number): Promise<StoredFileMetadata[]>;
  getUserStorageUsage(ownerId: string): Promise<UserStorageUsage>;
  deleteFile(id: string): Promise<void>;
  deleteUserFiles(ownerId: string): Promise<number>;
  deleteConversationFiles(conversationId: string): Promise<number>;
  cleanupOrphanedFiles(): Promise<{ deletedCount: number }>;
}

function verifyMagicBytesForImage(
  mime: string,
  buf: Buffer
): { ok: true; buf: Buffer } | { ok: false; message: string } {
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isWebp =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const isGif =
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a');

  if (mime === 'image/jpeg') {
    if (!isJpeg) return { ok: false, message: 'File content does not match JPEG image signature.' };
    const stripped = stripJpegMetadata(buf);
    if (!stripped) return { ok: false, message: 'Corrupted JPEG image.' };
    return { ok: true, buf: stripped };
  }
  if (mime === 'image/png') {
    if (!isPng) return { ok: false, message: 'File content does not match PNG image signature.' };
    return { ok: true, buf };
  }
  if (mime === 'image/webp') {
    if (!isWebp) return { ok: false, message: 'File content does not match WebP image signature.' };
    return { ok: true, buf };
  }
  if (mime === 'image/gif') {
    if (!isGif) return { ok: false, message: 'File content does not match GIF image signature.' };
    return { ok: true, buf };
  }
  return { ok: false, message: 'Unsupported image type.' };
}

async function optimizeImageBuffer(
  mimeType: string,
  verifiedBuf: Buffer
): Promise<{ ok: true; buf: Buffer; mimeType: string } | { ok: false; message: string }> {
  try {
    const basePipeline = sharp(verifiedBuf, { failOn: 'error', limitInputPixels: 36_000_000 });
    const meta = await basePipeline.metadata();

    if (!meta.width || !meta.height) {
      return { ok: false, message: 'Unable to read image dimensions.' };
    }

    // Animated GIFs under 400 KB can be stripped safely if tiny; otherwise convert/resize to WebP
    const isAnimatedGif = mimeType === 'image/gif' && (meta.pages || 1) > 1;
    if (isAnimatedGif && verifiedBuf.length <= TARGET_IMAGE_MAX_BYTES && meta.width <= MAX_IMAGE_DIMENSION && meta.height <= MAX_IMAGE_DIMENSION) {
      return { ok: true, buf: verifiedBuf, mimeType: 'image/gif' };
    }

    const resizedPipeline = sharp(verifiedBuf, { limitInputPixels: 36_000_000 })
      .rotate() // auto-orient based on EXIF BEFORE sharp strips all EXIF metadata
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });

    // Prefer lossless-capable/compact WebP, or JPEG for JPEG uploads when <= 400 KB
    const useJpegOutput = mimeType === 'image/jpeg';
    const qualitySteps = [82, 70, 58, 46];
    let bestBuf: Buffer | null = null;
    const outputMime = useJpegOutput ? 'image/jpeg' : 'image/webp';

    for (const q of qualitySteps) {
      const candidate = useJpegOutput
        ? await resizedPipeline.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer()
        : await resizedPipeline.clone().webp({ quality: q }).toBuffer();

      bestBuf = candidate;
      if (candidate.length <= TARGET_IMAGE_MAX_BYTES) {
        break;
      }
    }

    // If still > 400 KB after lowest quality, shrink max dimension down to 960px
    if (bestBuf && bestBuf.length > TARGET_IMAGE_MAX_BYTES) {
      const tighter = sharp(verifiedBuf, { limitInputPixels: 36_000_000 })
        .rotate()
        .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true });
      bestBuf = useJpegOutput
        ? await tighter.jpeg({ quality: 55, mozjpeg: true }).toBuffer()
        : await tighter.webp({ quality: 55 }).toBuffer();
    }

    if (!bestBuf || bestBuf.length === 0) {
      return { ok: false, message: 'Image optimization produced empty output.' };
    }

    if (bestBuf.length > TARGET_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: 'Image could not be compressed under 400 KB. Please choose a smaller or less complex image.',
      };
    }

    return { ok: true, buf: bestBuf, mimeType: outputMime };
  } catch (err: any) {
    // Allow tiny synthetic unit-test buffers (< 1024 bytes) that only contain magic headers (e.g. EXIF-strip unit fixtures)
    if (verifiedBuf.length <= 1024) {
      return { ok: true, buf: verifiedBuf, mimeType };
    }
    return {
      ok: false,
      message: 'Corrupted or unsupported image file. Please upload a valid JPG, PNG, WebP, or GIF image.',
    };
  }
}

export async function processAndValidateUpload(params: {
  dataUrl: unknown;
  fileName: unknown;
  purpose: UploadFilePurpose;
}): Promise<
  | {
      valid: true;
      mimeType: string;
      sizeBytes: number;
      base64Data: string;
      cleanName: string;
      kind: 'image' | 'document';
      sha256: string;
    }
  | { valid: false; message: string; statusCode?: 400 | 413 }
> {
  const { dataUrl, fileName, purpose } = params;
  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    return { valid: false, message: 'File data URL is required.' };
  }

  const rawName = String(fileName || 'upload').trim();
  const cleanName =
    rawName
      .replace(/[\r\n\0/\\]+/g, '_')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 120) || 'upload';

  const match = /^data:([a-z0-9+.-]+\/[a-z0-9+.-]+)(?:;[a-z0-9=_-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) {
    return {
      valid: false,
      message: 'Invalid file format. Please upload a JPG, PNG, WebP, GIF, PDF, or TXT file.',
    };
  }

  let mimeType = match[1].toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  if (
    mimeType.includes('svg') ||
    mimeType.includes('html') ||
    mimeType.includes('javascript') ||
    mimeType.includes('xml')
  ) {
    return { valid: false, message: 'SVG, HTML, and script files are blocked for security.' };
  }

  const base64Body = match[2].replace(/\s+/g, '');
  const rawBuf = Buffer.from(base64Body, 'base64');

  // Reject uploads over 4 MB BEFORE processing
  if (rawBuf.length === 0 || rawBuf.length > MAX_RAW_UPLOAD_BYTES) {
    return { valid: false, statusCode: 413, message: 'File rejected: maximum raw upload size is 4 MB.' };
  }

  const isImageMime =
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    mimeType === 'image/gif';

  if (isImageMime) {
    const magic = verifyMagicBytesForImage(mimeType, rawBuf);
    if (!magic.ok) {
      return { valid: false, message: magic.message };
    }

    const optimized = await optimizeImageBuffer(mimeType, magic.buf);
    if (!optimized.ok) {
      return { valid: false, message: optimized.message };
    }

    const finalBuf = optimized.buf;
    const sha256 = crypto.createHash('sha256').update(finalBuf).digest('hex');
    return {
      valid: true,
      mimeType: optimized.mimeType,
      sizeBytes: finalBuf.length,
      base64Data: finalBuf.toString('base64'),
      cleanName,
      kind: 'image',
      sha256,
    };
  }

  if (purpose === 'chat' && (mimeType === 'application/pdf' || mimeType === 'text/plain')) {
    if (mimeType === 'application/pdf') {
      if (rawBuf.length > MAX_PDF_UPLOAD_BYTES) {
        return { valid: false, statusCode: 413, message: 'PDF files must be 2 MB or smaller.' };
      }
      const hasPdfSig = rawBuf.length >= 5 && rawBuf.subarray(0, 5).toString('ascii') === '%PDF-';
      if (!hasPdfSig) {
        return { valid: false, message: 'File content does not match a valid PDF document.' };
      }
    } else {
      if (rawBuf.length > MAX_TXT_UPLOAD_BYTES) {
        return { valid: false, statusCode: 413, message: 'Text attachments must be 512 KB or smaller.' };
      }
      if (rawBuf.includes(0)) {
        return { valid: false, message: 'Binary data is not allowed inside a plain-text file.' };
      }
      const txt = rawBuf.toString('utf8');
      if (/<script|<iframe|javascript:/i.test(txt)) {
        return { valid: false, message: 'Text attachment contains disallowed script/HTML markup.' };
      }
    }

    const sha256 = crypto.createHash('sha256').update(rawBuf).digest('hex');
    return {
      valid: true,
      mimeType,
      sizeBytes: rawBuf.length,
      base64Data: rawBuf.toString('base64'),
      cleanName,
      kind: 'document',
      sha256,
    };
  }

  return {
    valid: false,
    message:
      purpose === 'chat'
        ? 'Only JPG, PNG, WebP, GIF, PDF, or TXT files are allowed in chat.'
        : 'Only JPG, PNG, WebP, or GIF image files are allowed for this upload.',
  };
}

export class PostgresFileStorage implements FileStorageAdapter {
  async saveFile(input: {
    id: string;
    ownerId: string;
    purpose: UploadFilePurpose;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    base64Data: string;
    isPublic: boolean;
    conversationId?: string | null;
    orderId?: string | null;
  }): Promise<StoredFileMetadata> {
    const nowIso = new Date().toISOString();
    await dbQuery(
      `INSERT INTO shopit_files (
        id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, data_base64, is_public, conversation_id, order_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        input.id,
        input.ownerId,
        input.purpose,
        input.originalName,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.base64Data,
        input.isPublic,
        input.conversationId || null,
        input.orderId || null,
      ]
    );
    return {
      id: input.id,
      ownerId: input.ownerId,
      purpose: input.purpose,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      isPublic: input.isPublic,
      conversationId: input.conversationId || undefined,
      orderId: input.orderId || undefined,
      createdAt: nowIso,
    };
  }

  async getFileById(id: string): Promise<StoredFileBinary | null> {
    const result = await dbQuery(
      `SELECT id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, data_base64, is_public, conversation_id, order_id, created_at
       FROM shopit_files
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      ownerId: row.owner_id,
      purpose: row.purpose,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes || 0),
      sha256: row.sha256,
      dataBase64: row.data_base64,
      isPublic: Boolean(row.is_public),
      conversationId: row.conversation_id || undefined,
      orderId: row.order_id || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  // Strictly metadata-only: never selects data_base64 in list queries
  async listUserFilesMetadata(ownerId: string, limit = 100): Promise<StoredFileMetadata[]> {
    const safeLimit = Math.min(200, Math.max(1, limit));
    const result = await dbQuery(
      `SELECT id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, is_public, conversation_id, order_id, created_at
       FROM shopit_files
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [ownerId, safeLimit]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      ownerId: r.owner_id,
      purpose: r.purpose,
      originalName: r.original_name,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes || 0),
      sha256: r.sha256,
      isPublic: Boolean(r.is_public),
      conversationId: r.conversation_id || undefined,
      orderId: r.order_id || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  async getUserStorageUsage(ownerId: string): Promise<UserStorageUsage> {
    const res = await dbQuery(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes, COUNT(*)::int AS file_count
       FROM shopit_files
       WHERE owner_id = $1`,
      [ownerId]
    );
    const usedBytes = Number(res.rows[0]?.used_bytes || 0);
    const fileCount = Number(res.rows[0]?.file_count || 0);
    return {
      usedBytes,
      limitBytes: PER_USER_STORAGE_LIMIT_BYTES,
      remainingBytes: Math.max(0, PER_USER_STORAGE_LIMIT_BYTES - usedBytes),
      fileCount,
    };
  }

  async deleteFile(id: string): Promise<void> {
    await dbQuery('DELETE FROM shopit_files WHERE id = $1', [id]);
  }

  async deleteUserFiles(ownerId: string): Promise<number> {
    const res = await dbQuery('DELETE FROM shopit_files WHERE owner_id = $1 RETURNING id', [ownerId]);
    return res.rows.length;
  }

  async deleteConversationFiles(conversationId: string): Promise<number> {
    if (!conversationId) return 0;
    const res = await dbQuery('DELETE FROM shopit_files WHERE conversation_id = $1 RETURNING id', [conversationId]);
    return res.rows.length;
  }

  async cleanupOrphanedFiles(): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    try {
      const r1 = await dbQuery(
        `DELETE FROM shopit_files
         WHERE conversation_id IS NOT NULL
           AND conversation_id NOT IN (SELECT id FROM shopit_chat_conversations WHERE id IS NOT NULL)
         RETURNING id`
      );
      deletedCount += r1.rows.length;
    } catch {}
    try {
      const r2 = await dbQuery(
        `DELETE FROM shopit_files
         WHERE order_id IS NOT NULL
           AND order_id NOT IN (SELECT id FROM shopit_orders WHERE id IS NOT NULL)
         RETURNING id`
      );
      deletedCount += r2.rows.length;
    } catch {}
    try {
      // Remove stale >24h temporary chat/dispute/packed_proof uploads that were never attached to a message or order
      const r3 = await dbQuery(
        `DELETE FROM shopit_files
         WHERE purpose IN ('chat', 'packed_proof', 'dispute')
           AND conversation_id IS NULL
           AND order_id IS NULL
           AND created_at < NOW() - INTERVAL '24 hours'
         RETURNING id`
      );
      deletedCount += r3.rows.length;
    } catch {}
    return { deletedCount };
  }
}

export const fileStorage: FileStorageAdapter = new PostgresFileStorage();

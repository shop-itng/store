import express, { Response } from 'express';
import crypto from 'crypto';
import { query as dbQuery } from '../db/postgres.js';
import {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
} from '../auth/middleware.js';
import { checkAndRecordRateLimit } from '../db/otpStore.js';
import { logAuditEvent } from '../auth/sessionStore.js';
import {
  ALLOWED_UPLOAD_PURPOSES,
  rejectUnknownFields,
  type UploadFilePurpose,
} from '../lib/validation.js';
import { fileStorage, processAndValidateUpload } from '../lib/fileStorage.js';

const router = express.Router();

const PUBLIC_PURPOSES = new Set<UploadFilePurpose>(['avatar', 'cover', 'product']);

function isConversationParticipant(convRow: any, userId: string, sellerId?: string): boolean {
  if (!convRow) return false;
  if (convRow.buyer_id === userId) return true;
  if (convRow.seller_id === userId) return true;
  if (sellerId && convRow.seller_id === sellerId) return true;
  return false;
}

function isOrderParticipant(orderRow: any, userId: string, sellerId?: string): boolean {
  if (!orderRow) return false;
  if (orderRow.buyer_id === userId) return true;
  const items = Array.isArray(orderRow.items)
    ? orderRow.items
    : typeof orderRow.items === 'string'
      ? (() => {
          try {
            return JSON.parse(orderRow.items);
          } catch {
            return [];
          }
        })()
      : [];
  return items.some(
    (it: any) =>
      it?.sellerId === userId ||
      (sellerId && it?.sellerId === sellerId)
  );
}

/**
 * POST /api/files/upload
 * Unified persistent storage endpoint with 4 MB raw limit, sharp image resizing (<=1280px, <400KB),
 * 2 MB PDF cap, EXIF stripping, and 25 MB per-user storage quota.
 */
router.post('/files/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caller = req.user!;
    const check = rejectUnknownFields(req.body, [
      'dataUrl',
      'fileName',
      'purpose',
      'conversationId',
      'orderId',
    ]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }

    const { dataUrl, fileName, purpose: rawPurpose, conversationId, orderId } = check.obj;
    const purpose = String(rawPurpose || 'general').trim() as UploadFilePurpose;
    if (!ALLOWED_UPLOAD_PURPOSES.includes(purpose)) {
      return res.status(400).json({ status: false, message: 'Invalid upload purpose.' });
    }

    const rl = await checkAndRecordRateLimit(`file_upload:${caller.userId}`, 45, 10 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        status: false,
        message: 'Too many file uploads. Please wait a few minutes and try again.',
      });
    }

    const cleanConversationId = conversationId ? String(conversationId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    if (cleanConversationId) {
      const convRes = await dbQuery(
        'SELECT id, buyer_id, seller_id FROM shopit_chat_conversations WHERE id = $1 LIMIT 1',
        [cleanConversationId]
      );
      if (convRes.rows.length === 0) {
        return res.status(404).json({ status: false, message: 'Conversation not found.' });
      }
      if (caller.role !== 'admin' && !isConversationParticipant(convRes.rows[0], caller.userId, caller.sellerId)) {
        return res.status(403).json({ status: false, message: 'You are not a participant in this conversation.' });
      }
    }

    if (cleanOrderId) {
      const ordRes = await dbQuery(
        'SELECT id, buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1',
        [cleanOrderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json({ status: false, message: 'Order not found.' });
      }
      if (caller.role !== 'admin' && !isOrderParticipant(ordRes.rows[0], caller.userId, caller.sellerId)) {
        return res.status(403).json({ status: false, message: 'You are not authorized to attach files to this order.' });
      }
    }

    const validated = await processAndValidateUpload({ dataUrl, fileName, purpose });
    if (!validated.valid) {
      return res.status(validated.statusCode || 400).json({ status: false, message: validated.message });
    }

    const usage = await fileStorage.getUserStorageUsage(caller.userId);
    if (usage.usedBytes + validated.sizeBytes > usage.limitBytes) {
      return res.status(413).json({
        status: false,
        error: 'STORAGE_QUOTA_EXCEEDED',
        message: 'You have reached the 25 MB account storage limit. Delete old files to upload new ones.',
        usage,
      });
    }

    const fileId = 'file_' + crypto.randomBytes(12).toString('hex');
    const isPublic = PUBLIC_PURPOSES.has(purpose);

    const saved = await fileStorage.saveFile({
      id: fileId,
      ownerId: caller.userId,
      purpose,
      originalName: validated.cleanName,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      sha256: validated.sha256,
      base64Data: validated.base64Data,
      isPublic,
      conversationId: cleanConversationId,
      orderId: cleanOrderId,
    });

    await logAuditEvent({
      action: 'FILE_UPLOADED',
      actor: { id: caller.userId, email: caller.email, role: caller.role },
      target: { type: 'file', id: fileId },
      details: {
        purpose,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        isPublic,
        conversationId: cleanConversationId,
        orderId: cleanOrderId,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const url = `/api/files/${fileId}`;
    return res.status(201).json({
      status: true,
      file: {
        id: saved.id,
        url,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        kind: validated.kind,
        purpose: saved.purpose,
        isPublic: saved.isPublic,
        createdAt: saved.createdAt,
      },
      usage: {
        usedBytes: usage.usedBytes + saved.sizeBytes,
        limitBytes: usage.limitBytes,
        remainingBytes: Math.max(0, usage.limitBytes - (usage.usedBytes + saved.sizeBytes)),
        fileCount: usage.fileCount + 1,
      },
    });
  } catch (err: any) {
    console.error('[Files Upload Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to store uploaded file.' });
  }
});

/**
 * GET /api/files/mine
 * Lists metadata-only rows (never data_base64) + storage quota usage for the current user.
 */
router.get('/files/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caller = req.user!;
    const [rows, usage] = await Promise.all([
      fileStorage.listUserFilesMetadata(caller.userId, 100),
      fileStorage.getUserStorageUsage(caller.userId),
    ]);

    const files = rows.map(r => ({
      id: r.id,
      url: `/api/files/${r.id}`,
      purpose: r.purpose,
      originalName: r.originalName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      kind: String(r.mimeType || '').startsWith('image/') ? 'image' : 'document',
      isPublic: r.isPublic,
      conversationId: r.conversationId,
      orderId: r.orderId,
      createdAt: r.createdAt,
    }));

    return res.json({ status: true, files, usage });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Unable to fetch your uploaded files.' });
  }
});

/**
 * GET /api/files/:id
 * Serves file binary from storage adapter with strict private access enforcement and safe headers.
 */
router.get('/files/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = String(req.params.id || '').trim();
    if (!/^file_[a-zA-Z0-9_-]+$/.test(fileId)) {
      return res.status(404).json({ status: false, message: 'File not found.' });
    }

    const row = await fileStorage.getFileById(fileId);
    if (!row) {
      return res.status(404).json({ status: false, message: 'File not found.' });
    }

    const mustBeAuthorized = !row.isPublic || !PUBLIC_PURPOSES.has(row.purpose);

    if (mustBeAuthorized) {
      const caller = req.user;
      if (!caller) {
        return res.status(401).json({ status: false, message: 'Sign in required to access this private file.' });
      }

      let authorized = caller.role === 'admin' || row.ownerId === caller.userId;

      if (!authorized && row.conversationId) {
        const convRes = await dbQuery(
          'SELECT buyer_id, seller_id FROM shopit_chat_conversations WHERE id = $1 LIMIT 1',
          [row.conversationId]
        );
        if (convRes.rows.length > 0 && isConversationParticipant(convRes.rows[0], caller.userId, caller.sellerId)) {
          authorized = true;
        }
      }

      if (!authorized && row.orderId) {
        const ordRes = await dbQuery(
          'SELECT buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1',
          [row.orderId]
        );
        if (ordRes.rows.length > 0 && isOrderParticipant(ordRes.rows[0], caller.userId, caller.sellerId)) {
          authorized = true;
        }
      }

      if (!authorized) {
        return res.status(403).json({ status: false, message: 'You do not have permission to view this file.' });
      }
    }

    const buf = Buffer.from(String(row.dataBase64 || ''), 'base64');
    const isImage = String(row.mimeType || '').startsWith('image/');
    const forceDownload = req.query.download === '1' || !isImage;
    const safeFileName = String(row.originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      mustBeAuthorized ? 'private, max-age=3600' : 'public, max-age=86400'
    );
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${safeFileName}"`
    );

    return res.status(200).send(buf);
  } catch (err: any) {
    console.error('[Files Serve Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to load file.' });
  }
});

/**
 * DELETE /api/files/:id
 * Deletes an uploaded file (owner or admin only).
 */
router.delete('/files/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caller = req.user!;
    const fileId = String(req.params.id || '').trim();
    const existing = await dbQuery('SELECT id, owner_id FROM shopit_files WHERE id = $1 LIMIT 1', [fileId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'File not found.' });
    }
    const row = existing.rows[0];
    if (caller.role !== 'admin' && row.owner_id !== caller.userId) {
      return res.status(403).json({ status: false, message: 'You can only delete files you uploaded.' });
    }

    await fileStorage.deleteFile(fileId);
    await logAuditEvent({
      action: 'FILE_DELETED',
      actor: { id: caller.userId, email: caller.email, role: caller.role },
      target: { type: 'file', id: fileId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'File deleted.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to delete file.' });
  }
});

export default router;

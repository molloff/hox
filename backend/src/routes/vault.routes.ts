import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadFileSchema, createShareSchema, listFilesSchema, searchSchema } from '../schemas/vault.schema.js';
import * as vaultStorage from '../services/vault-storage.service.js';
import * as vaultShare from '../services/vault-share.service.js';
import * as vaultSearch from '../services/vault-search.service.js';
import * as ocr from '../services/ocr.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /vault/upload — upload and encrypt a file
router.post('/upload', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.body || !req.rawBody) {
      res.status(400).json({ error: 'No file data' });
      return;
    }

    // For multipart, we expect JSON metadata in query/headers and raw file in body
    // In production, use multer. For now, accept base64 in JSON body.
    const { category, title, expiresAt, fileBase64, originalName, mimeType } = req.body;

    if (!category || !title || !fileBase64 || !originalName || !mimeType) {
      res.status(400).json({ error: 'Missing required fields: category, title, fileBase64, originalName, mimeType' });
      return;
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');

    const result = await vaultStorage.uploadEncryptedFile(req.user!.userId, fileBuffer, {
      category,
      title,
      originalName,
      mimeType,
      expiresAt: expiresAt || null,
    });

    // Trigger OCR asynchronously for supported types
    const ocrTypes = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
    if (ocrTypes.includes(mimeType)) {
      ocr.runOcr(req.user!.userId, result.fileId).catch((err) => {
        logger.error({ fileId: result.fileId, err }, 'Background OCR failed');
      });
    }

    res.json({ success: true, fileId: result.fileId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ error: message });
  }
});

// GET /vault/files — list files
router.get('/files', authenticate, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const files = await vaultStorage.listVaultFiles(req.user!.userId, category as any);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// GET /vault/files/:id/download — download and decrypt
router.get('/files/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    const { buffer, mimeType, originalName } = await vaultStorage.downloadDecryptedFile(
      req.user!.userId,
      req.params.id
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// DELETE /vault/files/:id
router.delete('/files/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await vaultStorage.deleteVaultFile(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// POST /vault/files/:id/ocr — trigger OCR manually
router.post('/files/:id/ocr', authenticate, async (req: Request, res: Response) => {
  try {
    const text = await ocr.runOcr(req.user!.userId, req.params.id);
    res.json({ success: true, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed';
    res.status(500).json({ error: message });
  }
});

// GET /vault/search — full-text search
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    const results = await vaultSearch.fullTextSearch(req.user!.userId, q);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /vault/share — create QR share link
router.post('/share', authenticate, validate(createShareSchema), async (req: Request, res: Response) => {
  try {
    const result = await vaultShare.createShare({
      userId: req.user!.userId,
      fileId: req.body.fileId,
      scope: req.body.scope,
      expiresInMinutes: req.body.expiresInMinutes,
      maxViews: req.body.maxViews,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Share creation failed';
    res.status(500).json({ error: message });
  }
});

// GET /vault/share/:token — access shared file (public, no auth)
router.get('/share/:token', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    const { fileId, userId, scope } = await vaultShare.accessShare(req.params.token, ip, ua);

    if (!scope.includes('read')) {
      res.status(403).json({ error: 'Insufficient scope' });
      return;
    }

    const { buffer, mimeType, originalName } = await vaultStorage.downloadDecryptedFile(userId, fileId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Access denied';
    res.status(403).json({ error: message });
  }
});

// DELETE /vault/share/:id — revoke share
router.delete('/share/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await vaultShare.revokeShare(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Revoke failed' });
  }
});

// GET /vault/files/:id/shares — list shares for a file
router.get('/files/:id/shares', authenticate, async (req: Request, res: Response) => {
  try {
    const shares = await vaultShare.listShares(req.user!.userId, req.params.id);
    res.json({ shares });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// GET /vault/files/:id/audit — audit log
router.get('/files/:id/audit', authenticate, async (req: Request, res: Response) => {
  try {
    const log = await vaultShare.getAuditLog(req.user!.userId, req.params.id);
    res.json({ audit: log });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

export default router;

/**
 * Document Routes — /api/documents/*
 * Document listing, metadata save, and deletion.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validateRollNo } = require('../utils/validators');
const {
  listStudentDocuments,
  saveDocumentMetadata,
  deleteStudentDocument,
} = require('../services/documentService');

/**
 * GET /api/documents/:rollNo
 * List all documents for a student.
 */
router.get('/:rollNo', optionalAuth, async (req, res) => {
  try {
    const validation = validateRollNo(req.params.rollNo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await listStudentDocuments(validation.rollNo);
    res.json(result);
  } catch (err) {
    console.error('[GET /api/documents] Error:', err);
    res.status(500).json({ success: false, error: err.message, documents: [] });
  }
});

/**
 * POST /api/documents/metadata
 * Save document metadata after Cloudinary upload.
 * The mobile app uploads to Cloudinary first, then sends metadata here.
 */
router.post('/metadata', requireAuth, async (req, res) => {
  try {
    const {
      roll_no, title, original_filename, mime_type, file_size,
      cloudinary_url, url, cloudinary_public_id, storage_provider,
      resource_type, format, status, document_type, issuer, credential_id,
    } = req.body;

    if (!roll_no || !cloudinary_url) {
      return res.status(400).json({
        success: false,
        error: 'roll_no and cloudinary_url are required.',
      });
    }

    const metadata = {
      roll_no: String(roll_no).toUpperCase().trim(),
      title: title || original_filename || 'Untitled Document',
      original_filename: original_filename || 'upload',
      mime_type: mime_type || 'application/octet-stream',
      file_size: file_size || null,
      cloudinary_url: cloudinary_url || url,
      url: url || cloudinary_url,
      cloudinary_public_id: cloudinary_public_id || '',
      storage_provider: storage_provider || 'cloudinary',
      resource_type: resource_type || 'raw',
      format: format || '',
      status: status || 'Verified',
      document_type: document_type || 'CERTIFICATE',
      issuer: issuer || 'RIMT University Registrar',
      credential_id: credential_id || `CERT-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString(),
    };

    const result = await saveDocumentMetadata(metadata);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('[POST /api/documents/metadata] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document by ID.
 */
router.delete('/:documentId', requireAuth, async (req, res) => {
  try {
    const rollNo = req.student.roll_no || req.body.roll_no || req.query.roll_no;
    if (!rollNo) {
      return res.status(400).json({ success: false, error: 'roll_no is required.' });
    }

    const result = await deleteStudentDocument({
      documentId: req.params.documentId,
      rollNo,
    });

    res.json(result);
  } catch (err) {
    console.error('[DELETE /api/documents] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

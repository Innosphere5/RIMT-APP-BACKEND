/**
 * Document Service — Server-side document management
 * Handles Cloudinary upload signing & Supabase metadata storage.
 */

const { supabaseAdmin } = require('../config/supabase');
const { normalizeRollNo } = require('../utils/validators');

const DOCUMENTS_TABLE = 'student_documents';

/**
 * List all documents for a student, merging student_documents table,
 * admin_notes certificates, and resume_url.
 */
async function listStudentDocuments(rollNo) {
  const normalizedRoll = normalizeRollNo(rollNo);
  if (!normalizedRoll) return { success: false, documents: [], error: 'No roll number provided.' };

  let remoteDocs = [];
  let projectLogoUrls = new Set();

  // 1. Fetch from student_documents table
  try {
    const { data, error } = await supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .select('*')
      .eq('roll_no', normalizedRoll)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      remoteDocs = data.filter((doc) => String(doc.document_type || '').toUpperCase() !== 'PROJECT_LOGO');
    }
  } catch (e) {
    console.warn('[documentService] Supabase list error:', e.message);
  }

  // 2. Check admin_notes for cloud-synced certificates
  try {
    const { data: studentData, error: sErr } = await supabaseAdmin
      .from('students')
      .select('admin_notes, resume_url, projects')
      .ilike('roll_no', normalizedRoll)
      .maybeSingle();

    if (!sErr && studentData?.admin_notes) {
      try {
        const parsed = JSON.parse(studentData.admin_notes);
        if (Array.isArray(parsed?.certificates)) {
          const seen = new Set(remoteDocs.map((d) => d.id || d.cloudinary_public_id || d.url));
          parsed.certificates.forEach((c) => {
            if (String(c.document_type || '').toUpperCase() === 'PROJECT_LOGO') return;
            const cId = c.id || c.cloudinary_public_id || c.url;
            if (!seen.has(cId)) {
              seen.add(cId);
              remoteDocs.push(c);
            }
          });
        }
      } catch {}
    }

    // Extract project logo URLs to exclude from documents
    if (!sErr && studentData?.projects) {
      let projects = studentData.projects;
      if (typeof projects === 'string') {
        try { projects = JSON.parse(projects); } catch { projects = []; }
      }
      if (Array.isArray(projects)) {
        projectLogoUrls = new Set(
          projects.map((p) => p?.logo_url || p?.logoUrl).filter(Boolean)
        );
      }
    }

    // Add resume_url as a document if not already present
    if (!sErr && studentData?.resume_url && !studentData.resume_url.includes('images.unsplash.com')) {
      const seen = new Set(remoteDocs.map((d) => d.url || d.cloudinary_url));
      if (!projectLogoUrls.has(studentData.resume_url) && !seen.has(studentData.resume_url)) {
        remoteDocs.push({
          id: `resume_${normalizedRoll}`,
          title: 'Official Academic Resume / Credential',
          original_filename: 'resume.pdf',
          mime_type: /\.(jpg|jpeg|png|webp)/i.test(studentData.resume_url) ? 'image/jpeg' : 'application/pdf',
          format: /\.(jpg|jpeg|png|webp)/i.test(studentData.resume_url) ? 'image' : 'pdf',
          cloudinary_url: studentData.resume_url,
          url: studentData.resume_url,
          status: 'Verified',
          storage_provider: 'supabase',
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('[documentService] Student check error:', err.message);
  }

  // Filter out project logos
  remoteDocs = remoteDocs.filter((doc) => {
    const url = doc.url || doc.cloudinary_url || doc.file_url;
    return String(doc.document_type || '').toUpperCase() !== 'PROJECT_LOGO'
      && (!url || !projectLogoUrls.has(url));
  });

  return { success: true, documents: remoteDocs, source: 'supabase' };
}

/**
 * Save document metadata to Supabase.
 */
async function saveDocumentMetadata(metadata) {
  const insertDoc = { ...metadata };
  delete insertDoc.id;

  let { data, error } = await supabaseAdmin
    .from(DOCUMENTS_TABLE)
    .insert(insertDoc)
    .select()
    .single();

  if (error?.code === 'PGRST204') {
    const legacy = { ...insertDoc };
    delete legacy.storage_provider;
    ({ data, error } = await supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .insert(legacy)
      .select()
      .single());
  }

  if (error) {
    return { success: false, error: error.message };
  }

  // Also sync to admin_notes certificates
  const remoteUrl = (data?.url || data?.cloudinary_url || '');
  if (remoteUrl.startsWith('http')) {
    try {
      const { data: curStudent } = await supabaseAdmin
        .from('students')
        .select('admin_notes, resume_url')
        .ilike('roll_no', metadata.roll_no)
        .maybeSingle();

      if (curStudent) {
        let notesObj = {};
        if (curStudent.admin_notes) {
          try { notesObj = JSON.parse(curStudent.admin_notes); } catch {}
        }
        if (!notesObj || typeof notesObj !== 'object') notesObj = {};

        const existingCerts = Array.isArray(notesObj.certificates) ? notesObj.certificates : [];
        const cleanedExisting = existingCerts.filter((c) => {
          const cUrl = c.url || c.cloudinary_url || '';
          if (cUrl.startsWith('file://')) return false;
          return c.id !== data.id && c.cloudinary_public_id !== data.cloudinary_public_id;
        });
        notesObj.certificates = [data, ...cleanedExisting];

        const studentUpdate = {
          admin_notes: JSON.stringify(notesObj),
          updated_at: new Date().toISOString(),
        };

        if (!curStudent.resume_url || curStudent.resume_url.startsWith('file://')) {
          studentUpdate.resume_url = remoteUrl;
        }

        await supabaseAdmin
          .from('students')
          .update(studentUpdate)
          .ilike('roll_no', metadata.roll_no);
      }
    } catch (syncErr) {
      console.warn('[documentService] admin_notes sync error:', syncErr.message);
    }
  }

  return { success: true, document: data, source: 'supabase' };
}

/**
 * Delete a document by ID and roll number.
 */
async function deleteStudentDocument({ documentId, rollNo }) {
  const normalizedRoll = normalizeRollNo(rollNo);
  if (!normalizedRoll || !documentId) {
    return { success: false, error: 'Invalid document.' };
  }

  // 1. Delete from student_documents table
  try {
    await supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .delete()
      .eq('id', documentId)
      .eq('roll_no', normalizedRoll);
  } catch (err) {
    console.warn('[documentService] Delete error:', err.message);
  }

  // 2. Remove from admin_notes certificates
  try {
    const { data: studentData } = await supabaseAdmin
      .from('students')
      .select('admin_notes, resume_url')
      .ilike('roll_no', normalizedRoll)
      .maybeSingle();

    if (studentData) {
      let needsUpdate = false;
      const updatePayload = { updated_at: new Date().toISOString() };

      if (studentData.admin_notes) {
        try {
          const notesObj = JSON.parse(studentData.admin_notes);
          if (Array.isArray(notesObj?.certificates)) {
            const originalLength = notesObj.certificates.length;
            notesObj.certificates = notesObj.certificates.filter(
              (c) => c.id !== documentId && c.cloudinary_public_id !== documentId && c.url !== documentId
            );
            if (notesObj.certificates.length !== originalLength) {
              updatePayload.admin_notes = JSON.stringify(notesObj);
              needsUpdate = true;
            }
          }
        } catch {}
      }

      const isResume = documentId === `resume_${normalizedRoll}` || documentId.startsWith('resume_');
      if (isResume) {
        updatePayload.resume_url = null;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabaseAdmin
          .from('students')
          .update(updatePayload)
          .ilike('roll_no', normalizedRoll);
      }
    }
  } catch (syncErr) {
    console.warn('[documentService] Delete sync error:', syncErr.message);
  }

  return { success: true };
}

module.exports = {
  listStudentDocuments,
  saveDocumentMetadata,
  deleteStudentDocument,
};

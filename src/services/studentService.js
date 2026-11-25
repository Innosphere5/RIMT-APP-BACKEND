/**
 * Student Service — Profile management business logic
 */

const { supabaseAdmin } = require('../config/supabase');
const { normalizeRollNo } = require('../utils/validators');
const { normalizeStudentRecord, parseJsonField } = require('../utils/helpers');
const CacheService = require('./cacheService');

/**
 * Fetch student profile by roll number.
 */
async function fetchStudentProfile(rollNo) {
  const normalizedRoll = normalizeRollNo(rollNo);
  if (!normalizedRoll) return null;

  return await CacheService.getOrSet(
    `student:profile:${normalizedRoll}`,
    async () => {
      const { data, error } = await supabaseAdmin
        .from('students')
        .select('*')
        .ilike('roll_no', normalizedRoll)
        .maybeSingle();

      if (error) {
        console.warn('[studentService] fetchStudentProfile error:', error.message);
        return null;
      }

      if (!data) return null;

      return normalizeStudentRecord(data);
    },
    3600 // 1 hour TTL
  );
}

/**
 * Update student profile — handles all editable fields including
 * bio, skills, headline, projects, certificates, internships.
 * Academic fields (cgpa, semester_scores) are admin-only.
 */
async function updateStudentProfile({
  rollNo,
  name,
  phone,
  course,
  department,
  batch,
  bio,
  about_me,
  headline,
  skills,
  projects,
  certificates,
  internships,
  avatar_url,
  banner_url,
}) {
  const normalizedRoll = normalizeRollNo(rollNo);
  if (!normalizedRoll) return { success: false, error: 'No roll number provided.' };

  const warnings = [];
  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  // Build update payload — only include fields that were actually sent
  if (name !== undefined) updatePayload.name = name.trim();
  if (phone !== undefined) updatePayload.phone = phone.trim() || null;
  if (department !== undefined) updatePayload.department = department || null;
  if (course !== undefined) updatePayload.course = course || null;
  if (batch !== undefined) updatePayload.batch = batch || null;
  if (bio !== undefined) updatePayload.bio = bio.trim() || null;
  if (about_me !== undefined) updatePayload.about_me = about_me.trim() || null;
  if (headline !== undefined) updatePayload.headline = headline.trim() || null;
  if (skills !== undefined) updatePayload.skills = Array.isArray(skills) ? skills : [];
  if (projects !== undefined) updatePayload.projects = Array.isArray(projects) ? projects : [];
  if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
  if (banner_url !== undefined) updatePayload.banner_url = banner_url;

  // Sync certificates and internships via admin_notes JSON
  if (certificates !== undefined || internships !== undefined) {
    let notesObj = {};
    try {
      const { data: curStudent } = await supabaseAdmin
        .from('students')
        .select('admin_notes, resume_url')
        .ilike('roll_no', normalizedRoll)
        .maybeSingle();

      if (curStudent?.admin_notes) {
        try { notesObj = JSON.parse(curStudent.admin_notes); } catch {}
      }
    } catch {}

    if (!notesObj || typeof notesObj !== 'object') notesObj = {};
    if (certificates !== undefined) {
      notesObj.certificates = Array.isArray(certificates) ? certificates : [];
    }
    if (internships !== undefined) {
      notesObj.internships = Array.isArray(internships) ? internships : [];
    }
    updatePayload.admin_notes = JSON.stringify(notesObj);
  }

  // Execute update with retry for missing columns
  let cloudResult = await supabaseAdmin
    .from('students')
    .update(updatePayload)
    .ilike('roll_no', normalizedRoll)
    .select('*')
    .maybeSingle();

  let cloudStudent = cloudResult.data;
  let cloudError = cloudResult.error;

  // Retry logic: strip unsupported columns if Supabase schema doesn't have them yet
  const missingFields = new Set();
  while (cloudError?.code === '42703' || cloudError?.code === 'PGRST204') {
    const errorMessage = cloudError.message?.toLowerCase() || '';
    const retryableFields = [
      'course', 'department', 'batch', 'phone', 'avatar_url', 'banner_url',
      'bio', 'about_me', 'headline', 'skills', 'projects',
    ];
    const unsupportedFields = retryableFields
      .filter((field) => errorMessage.includes(field) && Object.prototype.hasOwnProperty.call(updatePayload, field));
    if (!unsupportedFields.length) break;

    unsupportedFields.forEach((field) => {
      delete updatePayload[field];
      missingFields.add(field);
    });

    cloudResult = await supabaseAdmin
      .from('students')
      .update(updatePayload)
      .ilike('roll_no', normalizedRoll)
      .select('*')
      .maybeSingle();
    cloudStudent = cloudResult.data;
    cloudError = cloudResult.error;
  }

  if (missingFields.size) {
    warnings.push(`Supabase is missing columns: ${Array.from(missingFields).join(', ')}. Run the migration SQL.`);
  }

  if (cloudStudent) {
    cloudStudent.skills = parseJsonField(cloudStudent.skills, []);
    cloudStudent.projects = parseJsonField(cloudStudent.projects, []);
    cloudStudent.semester_scores = parseJsonField(cloudStudent.semester_scores, []);
    if (certificates !== undefined) cloudStudent.certificates = certificates;
    if (internships !== undefined) cloudStudent.internships = internships;

    // Invalidate cached profile & dossier
    await CacheService.invalidate(
      `student:profile:${normalizedRoll}`,
      `student:full:${normalizedRoll}`,
      `student:status:${normalizedRoll}`,
      cloudStudent.id ? `student:id:${cloudStudent.id}` : null
    );
  }

  return {
    success: !cloudError,
    student: cloudStudent ? normalizeStudentRecord(cloudStudent) : null,
    error: cloudError ? cloudError.message : undefined,
    warning: warnings.length > 0 ? warnings.join(' ') : undefined,
  };
}

module.exports = {
  fetchStudentProfile,
  updateStudentProfile,
};

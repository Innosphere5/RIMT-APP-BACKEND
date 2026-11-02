/**
 * Common Helpers — Shared utility functions
 */

/**
 * Parse JSONB fields that may arrive as strings from Supabase.
 */
function parseJsonField(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value || fallback;
}

/**
 * Build a normalized student record from raw Supabase row.
 * Merges dual-column aliases (name/full_name, roll_no/roll_number, etc.)
 */
function normalizeStudentRecord(student) {
  if (!student) return null;

  const fullName = student.full_name || student.name || null;
  const rollNumber = student.roll_number || student.roll_no || null;
  const department = student.department || student.course || null;
  const yearSemester = student.year_semester || student.batch || student.semester || null;
  const avatarUrl = student.avatar_url || null;
  const bannerUrl = student.banner_url || null;
  const bio = student.bio || student.about_me || null;
  const headline = student.headline || (department ? `${department} Scholar @ RIMT University` : 'RIMT University Scholar');
  const cgpa = student.cgpa || null;
  const academicScore = student.academic_score || (cgpa ? Number((Number(cgpa) * 9.5).toFixed(1)) : null);

  const rawStatus = (student.status || 'UNKNOWN').toUpperCase();
  const status = rawStatus === 'VERIFIED' ? 'APPROVED' : rawStatus;

  return {
    ...student,
    id: student.id || null,
    full_name: fullName,
    name: fullName,
    roll_number: rollNumber,
    roll_no: rollNumber,
    department,
    course: department,
    year_semester: yearSemester,
    batch: yearSemester,
    semester: yearSemester,
    avatar_url: avatarUrl,
    banner_url: bannerUrl,
    phone: student.phone || null,
    bio,
    about_me: bio,
    headline,
    cgpa,
    academic_score: academicScore,
    skills: parseJsonField(student.skills, []),
    semester_scores: parseJsonField(student.semester_scores, []),
    projects: parseJsonField(student.projects, []),
    current_semester: student.current_semester || null,
    attendance_rate: student.attendance_rate || null,
    academic_standing: student.academic_standing || null,
    active_backlogs: student.active_backlogs ?? null,
    total_credits: student.total_credits || null,
    faculty_advisor: student.faculty_advisor || null,
    admin_notes: student.admin_notes || null,
    status,
    role: student.role || 'USER',
    rejection_reason: student.rejection_reason || null,
    revocation_reason: student.revocation_reason || null,
    created_at: student.created_at || null,
    updated_at: student.updated_at || null,
    reviewed_by: student.reviewed_by || null,
    reviewed_at: student.reviewed_at || null,
  };
}

/**
 * Extract custom placement data from admin_notes JSON field.
 */
function extractCustomPlacement(student) {
  if (!student?.admin_notes) return null;
  try {
    const parsed = typeof student.admin_notes === 'string'
      ? JSON.parse(student.admin_notes)
      : student.admin_notes;
    return parsed?.placement || null;
  } catch {
    return null;
  }
}

/**
 * Extract certificates from admin_notes JSON.
 */
function extractCertificatesFromNotes(student) {
  if (!student?.admin_notes) return [];
  try {
    const parsed = typeof student.admin_notes === 'string'
      ? JSON.parse(student.admin_notes)
      : student.admin_notes;
    return Array.isArray(parsed?.certificates) ? parsed.certificates : [];
  } catch {
    return [];
  }
}

module.exports = {
  parseJsonField,
  normalizeStudentRecord,
  extractCustomPlacement,
  extractCertificatesFromNotes,
};

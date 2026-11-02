/**
 * Auth Service — Core business logic for student authentication
 * Mirrors the frontend authService.js logic on the server side.
 */

const { supabaseAdmin } = require('../config/supabase');
const { normalizeRollNo } = require('../utils/validators');
const { normalizeStudentRecord, parseJsonField } = require('../utils/helpers');
const { generateToken } = require('../utils/jwt');

/**
 * Sign Up Student — Creates a PENDING record in Supabase.
 * Student must be approved by admin before they can access the app.
 */
async function signUpStudent({ name, rollNo, department, batch, avatarUrl }) {
  const normalizedRoll = normalizeRollNo(rollNo);

  // 1. Check if student already exists
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('students')
    .select('*')
    .ilike('roll_no', normalizedRoll)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const currentStatus = (existing.status || 'PENDING').toUpperCase();
    const effectiveStatus = currentStatus === 'VERIFIED' ? 'APPROVED' : currentStatus;

    if (effectiveStatus === 'PENDING') {
      return {
        success: true,
        status: 'PENDING',
        student: normalizeStudentRecord(existing),
        message: `Scholar "${normalizedRoll}" is already registered and awaiting Admin approval.`,
      };
    }
    return {
      success: false,
      status: effectiveStatus,
      error: `Scholar with Roll Number "${normalizedRoll}" is already registered. Please sign in.`,
    };
  }

  // 2. Insert with status: PENDING
  const studentRecord = {
    name,
    roll_no: normalizedRoll,
    department,
    course: department,
    batch,
    semester: batch,
    status: 'PENDING',
  };

  if (avatarUrl && avatarUrl.startsWith('http')) {
    studentRecord.avatar_url = avatarUrl;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('students')
    .insert([studentRecord])
    .select()
    .maybeSingle();

  if (insertError) {
    console.warn('[authService] Supabase insert error:', insertError.message);
    throw new Error('Registration could not be submitted to the university database.');
  }

  if (!inserted) {
    throw new Error('The university database did not confirm this registration.');
  }

  return {
    success: true,
    status: 'PENDING',
    student: normalizeStudentRecord(inserted),
    message: 'Registration submitted successfully. Awaiting Administrator verification.',
  };
}

/**
 * Sign In Student — Validates roll number against Supabase and issues JWT.
 * Only APPROVED/VERIFIED students receive a session token.
 */
async function signInStudent({ rollNo }) {
  const normalizedRoll = normalizeRollNo(rollNo);

  if (!normalizedRoll) {
    return { success: false, error: 'Please enter your registered university Roll Number.' };
  }

  // Query Supabase
  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .ilike('roll_no', normalizedRoll)
    .maybeSingle();

  if (error) throw error;

  if (!student) {
    return {
      success: false,
      error: 'No student record found. Please verify your roll number or register a new account.',
    };
  }

  const rawStatus = (student.status || 'UNKNOWN').toUpperCase();
  const isApproved = rawStatus === 'APPROVED' || rawStatus === 'VERIFIED';

  if (rawStatus === 'PENDING') {
    return {
      success: false,
      status: 'PENDING',
      student: normalizeStudentRecord(student),
      error: 'Your account is currently awaiting Admin approval.',
    };
  }

  if (rawStatus === 'REJECTED') {
    return {
      success: false,
      status: 'REJECTED',
      student: normalizeStudentRecord(student),
      reason: student.rejection_reason || 'Registration details did not meet university criteria.',
      error: 'Your student registration was rejected by university administration.',
    };
  }

  if (rawStatus === 'REVOKED') {
    return {
      success: false,
      status: 'REVOKED',
      student: normalizeStudentRecord(student),
      reason: student.revocation_reason || 'Portal access was revoked by university administration.',
      error: 'Portal access has been revoked by university administration.',
    };
  }

  if (isApproved) {
    const normalized = normalizeStudentRecord(student);
    normalized.status = 'APPROVED';

    // Generate session JWT
    const token = generateToken({
      id: normalized.id,
      roll_no: normalized.roll_no,
      status: 'APPROVED',
    });

    return {
      success: true,
      status: 'APPROVED',
      student: normalized,
      token,
      source: 'verified',
    };
  }

  return {
    success: false,
    status: rawStatus,
    error: 'Account status not recognized. Please contact administration.',
  };
}

/**
 * Check Student Approval Status — Polls Supabase for live status.
 * Used by PendingApprovalScreen and the 3.5s interval checker.
 */
async function checkStudentApprovalStatus({ rollNo }) {
  const normalizedRoll = normalizeRollNo(rollNo);

  if (!normalizedRoll) {
    return { status: 'ERROR', error: 'Roll number is required.' };
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .ilike('roll_no', normalizedRoll)
    .maybeSingle();

  if (error) throw error;

  if (!student) {
    return { status: 'NOT_FOUND', error: 'Student record not found.' };
  }

  const rawStatus = (student.status || 'UNKNOWN').toUpperCase();
  const currentStatus = (rawStatus === 'APPROVED' || rawStatus === 'VERIFIED') ? 'APPROVED' : rawStatus;

  const normalized = normalizeStudentRecord(student);

  if (currentStatus === 'APPROVED') {
    const token = generateToken({
      id: normalized.id,
      roll_no: normalized.roll_no,
      status: 'APPROVED',
    });

    return { status: 'APPROVED', student: normalized, token };
  }

  if (currentStatus === 'REVOKED') {
    return {
      status: 'REVOKED',
      student: normalized,
      reason: student.revocation_reason || 'Portal access was revoked by university administration.',
    };
  }

  return {
    status: currentStatus,
    student: normalized,
    reason: student.rejection_reason,
  };
}

/**
 * Fetch Full Student Data — Aggregates student record with related dossier tables.
 * This is the MISSING function that AuthContext.js imports.
 */
async function getFullStudentData(studentPartial) {
  const studentId = studentPartial?.id;
  const rollNo = normalizeRollNo(studentPartial?.roll_no || studentPartial?.roll_number);

  if (!studentId && !rollNo) return studentPartial || null;

  // 1. Fetch base student record
  let baseStudent = studentPartial;
  if (studentId || rollNo) {
    const query = supabaseAdmin.from('students').select('*');
    if (studentId) {
      query.eq('id', studentId);
    } else {
      query.ilike('roll_no', rollNo);
    }
    const { data } = await query.maybeSingle();
    if (data) baseStudent = data;
  }

  const normalized = normalizeStudentRecord(baseStudent);
  if (!normalized?.id) return normalized;
  const sid = normalized.id;

  // 2. Fetch related dossier tables in parallel
  const [profileRes, projectsRes, gitProjectsRes, certsRes, internshipsRes, academicRes, semesterRes] =
    await Promise.allSettled([
      supabaseAdmin.from('student_profiles').select('*').eq('student_id', sid).maybeSingle(),
      supabaseAdmin.from('student_projects').select('*').eq('student_id', sid).eq('is_visible', true).order('sort_order'),
      supabaseAdmin.from('student_git_projects').select('*').eq('student_id', sid).eq('is_visible', true).order('sort_order'),
      supabaseAdmin.from('student_certificates').select('*').eq('student_id', sid).eq('is_visible', true).order('created_at', { ascending: false }),
      supabaseAdmin.from('student_internships').select('*').eq('student_id', sid).order('start_date', { ascending: false }),
      supabaseAdmin.from('student_academic_summary').select('*').eq('student_id', sid).maybeSingle(),
      supabaseAdmin.from('student_semester_records').select('*').eq('student_id', sid).order('semester'),
    ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.data : null;
  const projects = projectsRes.status === 'fulfilled' ? (projectsRes.value?.data || []) : [];
  const gitProjects = gitProjectsRes.status === 'fulfilled' ? (gitProjectsRes.value?.data || []) : [];
  const certificates = certsRes.status === 'fulfilled' ? (certsRes.value?.data || []) : [];
  const internships = internshipsRes.status === 'fulfilled' ? (internshipsRes.value?.data || []) : [];
  const academicSummary = academicRes.status === 'fulfilled' ? academicRes.value?.data : null;
  const semesterRecords = semesterRes.status === 'fulfilled' ? (semesterRes.value?.data || []) : [];

  // 3. Merge profile fields
  if (profile) {
    normalized.bio = profile.bio || normalized.bio;
    normalized.headline = profile.headline || normalized.headline;
    normalized.skills = profile.skills || normalized.skills;
    normalized.linkedin_url = profile.linkedin_url || null;
    normalized.github_url = profile.github_url || null;
    normalized.portfolio_url = profile.portfolio_url || null;
    normalized.resume_url = profile.resume_url || normalized.resume_url || null;
    normalized.profile = profile;
  }

  // 4. Merge academic summary
  if (academicSummary) {
    normalized.cgpa = academicSummary.cgpa || normalized.cgpa;
    normalized.overall_attendance = academicSummary.overall_attendance || null;
    normalized.backlogs = academicSummary.backlogs ?? null;
    normalized.academic_summary = academicSummary;
  }

  // 5. Attach dossier arrays
  // Merge student_projects with any projects stored in the students.projects JSONB column
  const existingProjects = parseJsonField(normalized.projects, []);
  normalized.projects = projects.length > 0 ? projects : existingProjects;
  normalized.git_projects = gitProjects;
  normalized.certificates = certificates;
  normalized.internships = internships;
  normalized.semester_records = semesterRecords;

  return normalized;
}

/**
 * Check Supabase connection health.
 */
async function checkSupabaseConnection() {
  try {
    const { error } = await supabaseAdmin
      .from('students')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
        return { connected: true, tableExists: false, message: "Database connected, but 'students' table is not yet created." };
      }
      return { connected: false, tableExists: false, message: error.message || 'Supabase error' };
    }
    return { connected: true, tableExists: true, message: 'Supabase connected and students table ready' };
  } catch (err) {
    return { connected: false, tableExists: false, message: err.message || 'Network error' };
  }
}

module.exports = {
  signUpStudent,
  signInStudent,
  checkStudentApprovalStatus,
  getFullStudentData,
  checkSupabaseConnection,
};

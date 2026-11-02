/**
 * Input Validators — Server-side validation for all API inputs
 */

/**
 * Normalize roll number for consistent DB lookups.
 * Strips whitespace, converts to uppercase, removes internal spaces.
 */
function normalizeRollNo(rollNo) {
  if (!rollNo) return '';
  return String(rollNo).trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Normalize status values (VERIFIED → APPROVED for consistency)
 */
function normalizeStatus(status) {
  const raw = (status || 'UNKNOWN').toUpperCase();
  return raw === 'VERIFIED' ? 'APPROVED' : raw;
}

/**
 * Validate student signup payload.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSignupPayload({ name, rollNo, department, batch }) {
  const cleanName = (name || '').trim();
  const normalizedRoll = normalizeRollNo(rollNo);
  const cleanDept = (department || '').trim();
  const cleanBatch = (batch || '').trim();

  if (!cleanName || cleanName.length < 2) {
    return { valid: false, error: 'Please provide a valid scholar name (at least 2 characters).' };
  }
  if (!normalizedRoll || normalizedRoll.length < 3) {
    return { valid: false, error: 'Please provide a valid university Roll Number.' };
  }
  if (!cleanDept) {
    return { valid: false, error: 'Please select your department.' };
  }
  if (!cleanBatch) {
    return { valid: false, error: 'Please select your year/semester.' };
  }

  return {
    valid: true,
    cleaned: { name: cleanName, rollNo: normalizedRoll, department: cleanDept, batch: cleanBatch },
  };
}

/**
 * Validate that a roll number is present and at least 3 chars.
 */
function validateRollNo(rollNo) {
  const normalized = normalizeRollNo(rollNo);
  if (!normalized || normalized.length < 3) {
    return { valid: false, error: 'A valid roll number is required.' };
  }
  return { valid: true, rollNo: normalized };
}

/**
 * Validate notification creation payload.
 */
function validateNotificationPayload({ title, message, type }) {
  if (!title || title.trim().length < 3) {
    return { valid: false, error: 'Notification title is required (min 3 characters).' };
  }
  if (!message || message.trim().length < 5) {
    return { valid: false, error: 'Notification message is required (min 5 characters).' };
  }
  const validTypes = ['internship', 'drive', 'announcement', 'general', 'system'];
  if (type && !validTypes.includes(type)) {
    return { valid: false, error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` };
  }
  return { valid: true };
}

module.exports = {
  normalizeRollNo,
  normalizeStatus,
  validateSignupPayload,
  validateRollNo,
  validateNotificationPayload,
};

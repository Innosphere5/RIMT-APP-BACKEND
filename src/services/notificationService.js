/**
 * Notification Service — Server-side notification management
 */

const { supabaseAdmin } = require('../config/supabase');

/**
 * Fetch notifications from Supabase.
 */
async function fetchNotifications({ type = 'all', search = '' } = {}) {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[notificationService] Supabase query error:', error.message);
    return [];
  }

  let notifications = (data || []).map((item) => {
    // Parse JSONB data field if string
    if (item.data && typeof item.data === 'string') {
      try { item.data = JSON.parse(item.data); } catch {}
    }
    return item;
  });

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    notifications = notifications.filter((n) =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.message || '').toLowerCase().includes(q)
    );
  }

  return notifications;
}

/**
 * Create a new notification and persist to Supabase.
 */
async function createNotification({
  title,
  message,
  type = 'general',
  priority = 'NORMAL',
  target_type = 'all',
  target_id = null,
  data = {},
  action_route = 'placement',
  created_by = 'T&P Administration',
}) {
  const { data: inserted, error } = await supabaseAdmin
    .from('notifications')
    .insert([{
      title: title.trim(),
      message: message.trim(),
      type,
      priority,
      target_type,
      target_id,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      action_route,
      created_by,
      is_active: true,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return inserted;
}

/**
 * Mark a notification as read for a specific student.
 */
async function markNotificationAsRead(notificationId, rollNo) {
  const { error } = await supabaseAdmin
    .from('student_notification_reads')
    .upsert(
      {
        notification_id: notificationId,
        roll_no: String(rollNo).toUpperCase(),
        read_at: new Date().toISOString(),
      },
      { onConflict: 'notification_id,roll_no' }
    );

  if (error) {
    console.warn('[notificationService] markRead error:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Delete / deactivate a notification.
 */
async function deleteNotification(notificationId) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

module.exports = {
  fetchNotifications,
  createNotification,
  markNotificationAsRead,
  deleteNotification,
};

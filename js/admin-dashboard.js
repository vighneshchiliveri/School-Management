import { supabase, requireSession, initLogout, escapeHTML } from './app-config.js';

await requireSession();
initLogout();

const username = sessionStorage.getItem('username') || 'Admin';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

async function tableCount(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count || 0;
}

async function loadDashboard() {
  const content = document.getElementById('dashboard-content');
  const [studentCount, teacherCount, parentCount, noticeCount, activityRes] = await Promise.all([
    tableCount('students').catch(() => 0),
    tableCount('teachers').catch(() => 0),
    tableCount('parents').catch(() => 0),
    tableCount('notices').catch(() => 0),
    supabase.from('activity_log').select('action, details, created_at, actor_role').order('created_at', { ascending: false }).limit(10).catch(() => ({ data: [] }))
  ]);
  const activity = activityRes?.data || [];

  const activityHTML = activity.length > 0
    ? activity.map(a => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text">${escapeHTML(a.action)}${a.details ? ' — ' + escapeHTML(a.details) : ''}</div>
            <div class="activity-time">${new Date(a.created_at).toLocaleString()} · ${escapeHTML(a.actor_role || '')}</div>
          </div>
        </div>
      `).join('')
    : '<p class="empty-state">No recent activity yet. Start by adding students, teachers, parents, or notices.</p>';

  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Students</div><div class="stat-value">${studentCount}</div></div>
      <div class="stat-card"><div class="stat-label">Teachers</div><div class="stat-value">${teacherCount}</div></div>
      <div class="stat-card"><div class="stat-label">Parents</div><div class="stat-value">${parentCount}</div></div>
      <div class="stat-card"><div class="stat-label">Notices</div><div class="stat-value">${noticeCount}</div></div>
    </div>
    <div class="section-title">JNV Management Modules</div>
    <div class="activity-list" style="margin-bottom:24px;">
      <div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><a href="students.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Students</a>, Teachers, Parents, Attendance, Grades, Timetable, Notices, and Houses are now available from the sidebar.</div><div class="activity-time">Complete JNV sidebar structure</div></div></div>
    </div>
    <div class="section-title">Recent Activity</div>
    <div class="activity-list">${activityHTML}</div>`;
}

loadDashboard();

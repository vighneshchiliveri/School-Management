import { supabase, requireSession, initLogout, escapeHTML } from './app-config.js';

const username = sessionStorage.getItem('username') || 'Principal';
const role = sessionStorage.getItem('role') || 'principal';
const welcome = document.getElementById('welcome-msg');
const title = document.getElementById('dashboard-title');
const content = document.getElementById('dashboard-content');

if (welcome) welcome.textContent = `Welcome back, ${username}`;
if (title && (role === 'principal' || role === 'admin')) title.textContent = 'Principal Dashboard';

initLogout();
renderDashboard({ students: 0, teachers: 0, parents: 0, notices: 0, activity: [] }, true);

startDashboard();

async function startDashboard() {
  try {
    await requireSession();
  } catch (error) {
    console.error('Session check failed:', error);
    showDashboardMessage('Unable to verify login session. Please sign out and login again.');
    return;
  }

  try {
    const [students, teachers, parents, notices, activity] = await Promise.all([
      tableCount('students'),
      tableCount('teachers'),
      tableCount('parents'),
      tableCount('notices'),
      recentActivity()
    ]);

    renderDashboard({ students, teachers, parents, notices, activity }, false);
  } catch (error) {
    console.error('Dashboard load failed:', error);
    showDashboardMessage('Dashboard opened, but live counts could not be loaded. Check Supabase tables/RLS if this continues.');
  }
}

async function withTimeout(promise, ms = 8000) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ data: null, count: 0, error: new Error('Request timed out') }), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timeoutId);
  return result;
}

async function tableCount(table) {
  try {
    const { count, error } = await withTimeout(
      supabase.from(table).select('*', { count: 'exact', head: true })
    );
    if (error) {
      console.warn(`${table} count error:`, error.message || error);
      return 0;
    }
    return count || 0;
  } catch (error) {
    console.warn(`${table} count failed:`, error.message || error);
    return 0;
  }
}

async function recentActivity() {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('activity_log')
        .select('action, details, created_at, actor_role')
        .order('created_at', { ascending: false })
        .limit(10)
    );
    if (error) {
      console.warn('activity_log error:', error.message || error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('activity_log failed:', error.message || error);
    return [];
  }
}

function renderDashboard(data, isInitial) {
  if (!content) return;

  const activityHTML = data.activity && data.activity.length > 0
    ? data.activity.map(a => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text">${escapeHTML(a.action)}${a.details ? ' — ' + escapeHTML(a.details) : ''}</div>
            <div class="activity-time">${formatActivityTime(a.created_at)}${a.actor_role ? ' · ' + escapeHTML(a.actor_role) : ''}</div>
          </div>
        </div>
      `).join('')
    : '<p class="empty-state">No recent activity yet. Start by adding students, teachers, parents, attendance, grades, timetable, notices, or house details.</p>';

  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Students</div><div class="stat-value">${Number(data.students) || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Teachers</div><div class="stat-value">${Number(data.teachers) || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Parents</div><div class="stat-value">${Number(data.parents) || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Notices</div><div class="stat-value">${Number(data.notices) || 0}</div></div>
    </div>

    <div class="section-title">JNV Management Modules</div>
    <div class="activity-list" style="margin-bottom:24px;">
      <div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><a href="students.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Students</a>, <a href="teachers.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Teachers</a>, <a href="parents.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Parents</a>, Attendance, Grades, Timetable, Notices, and Houses are available from the sidebar.</div><div class="activity-time">Complete JNV sidebar structure</div></div></div>
      ${isInitial ? '<p class="empty-state">Loading live dashboard counts...</p>' : ''}
    </div>

    <div class="section-title">Recent Activity</div>
    <div class="activity-list">${activityHTML}</div>`;
}

function showDashboardMessage(message) {
  if (!content) return;
  const note = document.createElement('div');
  note.className = 'activity-list';
  note.style.marginTop = '16px';
  note.innerHTML = `<p class="empty-state">${escapeHTML(message)}</p>`;
  content.appendChild(note);
}

function formatActivityTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHTML(value) : date.toLocaleString('en-IN');
}

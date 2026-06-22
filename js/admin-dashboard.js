import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth guard
const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '../index.html'; }

const username = sessionStorage.getItem('username') || 'Admin';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
});

// Load dashboard data
async function loadDashboard() {
  const content = document.getElementById('dashboard-content');

  const [
    { count: studentCount },
    { count: teacherCount },
    { count: parentCount },
    { data: activity }
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('parents').select('*', { count: 'exact', head: true }),
    supabase.from('activity_log').select('action, details, created_at, actor_role').order('created_at', { ascending: false }).limit(10)
  ]);

  const activityHTML = activity && activity.length > 0
    ? activity.map(a => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text">${a.action}${a.details ? ' — ' + a.details : ''}</div>
            <div class="activity-time">${new Date(a.created_at).toLocaleString()} · ${a.actor_role}</div>
          </div>
        </div>
      `).join('')
    : '<p class="empty-state">No recent activity yet.</p>';

  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Students</div>
        <div class="stat-value">${studentCount ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Teachers</div>
        <div class="stat-value">${teacherCount ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Parents</div>
        <div class="stat-value">${parentCount ?? 0}</div>
      </div>
    </div>
    <div class="section-title">Recent Activity</div>
    <div class="activity-list">${activityHTML}</div>
  `;
}

loadDashboard();

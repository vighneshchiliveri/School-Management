import { supabase, requireSession, initLogout } from './app-config.js';

await requireSession();
initLogout();

const username = sessionStorage.getItem('username') || 'Teacher';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

async function countStudents() {
  const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
  return count || 0;
}

async function loadDashboard() {
  const totalStudents = await countStudents().catch(() => 0);
  document.getElementById('dashboard-content').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Students</div><div class="stat-value">${totalStudents}</div></div>
      <div class="stat-card"><div class="stat-label">Attendance</div><div class="stat-value" style="font-size:1.1rem;">Ready</div></div>
      <div class="stat-card"><div class="stat-label">Grades</div><div class="stat-value" style="font-size:1.1rem;">Ready</div></div>
    </div>
    <div class="section-title">Teacher Work Area</div>
    <div class="activity-list">
      <div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text">Use the sidebar to view students, mark attendance, enter grades, view timetable, and read notices.</div><div class="activity-time">JNV teacher dashboard</div></div></div>
    </div>`;
}

loadDashboard();

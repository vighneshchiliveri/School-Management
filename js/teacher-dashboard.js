import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '../index.html'; }

const username = sessionStorage.getItem('username') || 'Teacher';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
});

document.getElementById('dashboard-content').innerHTML = `
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">My Classes</div>
      <div class="stat-value">—</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Students</div>
      <div class="stat-value">—</div>
    </div>
  </div>
  <div class="section-title">Coming soon</div>
  <div class="activity-list">
    <p class="empty-state">Classes, attendance, and grades will appear here once set up by admin.</p>
  </div>
`;

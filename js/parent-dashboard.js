import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '../index.html'; }

const username = sessionStorage.getItem('username') || 'Parent';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
});

async function loadDashboard() {
  const content = document.getElementById('dashboard-content');

  // Get parent record
  const { data: parent } = await supabase
    .from('parents')
    .select('id, full_name')
    .eq('auth_user_id', session.user.id)
    .single();

  if (!parent) {
    content.innerHTML = '<p style="color:#888;">Parent record not found. Contact admin.</p>';
    return;
  }

  // Get linked students
  const { data: links } = await supabase
    .from('parent_student_links')
    .select('student_id, students(full_name, class, section, roll_no)')
    .eq('parent_id', parent.id);

  const childCards = links && links.length > 0
    ? links.map(l => {
        const s = l.students;
        return `
          <div class="stat-card">
            <div class="stat-label">Class ${s.class}${s.section ? ' – ' + s.section : ''}</div>
            <div class="stat-value" style="font-size:1.1rem; margin-top:8px;">${s.full_name}</div>
            <div style="font-size:0.8rem; color:#888; margin-top:4px;">Roll No: ${s.roll_no || '—'}</div>
          </div>
        `;
      }).join('')
    : '<p style="color:#aaa; font-size:0.875rem;">No children linked yet. Contact the school office.</p>';

  content.innerHTML = `
    <div class="section-title">My Children</div>
    <div class="stat-grid" style="margin-bottom:28px;">${childCards}</div>
    <div class="section-title">Updates</div>
    <div class="activity-list">
      <p class="empty-state">Attendance and result updates will appear here.</p>
    </div>
  `;
}

loadDashboard();

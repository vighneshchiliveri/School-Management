import { supabase, requireSession, initLogout, escapeHTML } from './app-config.js';

const session = await requireSession();
initLogout();

const username = sessionStorage.getItem('username') || 'Parent';
document.getElementById('welcome-msg').textContent = `Welcome back, ${username}`;

async function loadDashboard() {
  const content = document.getElementById('dashboard-content');
  const { data: parent } = await supabase.from('parents').select('id, full_name').eq('username', username).single();
  if (!parent) {
    content.innerHTML = '<p style="color:#888;">Parent record not found. Contact the JNV office.</p>';
    return;
  }
  const { data: links } = await supabase
    .from('parent_student_links')
    .select('student_id, students(full_name, class, section, roll_no, house)')
    .eq('parent_id', parent.id);
  const children = (links || []).map(l => l.students).filter(Boolean);
  const childCards = children.length > 0
    ? children.map(s => `
        <div class="stat-card">
          <div class="stat-label">Class ${escapeHTML(s.class || '—')}${s.section ? ' – ' + escapeHTML(s.section) : ''}</div>
          <div class="stat-value" style="font-size:1.1rem; margin-top:8px;">${escapeHTML(s.full_name)}</div>
          <div style="font-size:0.8rem; color:#888; margin-top:4px;">Roll No: ${escapeHTML(s.roll_no || '—')} · ${escapeHTML(s.house || 'No House')}</div>
        </div>`).join('')
    : '<p style="color:#aaa; font-size:0.875rem;">No children linked yet. Contact the JNV office.</p>';

  content.innerHTML = `
    <div class="section-title">My Children</div>
    <div class="stat-grid" style="margin-bottom:28px;">${childCards}</div>
    <div class="section-title">Quick Links</div>
    <div class="activity-list">
      <div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><a href="my-children.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Open My Children</a></div><div class="activity-time">Profile and latest attendance</div></div></div>
      <div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><a href="notices.html" style="color:#1a3a5c; text-decoration:none; font-weight:700;">Open Notices</a></div><div class="activity-time">Published school updates</div></div></div>
    </div>`;
}

loadDashboard();

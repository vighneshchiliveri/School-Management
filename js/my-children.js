import { supabase, requireSession, initLogout, display, escapeHTML, formatDate, statusBadge, sortStudentsByRollOrAdmission } from './app-config.js';

const session = await requireSession();
initLogout();

const summary = document.getElementById('children-summary');
const list = document.getElementById('children-list');

async function loadChildren() {
  list.innerHTML = '<p class="empty-state">Loading children...</p>';
  const username = sessionStorage.getItem('username');
  let parentQuery = supabase.from('parents').select('id, full_name');
  if (username) parentQuery = parentQuery.eq('username', username);
  else parentQuery = parentQuery.eq('auth_user_id', session.user.id);
  const { data: parent, error: parentError } = await parentQuery.single();
  if (parentError || !parent) {
    list.innerHTML = '<p class="empty-state">Parent record not found. Contact the JNV office.</p>';
    summary.innerHTML = '';
    return;
  }

  const { data: links, error } = await supabase
    .from('parent_student_links')
    .select('student_id, students(*)')
    .eq('parent_id', parent.id);
  if (error) { list.innerHTML = `<p class="empty-state">${escapeHTML(error.message)}</p>`; return; }
  const children = sortStudentsByRollOrAdmission((links || []).map(l => l.students).filter(Boolean));
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Parent</div><div class="summary-value" style="font-size:1.05rem;">${display(parent.full_name)}</div></div>
    <div class="summary-tile"><div class="summary-label">Children Linked</div><div class="summary-value">${children.length}</div></div>`;

  if (!children.length) { list.innerHTML = '<p class="empty-state">No children linked yet. Contact the JNV office.</p>'; return; }
  const attendance = await latestAttendance(children.map(c => c.id));
  list.innerHTML = children.map(c => `<div class="module-card">
    <div class="module-card-title">${display(c.full_name)}</div>
    <div class="module-card-sub">Class ${display(c.class)} ${display(c.section)} · Roll No: ${display(c.roll_no)} · Adm. No: ${display(c.admission_no)} · ${display(c.house, 'No House')}</div>
    <div class="summary-strip" style="margin-top:14px; margin-bottom:0;">
      <div class="summary-tile"><div class="summary-label">Blood Group</div><div class="summary-value" style="font-size:1.1rem;">${display(c.blood_group)}</div></div>
      <div class="summary-tile"><div class="summary-label">Category</div><div class="summary-value" style="font-size:1.1rem;">${display(c.category)}</div></div>
      <div class="summary-tile"><div class="summary-label">Last Attendance</div><div class="summary-value" style="font-size:1.1rem;">${attendance[c.id] ? statusBadge(attendance[c.id].status) : '—'}</div><div class="hint-text">${attendance[c.id] ? formatDate(attendance[c.id].date) : ''}</div></div>
    </div>
  </div>`).join('');
}

async function latestAttendance(studentIds) {
  if (!studentIds.length) return {};
  const { data } = await supabase.from('attendance').select('student_id, date, status').in('student_id', studentIds).order('date', { ascending: false });
  const out = {};
  (data || []).forEach(a => { if (!out[a.student_id]) out[a.student_id] = a; });
  return out;
}

await loadChildren();

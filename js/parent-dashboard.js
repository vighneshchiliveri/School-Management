import { supabase, requireSession, initLogout, getProfile, escapeHTML, formatDate, statusBadge } from './app-config.js';

await requireSession(['parent']);
initLogout();
const profile = getProfile();
document.getElementById('welcome-msg').textContent = `Welcome back, ${profile?.full_name || profile?.username || 'Parent'}`;

const content = document.getElementById('dashboard-content');
const { data: links, error } = await supabase.from('parent_student_links')
  .select('student_id,students(id,full_name,class,section,roll_no,house,admission_no,is_archived)')
  .eq('parent_id', profile.id);

if (error) {
  content.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}</p>`;
} else {
  const children = (links || []).map(link => link.students).filter(child => child && !child.is_archived);
  const childIds = children.map(child => child.id);
  const [{ data: attendance }, { data: grades }, { data: notices }] = await Promise.all([
    childIds.length ? supabase.from('attendance').select('student_id,date,status').in('student_id', childIds).order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    childIds.length ? supabase.from('grades').select('student_id,exam_name,subject,grade,marks_obtained,max_marks,created_at').in('student_id', childIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('notices').select('title,audience,published_at,created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(5)
  ]);

  const latestAttendance = {};
  (attendance || []).forEach(row => { if (!latestAttendance[row.student_id]) latestAttendance[row.student_id] = row; });
  const latestGrade = {};
  (grades || []).forEach(row => { if (!latestGrade[row.student_id]) latestGrade[row.student_id] = row; });

  content.innerHTML = `
    <div class="stat-grid">
      <a class="stat-card" href="my-children.html"><div class="stat-label">Linked Children</div><div class="stat-value">${children.length}</div><div class="stat-detail">Open full profiles and progress</div></a>
      <a class="stat-card" href="notices.html"><div class="stat-label">Recent Notices</div><div class="stat-value">${(notices || []).length}</div><div class="stat-detail">Published school updates</div></a>
    </div>
    <div class="section-heading-row"><h2 class="section-title">My Children</h2><a class="text-link" href="my-children.html">View details</a></div>
    <div class="stat-grid">${children.length ? children.map(child => {
      const att = latestAttendance[child.id];
      const grade = latestGrade[child.id];
      return `<a class="stat-card" href="my-children.html"><div class="stat-label">Class ${escapeHTML(child.class || '—')}${child.section ? ` – ${escapeHTML(child.section)}` : ''}</div><div class="stat-value" style="font-size:1.1rem;">${escapeHTML(child.full_name)}</div><div class="stat-detail">Roll ${escapeHTML(child.roll_no || '—')} · ${escapeHTML(child.house || 'No House')}</div><div class="stat-detail">Latest attendance: ${att ? statusBadge(att.status) + ` · ${formatDate(att.date)}` : '—'}</div><div class="stat-detail">Latest grade: ${grade ? `${escapeHTML(grade.subject)} · ${escapeHTML(grade.grade || '—')}` : '—'}</div></a>`;
    }).join('') : '<p class="empty-state-card">No children are linked to this parent account. Contact the school office.</p>'}</div>
    <div class="section-heading-row"><h2 class="section-title">Recent Notices</h2></div>
    <div class="activity-list">${(notices || []).length ? notices.map(notice => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text">${escapeHTML(notice.title)} · ${escapeHTML(notice.audience || 'All')}</div><div class="activity-time">${formatDate(notice.published_at || notice.created_at)}</div></div></div>`).join('') : '<p class="empty-state">No notices.</p>'}</div>`;
}

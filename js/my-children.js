import {
  supabase, requireSession, initLogout, getProfile, display, escapeHTML,
  formatDate, statusBadge, sortStudentsByRollOrAdmission
} from './app-config.js';

await requireSession(['parent']);
initLogout();
const profile = getProfile();

const summary = document.getElementById('children-summary');
const list = document.getElementById('children-list');
list.innerHTML = '<p class="empty-state-card">Loading children…</p>';

const { data: links, error } = await supabase.from('parent_student_links')
  .select('student_id,students(*)')
  .eq('parent_id', profile.id);

if (error) {
  list.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}</p>`;
} else {
  const children = sortStudentsByRollOrAdmission((links || []).map(link => link.students).filter(child => child && !child.is_archived));
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Parent</div><div class="summary-value" style="font-size:1.05rem;">${display(profile.full_name)}</div></div>
    <div class="summary-tile"><div class="summary-label">Children Linked</div><div class="summary-value">${children.length}</div></div>`;

  if (!children.length) {
    list.innerHTML = '<p class="empty-state-card">No children are linked yet. Contact the JNV office.</p>';
  } else {
    const childIds = children.map(child => child.id);
    const [{ data: attendance }, { data: grades }] = await Promise.all([
      supabase.from('attendance').select('student_id,date,status,remarks').in('student_id', childIds).order('date', { ascending: false }),
      supabase.from('grades').select('student_id,exam_name,subject,marks_obtained,max_marks,grade,remarks,created_at').in('student_id', childIds).order('created_at', { ascending: false })
    ]);

    list.innerHTML = children.map(child => {
      const childAttendance = (attendance || []).filter(row => row.student_id === child.id);
      const present = childAttendance.filter(row => ['Present', 'Late'].includes(row.status)).length;
      const rate = childAttendance.length ? Math.round((present / childAttendance.length) * 100) : null;
      const latestAttendance = childAttendance[0];
      const childGrades = (grades || []).filter(row => row.student_id === child.id).slice(0, 5);
      return `<section class="module-card">
        <div class="module-card-title">${display(child.full_name)}</div>
        <div class="module-card-sub">Class ${display(child.class)} ${display(child.section)} · Roll No: ${display(child.roll_no)} · Adm. No: ${display(child.admission_no)} · ${display(child.house, 'No House')}</div>
        <div class="summary-strip" style="margin-top:14px;">
          <div class="summary-tile"><div class="summary-label">Attendance Rate</div><div class="summary-value">${rate === null ? '—' : rate + '%'}</div><div class="hint-text">${childAttendance.length} marked days</div></div>
          <div class="summary-tile"><div class="summary-label">Latest Attendance</div><div class="summary-value" style="font-size:1rem;">${latestAttendance ? statusBadge(latestAttendance.status) : '—'}</div><div class="hint-text">${latestAttendance ? formatDate(latestAttendance.date) : ''}</div></div>
          <div class="summary-tile"><div class="summary-label">Blood Group</div><div class="summary-value" style="font-size:1.1rem;">${display(child.blood_group)}</div></div>
          <div class="summary-tile"><div class="summary-label">Category</div><div class="summary-value" style="font-size:1.1rem;">${display(child.category)}</div></div>
        </div>
        <div class="panel-header"><div><h3 class="panel-title">Recent Grades</h3><p class="panel-subtitle">Latest five subject entries</p></div></div>
        <div class="activity-list">${childGrades.length ? childGrades.map(grade => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><strong>${display(grade.subject)}</strong> · ${display(grade.exam_name)} · ${display(grade.marks_obtained)}/${display(grade.max_marks)} · Grade ${display(grade.grade)}</div><div class="activity-time">${grade.remarks ? display(grade.remarks) : ''}</div></div></div>`).join('') : '<p class="empty-state">No grades have been published yet.</p>'}</div>
      </section>`;
    }).join('');
  }
}

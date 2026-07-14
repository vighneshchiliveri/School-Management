import {
  supabase, requireSession, initLogout, isPrincipal, display, escapeHTML,
  formatDate, statusBadge, showToast
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const params = new URLSearchParams(window.location.search);
const studentId = params.get('id');
if (!studentId) window.location.replace('students.html');

const profileContent = document.getElementById('profile-content');
const [{ data: student, error }, { data: attendance }, { data: grades }] = await Promise.all([
  supabase.from('students').select('*').eq('id', studentId).single(),
  supabase.from('attendance').select('date,status,remarks').eq('student_id', studentId).order('date', { ascending: false }).limit(10),
  supabase.from('grades').select('exam_name,subject,marks_obtained,max_marks,grade,remarks,created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(10)
]);

if (error || !student || student.is_archived) {
  profileContent.innerHTML = '<p class="empty-state-card">Student record not found or archived.</p>';
} else {
  document.getElementById('profile-name').textContent = student.full_name;
  if (!isPrincipal()) document.getElementById('edit-btn').style.display = 'none';

  const attendanceRows = attendance || [];
  const presentCount = attendanceRows.filter(row => row.status === 'Present').length;
  const attendanceRate = attendanceRows.length ? Math.round((presentCount / attendanceRows.length) * 100) : null;

  profileContent.innerHTML = `
    <div class="profile-card">
      <div class="profile-top"><div class="profile-photo" aria-hidden="true">👤</div><div>
        <div class="profile-name">${display(student.full_name)}</div>
        <div class="profile-sub">Class ${display(student.class)} – ${display(student.section)} · Roll No: ${display(student.roll_no)} · Adm: ${display(student.admission_no)}</div>
        <div class="record-meta">${student.house ? `<span class="meta-pill">${display(student.house)} House</span>` : ''}${student.category ? `<span class="meta-pill">${display(student.category)}</span>` : ''}</div>
      </div></div>
      <div class="profile-grid">
        ${profileField('Gender', student.gender)}${profileField('Date of Birth', student.date_of_birth ? formatDate(student.date_of_birth) : null)}
        ${profileField('Blood Group', student.blood_group)}${profileField('Category', student.category)}
        ${profileField("Father's Name", student.father_name)}${profileField("Mother's Name", student.mother_name)}
        ${isPrincipal() ? profileField('Parent Phone', student.parent_phone) + profileField('Address', student.address) : profileField('Contact Details', 'Restricted to Principal')}
      </div>
    </div>

    <div class="summary-strip">
      <div class="summary-tile"><div class="summary-label">Recent Attendance</div><div class="summary-value">${attendanceRate === null ? '—' : `${attendanceRate}%`}</div><div class="hint-text">Last ${attendanceRows.length} marked days</div></div>
      <div class="summary-tile"><div class="summary-label">Latest Status</div><div class="summary-value" style="font-size:1rem;">${attendanceRows[0] ? statusBadge(attendanceRows[0].status) : '—'}</div><div class="hint-text">${attendanceRows[0] ? formatDate(attendanceRows[0].date) : 'No attendance records'}</div></div>
      <div class="summary-tile"><div class="summary-label">Recent Grade Records</div><div class="summary-value">${(grades || []).length}</div></div>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel"><div class="panel-header"><div><h2 class="panel-title">Recent Attendance</h2><p class="panel-subtitle">Latest 10 marked days</p></div></div>
        <div class="activity-list">${attendanceRows.length ? attendanceRows.map(row => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text">${statusBadge(row.status)}${row.remarks ? ` · ${display(row.remarks)}` : ''}</div><div class="activity-time">${formatDate(row.date)}</div></div></div>`).join('') : '<p class="empty-state">No attendance records.</p>'}</div>
      </section>
      <section class="dashboard-panel"><div class="panel-header"><div><h2 class="panel-title">Recent Grades</h2><p class="panel-subtitle">Latest 10 entries</p></div></div>
        <div class="activity-list">${(grades || []).length ? grades.map(row => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><strong>${display(row.subject)}</strong> · ${display(row.exam_name)} · ${display(row.marks_obtained)}/${display(row.max_marks)} · Grade ${display(row.grade)}</div><div class="activity-time">${row.remarks ? display(row.remarks) : ''}</div></div></div>`).join('') : '<p class="empty-state">No grade records.</p>'}</div>
      </section>
    </div>`;

  fillIdCard(student);
  document.getElementById('print-id-btn').addEventListener('click', () => {
    document.getElementById('id-card-print').hidden = false;
    window.print();
    document.getElementById('id-card-print').hidden = true;
    showToast('ID card print dialog opened.', 'success');
  });
  document.getElementById('edit-btn').addEventListener('click', () => window.location.href = `students.html?edit=${encodeURIComponent(student.id)}`);
}

function profileField(label, value) {
  return `<div class="profile-field"><span class="profile-label">${escapeHTML(label)}</span><span class="profile-value">${display(value)}</span></div>`;
}

function fillIdCard(student) {
  document.getElementById('id-name').textContent = student.full_name;
  document.getElementById('id-adm').textContent = student.admission_no || '—';
  document.getElementById('id-class').textContent = `${student.class || '—'} – ${student.section || '—'}`;
  document.getElementById('id-roll').textContent = student.roll_no || '—';
  document.getElementById('id-house').textContent = student.house || '—';
  document.getElementById('id-blood').textContent = student.blood_group || '—';
  document.getElementById('id-category').textContent = student.category || '—';
}

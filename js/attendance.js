import {
  supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, todayISO, display,
  escapeHTML, fillSelect, sortStudentsByRollOrAdmission, showToast, setButtonLoading,
  logActivity, downloadCSV
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const dateInput = document.getElementById('attendance-date');
const classSelect = document.getElementById('filter-class');
const sectionSelect = document.getElementById('filter-section');
const list = document.getElementById('attendance-list');
const summary = document.getElementById('attendance-summary');
const saveBtn = document.getElementById('save-attendance-btn');
let students = [];
let existing = {};

const today = todayISO();
dateInput.value = today;
dateInput.max = today;
fillSelect(classSelect, JNV_CLASSES, 'Class');
fillSelect(sectionSelect, SECTIONS, 'Section');
addBulkActions();
addExportButton();

document.getElementById('load-students-btn').addEventListener('click', loadStudents);
saveBtn.addEventListener('click', saveAttendance);
dateInput.addEventListener('change', () => { if (students.length) loadStudents(); });

async function loadStudents() {
  const cls = classSelect.value;
  const section = sectionSelect.value;
  if (!cls || !section) { showToast('Select a class and section.', 'warning'); return; }
  if (!dateInput.value) { showToast('Select an attendance date.', 'warning'); return; }
  list.innerHTML = '<p class="empty-state-card">Loading students…</p>';

  const { data, error } = await supabase.from('students')
    .select('id,full_name,admission_no,class,section,roll_no,house,is_archived')
    .eq('class', cls).eq('section', section).order('admission_no', { ascending: true });
  if (error) { list.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}</p>`; return; }

  students = sortStudentsByRollOrAdmission((data || []).filter(student => !student.is_archived));
  const existingLoaded = await loadExistingAttendance();
  if (!existingLoaded) { students = []; summary.innerHTML = ''; list.innerHTML = '<p class="empty-state-card">Attendance was not loaded, so no changes can be saved. Refresh and try again.</p>'; return; }
  renderStudents();
}

async function loadExistingAttendance() {
  existing = {};
  if (!students.length) return true;
  const { data, error } = await supabase.from('attendance')
    .select('student_id,status,remarks')
    .eq('date', dateInput.value)
    .in('student_id', students.map(student => student.id));
  if (error) { showToast(`Existing attendance could not be loaded: ${error.message}`, 'error'); return false; }
  (data || []).forEach(row => { existing[row.student_id] = row; });
  return true;
}

function renderStudents() {
  if (!students.length) {
    summary.innerHTML = '';
    list.innerHTML = '<p class="empty-state-card">No active students found for this class and section.</p>';
    return;
  }
  list.innerHTML = students.map(student => {
    const saved = existing[student.id]?.status || 'Present';
    return `<div class="attendance-student" data-student-id="${student.id}">
      <div class="attendance-name">${display(student.full_name)}</div>
      <div class="attendance-meta">Adm: ${display(student.admission_no)} · Roll: ${display(student.roll_no)} · ${display(student.house, 'No House')}</div>
      <div class="attendance-options">
        ${['Present','Absent','Late','Leave'].map(status => `<label><input type="radio" name="status-${student.id}" value="${status}" ${saved === status ? 'checked' : ''}> ${status}</label>`).join('')}
      </div>
      <div class="field-group" style="margin-top:10px;"><label class="sr-only" for="remarks-${student.id}">Remarks for ${display(student.full_name)}</label><input id="remarks-${student.id}" class="remarks-input" placeholder="Remarks" value="${escapeHTML(existing[student.id]?.remarks || '')}"></div>
    </div>`;
  }).join('');
  list.querySelectorAll('input[type="radio"]').forEach(input => input.addEventListener('change', renderSummary));
  renderSummary();
}

function currentRows() {
  return students.map(student => {
    const card = list.querySelector(`[data-student-id="${student.id}"]`);
    return {
      student_id: student.id,
      full_name: student.full_name,
      admission_no: student.admission_no,
      roll_no: student.roll_no,
      date: dateInput.value,
      class: student.class,
      section: student.section,
      status: card?.querySelector(`input[name="status-${student.id}"]:checked`)?.value || 'Present',
      remarks: card?.querySelector('.remarks-input')?.value.trim() || null
    };
  });
}

function renderSummary() {
  const rows = currentRows();
  const totals = rows.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
  const presentEquivalent = (totals.Present || 0) + (totals.Late || 0);
  const percent = rows.length ? Math.round((presentEquivalent / rows.length) * 100) : 0;
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Students</div><div class="summary-value">${rows.length}</div></div>
    <div class="summary-tile"><div class="summary-label">Present</div><div class="summary-value">${totals.Present || 0}</div></div>
    <div class="summary-tile"><div class="summary-label">Absent</div><div class="summary-value">${totals.Absent || 0}</div></div>
    <div class="summary-tile"><div class="summary-label">Attendance Rate</div><div class="summary-value">${percent}%</div></div>`;
}

async function saveAttendance() {
  if (!students.length) { showToast('Load students before saving attendance.', 'warning'); return; }
  const rows = currentRows().map(({ full_name, admission_no, roll_no, ...row }) => row);
  setButtonLoading(saveBtn, true, 'Saving…');
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
  setButtonLoading(saveBtn, false);
  if (error) {
    showToast(`Attendance was not saved: ${error.message}. Confirm the unique student_id/date constraint in the updated schema.`, 'error', 7000);
    return;
  }
  await logActivity('Attendance submitted', `Class ${classSelect.value}${sectionSelect.value} · ${dateInput.value} · ${rows.length} students`);
  showToast('Attendance saved successfully.', 'success');
  await loadExistingAttendance();
  renderStudents();
}

function addBulkActions() {
  const moduleCard = document.querySelector('.module-card');
  const bar = document.createElement('div');
  bar.className = 'bulk-action-bar';
  bar.innerHTML = '<span class="hint-text">Bulk mark:</span><button type="button" class="btn-ghost" data-bulk="Present">All Present</button><button type="button" class="btn-ghost" data-bulk="Absent">All Absent</button><button type="button" class="btn-ghost" data-bulk="Leave">All Leave</button>';
  moduleCard.insertAdjacentElement('afterend', bar);
  bar.querySelectorAll('[data-bulk]').forEach(button => button.addEventListener('click', () => {
    if (!students.length) { showToast('Load students first.', 'warning'); return; }
    list.querySelectorAll(`input[type="radio"][value="${button.dataset.bulk}"]`).forEach(input => { input.checked = true; });
    renderSummary();
  }));
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  const button = document.createElement('button');
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    const rows = currentRows();
    if (!rows.length) { showToast('Load attendance records before exporting.', 'warning'); return; }
    downloadCSV(`attendance-${dateInput.value}-${classSelect.value}${sectionSelect.value}.csv`, rows, [
      { label: 'Date', value: 'date' }, { label: 'Class', value: 'class' }, { label: 'Section', value: 'section' },
      { label: 'Roll No', value: 'roll_no' }, { label: 'Admission No', value: 'admission_no' }, { label: 'Student', value: 'full_name' },
      { label: 'Status', value: 'status' }, { label: 'Remarks', value: 'remarks' }
    ]);
    showToast('Attendance CSV exported.', 'success');
  });
  actions?.appendChild(button);
}

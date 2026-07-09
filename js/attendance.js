import { supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, todayISO, display, escapeHTML, fillSelect, canWrite } from './app-config.js';

await requireSession();
initLogout();

const dateInput = document.getElementById('attendance-date');
const classSelect = document.getElementById('filter-class');
const sectionSelect = document.getElementById('filter-section');
const list = document.getElementById('attendance-list');
const summary = document.getElementById('attendance-summary');
const saveBtn = document.getElementById('save-attendance-btn');
let students = [];
let existing = {};

dateInput.value = todayISO();
fillSelect(classSelect, JNV_CLASSES, 'Class');
fillSelect(sectionSelect, SECTIONS, 'Section');

if (!canWrite()) saveBtn.style.display = 'none';

document.getElementById('load-students-btn').addEventListener('click', loadStudents);
saveBtn.addEventListener('click', saveAttendance);

async function loadStudents() {
  const cls = classSelect.value;
  const section = sectionSelect.value;
  if (!cls || !section) { alert('Please select class and section.'); return; }
  list.innerHTML = '<p class="empty-state">Loading students...</p>';

  const { data, error } = await supabase.from('students')
    .select('id, full_name, admission_no, class, section, roll_no, house')
    .eq('class', cls)
    .eq('section', section)
    .order('roll_no', { ascending: true });

  if (error) { list.innerHTML = `<p class="empty-state">${escapeHTML(error.message)}</p>`; return; }
  students = data || [];
  await loadExistingAttendance();
  renderStudents();
}

async function loadExistingAttendance() {
  existing = {};
  if (!students.length) return;
  const { data } = await supabase.from('attendance')
    .select('student_id, status, remarks')
    .eq('date', dateInput.value)
    .in('student_id', students.map(s => s.id));
  (data || []).forEach(row => existing[row.student_id] = row);
}

function renderStudents() {
  const totals = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  if (!students.length) {
    summary.innerHTML = '';
    list.innerHTML = '<p class="empty-state">No students found for this class/section.</p>';
    return;
  }
  list.innerHTML = students.map(s => {
    const saved = existing[s.id]?.status || 'Present';
    totals[saved] = (totals[saved] || 0) + 1;
    return `
      <div class="attendance-student" data-student-id="${s.id}">
        <div class="attendance-name">${display(s.full_name)}</div>
        <div class="attendance-meta">Adm: ${display(s.admission_no)} · Roll: ${display(s.roll_no)} · ${display(s.house, 'No House')}</div>
        <div class="attendance-options">
          ${['Present','Absent','Late','Leave'].map(status => `<label><input type="radio" name="status-${s.id}" value="${status}" ${saved === status ? 'checked' : ''}/> ${status}</label>`).join('')}
        </div>
        <div class="field-group" style="margin-top:10px;"><input class="remarks-input" placeholder="Remarks" value="${escapeHTML(existing[s.id]?.remarks || '')}" /></div>
      </div>`;
  }).join('');
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Students</div><div class="summary-value">${students.length}</div></div>
    <div class="summary-tile"><div class="summary-label">Present</div><div class="summary-value">${totals.Present || 0}</div></div>
    <div class="summary-tile"><div class="summary-label">Absent</div><div class="summary-value">${totals.Absent || 0}</div></div>
    <div class="summary-tile"><div class="summary-label">Late / Leave</div><div class="summary-value">${(totals.Late || 0) + (totals.Leave || 0)}</div></div>`;
}

async function saveAttendance() {
  if (!students.length) { alert('Load students first.'); return; }
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  const rows = students.map(s => {
    const card = list.querySelector(`[data-student-id="${s.id}"]`);
    return {
      student_id: s.id,
      date: dateInput.value,
      class: s.class,
      section: s.section,
      status: card.querySelector(`input[name="status-${s.id}"]:checked`).value,
      remarks: card.querySelector('.remarks-input').value.trim() || null
    };
  });

  let { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
  if (error) {
    // Fallback for projects without a unique constraint on student_id/date.
    await supabase.from('attendance').delete().eq('date', dateInput.value).in('student_id', students.map(s => s.id));
    ({ error } = await supabase.from('attendance').insert(rows));
  }
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Attendance';
  if (error) { alert('Error: ' + error.message); return; }
  alert('Attendance saved successfully.');
  await loadExistingAttendance();
  renderStudents();
}

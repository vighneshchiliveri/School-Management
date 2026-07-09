import { supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, display, escapeHTML, fillSelect, canWrite } from './app-config.js';

await requireSession();
initLogout();

const tbody = document.getElementById('grades-tbody');
const classSelect = document.getElementById('filter-class');
const sectionSelect = document.getElementById('filter-section');
const saveBtn = document.getElementById('save-grades-btn');
let students = [];
let existing = {};

fillSelect(classSelect, JNV_CLASSES, 'Class');
fillSelect(sectionSelect, SECTIONS, 'Section');
if (!canWrite()) saveBtn.style.display = 'none';

document.getElementById('load-students-btn').addEventListener('click', loadStudents);
saveBtn.addEventListener('click', saveGrades);

async function loadStudents() {
  const cls = classSelect.value;
  const section = sectionSelect.value;
  const exam = document.getElementById('exam-name').value.trim();
  const subject = document.getElementById('subject-name').value.trim();
  if (!cls || !section) { alert('Please select class and section.'); return; }
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading students...</td></tr>';
  const { data, error } = await supabase.from('students')
    .select('id, admission_no, full_name, roll_no, class, section')
    .eq('class', cls).eq('section', section).order('roll_no', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="table-empty">${escapeHTML(error.message)}</td></tr>`; return; }
  students = data || [];
  existing = {};
  if (students.length && exam && subject) {
    const { data: grades } = await supabase.from('grades').select('student_id, marks_obtained, grade, remarks').eq('exam_name', exam).eq('subject', subject).in('student_id', students.map(s => s.id));
    (grades || []).forEach(g => existing[g.student_id] = g);
  }
  renderRows();
}

function calcGrade(marks, max) {
  const pct = max > 0 ? Number(marks) / Number(max) * 100 : 0;
  if (pct >= 90) return 'A1';
  if (pct >= 80) return 'A2';
  if (pct >= 70) return 'B1';
  if (pct >= 60) return 'B2';
  if (pct >= 50) return 'C1';
  if (pct >= 40) return 'C2';
  return 'D';
}

function renderRows() {
  if (!students.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No students found.</td></tr>'; return; }
  tbody.innerHTML = students.map(s => {
    const gradeRow = existing[s.id] || {};
    return `<tr data-student-id="${s.id}">
      <td>${display(s.admission_no)}</td>
      <td><strong>${display(s.full_name)}</strong></td>
      <td>${display(s.roll_no)}</td>
      <td><input class="grade-input marks-input" type="number" min="0" value="${gradeRow.marks_obtained ?? ''}" /></td>
      <td><input class="grade-input final-grade-input" value="${display(gradeRow.grade, '')}" /></td>
      <td><input class="filter-input remarks-input" value="${display(gradeRow.remarks, '')}" placeholder="Remarks" /></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.marks-input').forEach(input => input.addEventListener('input', () => {
    const max = Number(document.getElementById('max-marks').value || 100);
    const row = input.closest('tr');
    row.querySelector('.final-grade-input').value = input.value === '' ? '' : calcGrade(input.value, max);
  }));
}

async function saveGrades() {
  const exam = document.getElementById('exam-name').value.trim();
  const subject = document.getElementById('subject-name').value.trim();
  const maxMarks = Number(document.getElementById('max-marks').value || 100);
  if (!students.length) { alert('Load students first.'); return; }
  if (!exam || !subject) { alert('Please enter exam and subject.'); return; }
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  const rows = [...tbody.querySelectorAll('tr[data-student-id]')].map(row => {
    const student = students.find(s => String(s.id) === String(row.dataset.studentId));
    return {
      student_id: row.dataset.studentId,
      exam_name: exam,
      subject,
      class: student.class,
      section: student.section,
      marks_obtained: row.querySelector('.marks-input').value === '' ? null : Number(row.querySelector('.marks-input').value),
      max_marks: maxMarks,
      grade: row.querySelector('.final-grade-input').value.trim() || null,
      remarks: row.querySelector('.remarks-input').value.trim() || null
    };
  });
  let { error } = await supabase.from('grades').upsert(rows, { onConflict: 'student_id,exam_name,subject' });
  if (error) {
    await supabase.from('grades').delete().eq('exam_name', exam).eq('subject', subject).in('student_id', students.map(s => s.id));
    ({ error } = await supabase.from('grades').insert(rows));
  }
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Grades';
  if (error) { alert('Error: ' + error.message); return; }
  alert('Grades saved successfully.');
}

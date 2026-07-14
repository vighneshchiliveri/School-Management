import {
  supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, display, escapeHTML,
  fillSelect, sortStudentsByRollOrAdmission, showToast, setButtonLoading,
  logActivity, downloadCSV
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const tbody = document.getElementById('grades-tbody');
const classSelect = document.getElementById('filter-class');
const sectionSelect = document.getElementById('filter-section');
const saveBtn = document.getElementById('save-grades-btn');
let students = [];
let existing = {};

fillSelect(classSelect, JNV_CLASSES, 'Class');
fillSelect(sectionSelect, SECTIONS, 'Section');
addExportButton();

document.getElementById('load-students-btn').addEventListener('click', loadStudents);
saveBtn.addEventListener('click', saveGrades);

async function loadStudents() {
  const cls = classSelect.value;
  const section = sectionSelect.value;
  const exam = document.getElementById('exam-name').value.trim();
  const subject = document.getElementById('subject-name').value.trim();
  const maxMarks = Number(document.getElementById('max-marks').value);
  if (!cls || !section) { showToast('Select a class and section.', 'warning'); return; }
  if (!exam || !subject) { showToast('Enter the exam and subject before loading students.', 'warning'); return; }
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) { showToast('Maximum marks must be greater than zero.', 'warning'); return; }

  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading students…</td></tr>';
  const { data, error } = await supabase.from('students')
    .select('id,admission_no,full_name,roll_no,class,section,is_archived')
    .eq('class', cls).eq('section', section).order('admission_no', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="table-empty">${escapeHTML(error.message)}</td></tr>`; return; }

  students = sortStudentsByRollOrAdmission((data || []).filter(student => !student.is_archived));
  existing = {};
  if (students.length) {
    const { data: grades, error: gradesError } = await supabase.from('grades')
      .select('student_id,marks_obtained,max_marks,grade,remarks')
      .eq('exam_name', exam).eq('subject', subject)
      .in('student_id', students.map(student => student.id));
    if (gradesError) {
      showToast(`Existing marks could not be loaded: ${gradesError.message}`, 'error');
      students = [];
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Marks were not loaded, so no changes can be saved. Refresh and try again.</td></tr>';
      return;
    }
    (grades || []).forEach(row => { existing[row.student_id] = row; });
  }
  renderRows(maxMarks);
}

function renderRows(maxMarks) {
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No active students found for this class and section.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(student => {
    const saved = existing[student.id] || {};
    const marks = saved.marks_obtained ?? '';
    const grade = saved.grade || (marks !== '' ? gradeFor(Number(marks), Number(saved.max_marks || maxMarks)) : '—');
    return `<tr data-student-id="${student.id}">
      <td>${display(student.admission_no)}</td><td><strong>${display(student.full_name)}</strong></td><td>${display(student.roll_no)}</td>
      <td><input class="grade-input marks-input" type="number" min="0" max="${maxMarks}" step="0.01" value="${escapeHTML(marks)}" aria-label="Marks for ${display(student.full_name)}"></td>
      <td class="computed-grade">${display(grade)}</td>
      <td><input class="filter-input remarks-input" value="${escapeHTML(saved.remarks || '')}" placeholder="Remarks" aria-label="Remarks for ${display(student.full_name)}"></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.marks-input').forEach(input => input.addEventListener('input', () => updateComputedGrade(input, maxMarks)));
}

function updateComputedGrade(input, maxMarks) {
  const value = input.value === '' ? null : Number(input.value);
  input.classList.toggle('invalid-field', value !== null && (!Number.isFinite(value) || value < 0 || value > maxMarks));
  const gradeCell = input.closest('tr').querySelector('.computed-grade');
  gradeCell.textContent = value === null || input.classList.contains('invalid-field') ? '—' : gradeFor(value, maxMarks);
}

function gradeFor(marks, maxMarks) {
  const percent = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
  if (percent >= 91) return 'A1';
  if (percent >= 81) return 'A2';
  if (percent >= 71) return 'B1';
  if (percent >= 61) return 'B2';
  if (percent >= 51) return 'C1';
  if (percent >= 41) return 'C2';
  if (percent >= 33) return 'D';
  return 'E';
}

function getGradeRows(includeStudentFields = false) {
  const exam = document.getElementById('exam-name').value.trim();
  const subject = document.getElementById('subject-name').value.trim();
  const maxMarks = Number(document.getElementById('max-marks').value);
  return students.map(student => {
    const row = tbody.querySelector(`[data-student-id="${student.id}"]`);
    const rawMarks = row?.querySelector('.marks-input').value;
    const marks = rawMarks === '' ? null : Number(rawMarks);
    const base = {
      student_id: student.id, exam_name: exam, subject,
      class: student.class, section: student.section,
      marks_obtained: marks, max_marks: maxMarks,
      grade: marks === null ? null : gradeFor(marks, maxMarks),
      remarks: row?.querySelector('.remarks-input').value.trim() || null
    };
    return includeStudentFields ? { ...base, full_name: student.full_name, admission_no: student.admission_no, roll_no: student.roll_no } : base;
  });
}

async function saveGrades() {
  if (!students.length) { showToast('Load students before saving grades.', 'warning'); return; }
  const maxMarks = Number(document.getElementById('max-marks').value);
  const rows = getGradeRows();
  const invalid = rows.find(row => row.marks_obtained !== null && (!Number.isFinite(row.marks_obtained) || row.marks_obtained < 0 || row.marks_obtained > maxMarks));
  if (invalid) { showToast(`Marks must be between 0 and ${maxMarks}.`, 'warning'); return; }

  setButtonLoading(saveBtn, true, 'Saving…');
  const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'student_id,exam_name,subject' });
  setButtonLoading(saveBtn, false);
  if (error) {
    showToast(`Grades were not saved: ${error.message}. Confirm the unique student/exam/subject constraint in the updated schema.`, 'error', 7000);
    return;
  }
  await logActivity('Grades submitted', `${rows[0].exam_name} · ${rows[0].subject} · Class ${classSelect.value}${sectionSelect.value}`);
  showToast('Grades saved successfully.', 'success');
  await loadStudents();
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  const button = document.createElement('button');
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    const rows = getGradeRows(true);
    if (!rows.length) { showToast('Load grade records before exporting.', 'warning'); return; }
    downloadCSV(`grades-${rows[0].exam_name}-${rows[0].subject}-${classSelect.value}${sectionSelect.value}.csv`, rows, [
      { label: 'Exam', value: 'exam_name' }, { label: 'Subject', value: 'subject' }, { label: 'Class', value: 'class' },
      { label: 'Section', value: 'section' }, { label: 'Roll No', value: 'roll_no' }, { label: 'Admission No', value: 'admission_no' },
      { label: 'Student', value: 'full_name' }, { label: 'Marks', value: 'marks_obtained' }, { label: 'Max Marks', value: 'max_marks' },
      { label: 'Grade', value: 'grade' }, { label: 'Remarks', value: 'remarks' }
    ]);
    showToast('Grades CSV exported.', 'success');
  });
  actions?.appendChild(button);
}

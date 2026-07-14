import {
  supabase, requireSession, initLogout, JNV_HOUSES, display, escapeHTML, fillSelect,
  showTableError, sortStudentsByRollOrAdmission, isPrincipal, downloadCSV, showToast
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const grid = document.getElementById('houses-grid');
const summary = document.getElementById('house-summary');
const tbody = document.getElementById('house-students-tbody');
const houseFilter = document.getElementById('filter-house');
let currentStudents = [];

fillSelect(houseFilter, JNV_HOUSES, 'All Houses');
houseFilter.addEventListener('change', loadStudents);
document.getElementById('clear-filters-btn').addEventListener('click', () => { houseFilter.value = ''; loadStudents(); });
addExportButton();

async function loadHouses() {
  const { data: students, error } = await supabase.from('students').select('id,house,gender,class,section,roll_no,admission_no,full_name,is_archived');
  if (error) { grid.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}</p>`; return; }
  const { data: teachers } = await supabase.from('teachers').select('full_name,house,designation,status,is_archived');
  const activeStudents = (students || []).filter(student => !student.is_archived);
  const activeTeachers = (teachers || []).filter(teacher => !teacher.is_archived && (!teacher.status || teacher.status === 'Active'));
  const counts = {};
  JNV_HOUSES.forEach(house => { counts[house] = { total: 0, male: 0, female: 0, master: '—' }; });
  activeStudents.forEach(student => {
    if (!counts[student.house]) return;
    counts[student.house].total++;
    if (student.gender === 'Male') counts[student.house].male++;
    if (student.gender === 'Female') counts[student.house].female++;
  });
  activeTeachers.forEach(teacher => { if (counts[teacher.house] && counts[teacher.house].master === '—') counts[teacher.house].master = teacher.full_name; });

  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Houses</div><div class="summary-value">${JNV_HOUSES.length}</div></div>
    <div class="summary-tile"><div class="summary-label">House Students</div><div class="summary-value">${Object.values(counts).reduce((sum, house) => sum + house.total, 0)}</div></div>
    <div class="summary-tile"><div class="summary-label">House Masters</div><div class="summary-value">${Object.values(counts).filter(house => house.master !== '—').length}</div></div>`;
  grid.innerHTML = JNV_HOUSES.map(house => `<div class="house-card">
    <div class="house-name">${display(house)} House</div>
    <div class="house-meta">House Master: <strong>${display(counts[house].master)}</strong></div>
    <div class="house-meta">Total Students: <strong>${counts[house].total}</strong></div>
    <div class="house-meta">Boys: ${counts[house].male} · Girls: ${counts[house].female}</div>
  </div>`).join('');
}

async function loadStudents() {
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading students…</td></tr>';
  let query = supabase.from('students').select('admission_no,full_name,class,section,roll_no,parent_phone,house,is_archived');
  if (houseFilter.value) query = query.eq('house', houseFilter.value);
  query = query.order('house', { ascending: true }).order('class', { ascending: true }).order('admission_no', { ascending: true });
  const { data, error } = await query;
  if (error) { showTableError(tbody, 6, error, 'students'); return; }
  currentStudents = sortStudentsByRollOrAdmission((data || []).filter(student => !student.is_archived));
  if (!currentStudents.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No students found.</td></tr>'; return; }
  tbody.innerHTML = currentStudents.map(student => `<tr><td>${display(student.admission_no)}</td><td><strong>${display(student.full_name)}</strong><div class="hint-text">${display(student.house, '')}</div></td><td>${display(student.class)}</td><td>${display(student.section)}</td><td>${display(student.roll_no)}</td><td>${isPrincipal() ? display(student.parent_phone) : 'Restricted'}</td></tr>`).join('');
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  const button = document.createElement('button');
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    if (!currentStudents.length) { showToast('No house student records to export.', 'warning'); return; }
    const columns = [
      { label: 'House', value: 'house' }, { label: 'Admission No', value: 'admission_no' }, { label: 'Student', value: 'full_name' },
      { label: 'Class', value: 'class' }, { label: 'Section', value: 'section' }, { label: 'Roll No', value: 'roll_no' }
    ];
    if (isPrincipal()) columns.push({ label: 'Parent Phone', value: 'parent_phone' });
    downloadCSV('jnv-house-students.csv', currentStudents, columns);
    showToast('House student CSV exported.', 'success');
  });
  actions?.appendChild(button);
}

await loadHouses();
await loadStudents();

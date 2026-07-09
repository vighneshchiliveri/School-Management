import { supabase, requireSession, initLogout, JNV_HOUSES, display, fillSelect, showTableError, sortStudentsByRollOrAdmission } from './app-config.js';

await requireSession();
initLogout();

const grid = document.getElementById('houses-grid');
const summary = document.getElementById('house-summary');
const tbody = document.getElementById('house-students-tbody');
const houseFilter = document.getElementById('filter-house');

fillSelect(houseFilter, JNV_HOUSES, 'All Houses');
houseFilter.addEventListener('change', loadStudents);
document.getElementById('clear-filters-btn').addEventListener('click', () => { houseFilter.value = ''; loadStudents(); });

async function loadHouses() {
  const { data: students, error } = await supabase.from('students').select('id, house, gender, class, section, roll_no, admission_no, full_name');
  if (error) {
    grid.innerHTML = `<p class="empty-state">${error.message}</p>`;
    return;
  }
  const { data: teachers } = await supabase.from('teachers').select('full_name, house, designation');
  const counts = {};
  JNV_HOUSES.forEach(h => counts[h] = { total: 0, male: 0, female: 0, master: '—' });
  (students || []).forEach(s => {
    if (!counts[s.house]) return;
    counts[s.house].total++;
    if (s.gender === 'Male') counts[s.house].male++;
    if (s.gender === 'Female') counts[s.house].female++;
  });
  (teachers || []).forEach(t => {
    if (counts[t.house] && counts[t.house].master === '—') counts[t.house].master = t.full_name;
  });
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Houses</div><div class="summary-value">${JNV_HOUSES.length}</div></div>
    <div class="summary-tile"><div class="summary-label">House Students</div><div class="summary-value">${Object.values(counts).reduce((a,b)=>a+b.total,0)}</div></div>
    <div class="summary-tile"><div class="summary-label">House Masters</div><div class="summary-value">${Object.values(counts).filter(x => x.master !== '—').length}</div></div>`;
  grid.innerHTML = JNV_HOUSES.map(h => `<div class="house-card">
    <div class="house-name">${display(h)} House</div>
    <div class="house-meta">House Master: <strong>${display(counts[h].master)}</strong></div>
    <div class="house-meta">Total Students: <strong>${counts[h].total}</strong></div>
    <div class="house-meta">Boys: ${counts[h].male} · Girls: ${counts[h].female}</div>
  </div>`).join('');
}

async function loadStudents() {
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading students...</td></tr>';
  let query = supabase.from('students').select('admission_no, full_name, class, section, roll_no, parent_phone, house');
  if (houseFilter.value) query = query.eq('house', houseFilter.value);
  query = query.order('house', { ascending: true }).order('class', { ascending: true }).order('admission_no', { ascending: true });
  const { data, error } = await query;
  if (error) { showTableError(tbody, 6, error, 'students'); return; }
  const sortedStudents = sortStudentsByRollOrAdmission(data || []);
  if (!sortedStudents.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No students found.</td></tr>'; return; }
  tbody.innerHTML = sortedStudents.map(s => `<tr><td>${display(s.admission_no)}</td><td><strong>${display(s.full_name)}</strong><div class="hint-text">${display(s.house, '')}</div></td><td>${display(s.class)}</td><td>${display(s.section)}</td><td>${display(s.roll_no)}</td><td>${display(s.parent_phone)}</td></tr>`).join('');
}

await loadHouses();
await loadStudents();

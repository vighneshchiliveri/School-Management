import { supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, WEEK_DAYS, PERIODS, display, escapeHTML, fillSelect, canWrite, showTableError } from './app-config.js';

await requireSession();
initLogout();

const tbody = document.getElementById('timetable-tbody');
const addBtn = document.getElementById('add-period-btn');

['class-input','filter-class'].forEach(id => fillSelect(document.getElementById(id), JNV_CLASSES, id === 'filter-class' ? 'All Classes' : 'Class'));
['section-input','filter-section'].forEach(id => fillSelect(document.getElementById(id), SECTIONS, id === 'filter-section' ? 'All Sections' : 'Section'));
['day-input','filter-day'].forEach(id => fillSelect(document.getElementById(id), WEEK_DAYS, id === 'filter-day' ? 'All Days' : 'Day'));
fillSelect(document.getElementById('period-input'), PERIODS, 'Period');

if (!canWrite()) addBtn.style.display = 'none';

addBtn.addEventListener('click', addPeriod);
['filter-class','filter-section','filter-day'].forEach(id => document.getElementById(id).addEventListener('change', loadTimetable));
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  ['filter-class','filter-section','filter-day'].forEach(id => document.getElementById(id).value = '');
  loadTimetable();
});

async function addPeriod() {
  const payload = {
    class: document.getElementById('class-input').value,
    section: document.getElementById('section-input').value,
    day: document.getElementById('day-input').value,
    period_no: Number(document.getElementById('period-input').value),
    subject: document.getElementById('subject-input').value.trim(),
    teacher_name: document.getElementById('teacher-input').value.trim() || null
  };
  if (!payload.class || !payload.section || !payload.day || !payload.period_no || !payload.subject) {
    alert('Please fill class, section, day, period, and subject.');
    return;
  }
  addBtn.disabled = true;
  addBtn.textContent = 'Saving...';
  const { error } = await supabase.from('timetable').insert(payload);
  addBtn.disabled = false;
  addBtn.textContent = 'Save Period';
  if (error) { alert('Error: ' + error.message); return; }
  document.getElementById('subject-input').value = '';
  document.getElementById('teacher-input').value = '';
  await loadTimetable();
}

async function loadTimetable() {
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading timetable...</td></tr>';
  let query = supabase.from('timetable').select('*');
  if (document.getElementById('filter-class').value) query = query.eq('class', document.getElementById('filter-class').value);
  if (document.getElementById('filter-section').value) query = query.eq('section', document.getElementById('filter-section').value);
  if (document.getElementById('filter-day').value) query = query.eq('day', document.getElementById('filter-day').value);
  query = query.order('class', { ascending: true }).order('section', { ascending: true }).order('day', { ascending: true }).order('period_no', { ascending: true });
  const { data, error } = await query;
  if (error) { showTableError(tbody, 7, error, 'timetable'); return; }
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No timetable periods found.</td></tr>'; return; }
  tbody.innerHTML = data.map(row => `<tr>
    <td>${display(row.class)}</td><td>${display(row.section)}</td><td>${display(row.day)}</td><td>${display(row.period_no)}</td>
    <td><strong>${display(row.subject)}</strong></td><td>${display(row.teacher_name || row.teacher)}</td>
    <td>${canWrite() ? `<button class="action-btn action-delete" data-id="${row.id}">Delete</button>` : '—'}</td>
  </tr>`).join('');
  tbody.querySelectorAll('.action-delete').forEach(btn => btn.addEventListener('click', () => deletePeriod(btn.dataset.id)));
}

async function deletePeriod(id) {
  if (!confirm('Delete this timetable period?')) return;
  const { error } = await supabase.from('timetable').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await loadTimetable();
}

await loadTimetable();

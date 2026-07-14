import {
  supabase, requireSession, initLogout, JNV_CLASSES, SECTIONS, WEEK_DAYS, PERIODS,
  display, fillSelect, showTableError, showToast, setButtonLoading, confirmAction,
  logActivity, downloadCSV
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const tbody = document.getElementById('timetable-tbody');
const addBtn = document.getElementById('add-period-btn');
let currentRows = [];

['class-input','filter-class'].forEach(id => fillSelect(document.getElementById(id), JNV_CLASSES, id === 'filter-class' ? 'All Classes' : 'Class'));
['section-input','filter-section'].forEach(id => fillSelect(document.getElementById(id), SECTIONS, id === 'filter-section' ? 'All Sections' : 'Section'));
['day-input','filter-day'].forEach(id => fillSelect(document.getElementById(id), WEEK_DAYS, id === 'filter-day' ? 'All Days' : 'Day'));
fillSelect(document.getElementById('period-input'), PERIODS, 'Period');
addExportButton();

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
    teacher_name: document.getElementById('teacher-input').value.trim() || null,
    is_archived: false,
    archived_at: null
  };
  if (!payload.class || !payload.section || !payload.day || !payload.period_no || !payload.subject) {
    showToast('Fill class, section, day, period, and subject.', 'warning');
    return;
  }

  setButtonLoading(addBtn, true, 'Saving…');
  const { data: existing, error: lookupError } = await supabase.from('timetable')
    .select('id')
    .eq('class', payload.class)
    .eq('section', payload.section)
    .eq('day', payload.day)
    .eq('period_no', payload.period_no)
    .eq('is_archived', false)
    .limit(1);
  let error = lookupError;
  if (!error) {
    if (existing?.[0]) ({ error } = await supabase.from('timetable').update(payload).eq('id', existing[0].id));
    else ({ error } = await supabase.from('timetable').insert(payload));
  }
  setButtonLoading(addBtn, false);
  if (error) { showToast(`Period could not be saved: ${error.message}. Run the updated schema and confirm this teacher has Class Access.`, 'error', 7000); return; }

  await logActivity('Timetable period saved', `Class ${payload.class}${payload.section} · ${payload.day} P${payload.period_no} · ${payload.subject}`);
  showToast('Timetable period saved.', 'success');
  document.getElementById('subject-input').value = '';
  document.getElementById('teacher-input').value = '';
  await loadTimetable();
}

async function loadTimetable() {
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading timetable…</td></tr>';
  let query = supabase.from('timetable').select('*');
  if (document.getElementById('filter-class').value) query = query.eq('class', document.getElementById('filter-class').value);
  if (document.getElementById('filter-section').value) query = query.eq('section', document.getElementById('filter-section').value);
  if (document.getElementById('filter-day').value) query = query.eq('day', document.getElementById('filter-day').value);
  query = query.order('class', { ascending: true }).order('section', { ascending: true }).order('day', { ascending: true }).order('period_no', { ascending: true });

  const { data, error } = await query;
  if (error) { showTableError(tbody, 7, error, 'timetable'); return; }
  currentRows = (data || []).filter(row => !row.is_archived);
  if (!currentRows.length) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No timetable periods found.</td></tr>'; return; }

  tbody.innerHTML = currentRows.map(row => `<tr>
    <td>${display(row.class)}</td><td>${display(row.section)}</td><td>${display(row.day)}</td><td>${display(row.period_no)}</td>
    <td><strong>${display(row.subject)}</strong></td><td>${display(row.teacher_name || row.teacher)}</td>
    <td><button class="action-btn action-delete" data-archive="${row.id}" data-label="${display(`${row.class}${row.section} ${row.day} P${row.period_no}`)}">Archive</button></td>
  </tr>`).join('');
  tbody.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archivePeriod(button.dataset.archive, button.dataset.label)));
}

async function archivePeriod(id, label) {
  if (!await confirmAction(`Archive timetable period ${label}?`, 'Archive')) return;
  const { error } = await supabase.from('timetable').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast(`Archive failed. Run the updated Supabase schema first. ${error.message}`, 'error', 6500); return; }
  await logActivity('Timetable period archived', label);
  showToast('Timetable period archived.', 'success');
  await loadTimetable();
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  const button = document.createElement('button');
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    if (!currentRows.length) { showToast('No timetable records to export.', 'warning'); return; }
    downloadCSV('jnv-timetable.csv', currentRows, [
      { label: 'Class', value: 'class' }, { label: 'Section', value: 'section' }, { label: 'Day', value: 'day' },
      { label: 'Period', value: 'period_no' }, { label: 'Subject', value: 'subject' }, { label: 'Teacher', value: 'teacher_name' },
      { label: 'Start Time', value: 'start_time' }, { label: 'End Time', value: 'end_time' }
    ]);
    showToast('Timetable CSV exported.', 'success');
  });
  actions?.appendChild(button);
}

await loadTimetable();

import { supabase, requireSession, initLogout, JNV_HOUSES, display, escapeHTML, fillSelect, showTableError, canWrite } from './app-config.js';

await requireSession();
initLogout();

const PAGE_SIZE = 20;
let rows = [];
let currentPage = 1;
let totalCount = 0;
let editingId = null;

const tbody = document.getElementById('teachers-tbody');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const subjectFilter = document.getElementById('filter-subject');
const houseFilter = document.getElementById('filter-house');
const modal = document.getElementById('teacher-modal');
const form = document.getElementById('teacher-form');
const addBtn = document.getElementById('add-teacher-btn');
const modalTitle = document.getElementById('modal-title');
const modalSubmit = document.getElementById('modal-submit');

fillSelect(houseFilter, JNV_HOUSES, 'All Houses');
fillSelect(document.getElementById('teacher-house-select'), JNV_HOUSES, 'Select');

if (!canWrite()) addBtn.style.display = 'none';

addBtn.addEventListener('click', () => openModal());
['modal-close', 'modal-cancel'].forEach(id => document.getElementById(id).addEventListener('click', closeModal));
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  searchInput.value = '';
  subjectFilter.value = '';
  houseFilter.value = '';
  currentPage = 1;
  loadTeachers();
});

let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { currentPage = 1; loadTeachers(); }, 300); });
subjectFilter.addEventListener('change', () => { currentPage = 1; loadTeachers(); });
houseFilter.addEventListener('change', () => { currentPage = 1; loadTeachers(); });

async function loadSubjects() {
  const { data } = await supabase.from('teachers').select('subject').not('subject', 'is', null);
  const subjects = [...new Set((data || []).map(x => x.subject).filter(Boolean))].sort();
  fillSelect(subjectFilter, subjects, 'All Subjects');
}

async function loadTeachers() {
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading teachers...</td></tr>';
  let query = supabase.from('teachers').select('*', { count: 'exact' });
  const search = searchInput.value.trim();
  if (search) query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%,subject.ilike.%${search}%,username.ilike.%${search}%`);
  if (subjectFilter.value) query = query.eq('subject', subjectFilter.value);
  if (houseFilter.value) query = query.eq('house', houseFilter.value);
  query = query.order('full_name', { ascending: true }).range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) { showTableError(tbody, 8, error, 'teachers'); return; }

  rows = data || [];
  totalCount = count || 0;
  document.getElementById('teacher-summary').innerHTML = `
    <div class="summary-tile"><div class="summary-label">Teachers</div><div class="summary-value">${totalCount}</div></div>
    <div class="summary-tile"><div class="summary-label">Subjects</div><div class="summary-value">${new Set(rows.map(t => t.subject).filter(Boolean)).size}</div></div>
    <div class="summary-tile"><div class="summary-label">JNV Houses</div><div class="summary-value">${JNV_HOUSES.length}</div></div>`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No teachers found.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${display(t.employee_id)}</td>
      <td><strong>${display(t.full_name)}</strong><div class="hint-text">${display(t.email || t.username, '')}</div></td>
      <td>${display(t.designation)}</td>
      <td>${display(t.subject)}</td>
      <td>${display(t.phone)}</td>
      <td>${display(t.class_teacher_of)}</td>
      <td>${display(t.house)}</td>
      <td>${canWrite() ? `<button class="action-btn action-edit" data-id="${t.id}">Edit</button><button class="action-btn action-delete" data-id="${t.id}">Delete</button>` : '—'}</td>
    </tr>`).join('');

  tbody.querySelectorAll('.action-edit').forEach(btn => btn.addEventListener('click', () => openModal(rows.find(r => String(r.id) === String(btn.dataset.id)))));
  tbody.querySelectorAll('.action-delete').forEach(btn => btn.addEventListener('click', () => deleteTeacher(btn.dataset.id)));
  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="page-btn ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('');
  pagination.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', () => { currentPage = Number(btn.dataset.page); loadTeachers(); }));
}

function openModal(row = null) {
  editingId = row?.id || null;
  modalTitle.textContent = row ? 'Edit Teacher' : 'Add Teacher';
  modalSubmit.textContent = row ? 'Update Teacher' : 'Save Teacher';
  form.reset();
  if (row) {
    ['full_name','username','employee_id','designation','subject','phone','email','class_teacher_of','house','status','address'].forEach(k => { if (form[k]) form[k].value = row[k] || ''; });
  } else {
    form.status.value = 'Active';
  }
  modal.hidden = false;
}

function closeModal() { modal.hidden = true; }

form.addEventListener('submit', async e => {
  e.preventDefault();
  modalSubmit.disabled = true;
  modalSubmit.textContent = 'Saving...';
  const f = form;
  const payload = {
    full_name: f.full_name.value.trim(),
    username: f.username.value.trim() || null,
    employee_id: f.employee_id.value.trim() || null,
    designation: f.designation.value.trim() || null,
    subject: f.subject.value.trim() || null,
    phone: f.phone.value.trim() || null,
    email: f.email.value.trim() || null,
    class_teacher_of: f.class_teacher_of.value.trim() || null,
    house: f.house.value || null,
    status: f.status.value || 'Active',
    address: f.address.value.trim() || null
  };
  const { error } = editingId
    ? await supabase.from('teachers').update(payload).eq('id', editingId)
    : await supabase.from('teachers').insert(payload);
  modalSubmit.disabled = false;
  modalSubmit.textContent = editingId ? 'Update Teacher' : 'Save Teacher';
  if (error) { alert('Error: ' + error.message); return; }
  closeModal();
  await loadSubjects();
  await loadTeachers();
});

async function deleteTeacher(id) {
  if (!confirm('Delete this teacher record?')) return;
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await loadTeachers();
}

await loadSubjects();
await loadTeachers();

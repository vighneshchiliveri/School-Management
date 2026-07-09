import { supabase, requireSession, initLogout, display, showTableError, canWrite } from './app-config.js';

await requireSession();
initLogout();

const PAGE_SIZE = 20;
let rows = [];
let currentPage = 1;
let totalCount = 0;
let editingId = null;

const tbody = document.getElementById('parents-tbody');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('parent-modal');
const form = document.getElementById('parent-form');
const addBtn = document.getElementById('add-parent-btn');
const modalTitle = document.getElementById('modal-title');
const modalSubmit = document.getElementById('modal-submit');

if (!canWrite()) addBtn.style.display = 'none';

addBtn.addEventListener('click', () => openModal());
['modal-close', 'modal-cancel'].forEach(id => document.getElementById(id).addEventListener('click', closeModal));
document.getElementById('clear-filters-btn').addEventListener('click', () => { searchInput.value = ''; currentPage = 1; loadParents(); });
let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { currentPage = 1; loadParents(); }, 300); });

async function loadParents() {
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading parents...</td></tr>';
  let query = supabase.from('parents').select('*', { count: 'exact' });
  const search = searchInput.value.trim();
  if (search) query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  query = query.order('full_name', { ascending: true }).range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);
  const { data, count, error } = await query;
  if (error) { showTableError(tbody, 7, error, 'parents'); return; }
  rows = data || [];
  totalCount = count || 0;

  const linkedCounts = await getLinkedCounts(rows.map(p => p.id));
  document.getElementById('parent-summary').innerHTML = `
    <div class="summary-tile"><div class="summary-label">Parents</div><div class="summary-value">${totalCount}</div></div>
    <div class="summary-tile"><div class="summary-label">Shown Records</div><div class="summary-value">${rows.length}</div></div>
    <div class="summary-tile"><div class="summary-label">Linked Students</div><div class="summary-value">${Object.values(linkedCounts).reduce((a,b)=>a+b,0)}</div></div>`;

  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No parents found.</td></tr>'; renderPagination(); return; }
  tbody.innerHTML = rows.map(p => `
    <tr>
      <td><strong>${display(p.full_name)}</strong><div class="hint-text">${display(p.relation, '')}</div></td>
      <td>${display(p.username)}</td>
      <td>${display(p.phone)}</td>
      <td>${display(p.email)}</td>
      <td>${display(p.village)}</td>
      <td>${linkedCounts[p.id] || 0}</td>
      <td>${canWrite() ? `<button class="action-btn action-edit" data-id="${p.id}">Edit</button><button class="action-btn action-delete" data-id="${p.id}">Delete</button>` : '—'}</td>
    </tr>`).join('');
  tbody.querySelectorAll('.action-edit').forEach(btn => btn.addEventListener('click', () => openModal(rows.find(r => String(r.id) === String(btn.dataset.id)))));
  tbody.querySelectorAll('.action-delete').forEach(btn => btn.addEventListener('click', () => deleteParent(btn.dataset.id)));
  renderPagination();
}

async function getLinkedCounts(parentIds) {
  if (!parentIds.length) return {};
  const { data } = await supabase.from('parent_student_links').select('parent_id').in('parent_id', parentIds);
  return (data || []).reduce((acc, row) => { acc[row.parent_id] = (acc[row.parent_id] || 0) + 1; return acc; }, {});
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="page-btn ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('');
  pagination.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', () => { currentPage = Number(btn.dataset.page); loadParents(); }));
}

function openModal(row = null) {
  editingId = row?.id || null;
  modalTitle.textContent = row ? 'Edit Parent' : 'Add Parent';
  modalSubmit.textContent = row ? 'Update Parent' : 'Save Parent';
  form.reset();
  if (row) ['full_name','username','phone','email','village','relation','address'].forEach(k => { if (form[k]) form[k].value = row[k] || ''; });
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }

form.addEventListener('submit', async e => {
  e.preventDefault();
  modalSubmit.disabled = true;
  modalSubmit.textContent = 'Saving...';
  const f = form;
  const payload = {
    full_name: f.full_name.value.trim(), username: f.username.value.trim() || null,
    phone: f.phone.value.trim() || null, email: f.email.value.trim() || null,
    village: f.village.value.trim() || null, relation: f.relation.value || null,
    address: f.address.value.trim() || null
  };
  const { error } = editingId ? await supabase.from('parents').update(payload).eq('id', editingId) : await supabase.from('parents').insert(payload);
  modalSubmit.disabled = false;
  modalSubmit.textContent = editingId ? 'Update Parent' : 'Save Parent';
  if (error) { alert('Error: ' + error.message); return; }
  closeModal();
  await loadParents();
});

async function deleteParent(id) {
  if (!confirm('Delete this parent record?')) return;
  const { error } = await supabase.from('parents').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await loadParents();
}

await loadParents();

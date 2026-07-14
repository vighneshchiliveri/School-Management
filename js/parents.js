import {
  supabase, requireSession, initLogout, display, showTableError, showToast,
  setButtonLoading, confirmAction, logActivity, sanitizeSearchTerm, downloadCSV
} from './app-config.js';

await requireSession(['principal']);
initLogout();

const PAGE_SIZE = 20;
let allRows = [];
let pageRows = [];
let currentPage = 1;
let editingId = null;
let formDirty = false;
let linkParent = null;

const tbody = document.getElementById('parents-tbody');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('parent-modal');
const form = document.getElementById('parent-form');
const addBtn = document.getElementById('add-parent-btn');
const modalTitle = document.getElementById('modal-title');
const modalSubmit = document.getElementById('modal-submit');

addExportButton();
createLinkModal();
addBtn.addEventListener('click', () => openModal());
['modal-close', 'modal-cancel'].forEach(id => document.getElementById(id).addEventListener('click', closeModal));
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
form.addEventListener('input', () => { formDirty = true; });
document.getElementById('clear-filters-btn').addEventListener('click', () => { searchInput.value = ''; currentPage = 1; loadParents(); });
let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { currentPage = 1; loadParents(); }, 300); });

async function loadParents() {
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading parents…</td></tr>';
  let query = supabase.from('parents').select('*').order('full_name', { ascending: true });
  const search = sanitizeSearchTerm(searchInput.value);
  if (search) query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { showTableError(tbody, 7, error, 'parents'); return; }

  allRows = (data || []).filter(row => !row.is_archived);
  const linkedCounts = await getLinkedCounts(allRows.map(parent => parent.id));
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  pageRows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  document.getElementById('parent-summary').innerHTML = `
    <div class="summary-tile"><div class="summary-label">Parents</div><div class="summary-value">${total}</div></div>
    <div class="summary-tile"><div class="summary-label">Linked Students</div><div class="summary-value">${Object.values(linkedCounts).reduce((sum, count) => sum + count, 0)}</div></div>
    <div class="summary-tile"><div class="summary-label">Unlinked Parents</div><div class="summary-value">${allRows.filter(parent => !linkedCounts[parent.id]).length}</div></div>`;

  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No parents found.</td></tr>';
    renderPagination(total);
    return;
  }

  tbody.innerHTML = pageRows.map(parent => `
    <tr><td><strong>${display(parent.full_name)}</strong><div class="hint-text">${display(parent.relation, '')}</div></td>
    <td>${display(parent.username)}</td><td>${display(parent.phone)}</td><td>${display(parent.email)}</td><td>${display(parent.village)}</td>
    <td>${linkedCounts[parent.id] || 0}</td><td><button class="action-btn action-view" data-links="${parent.id}">Manage Links</button><button class="action-btn action-edit" data-edit="${parent.id}">Edit</button><button class="action-btn action-delete" data-archive="${parent.id}" data-name="${display(parent.full_name)}">Archive</button></td></tr>`).join('');
  tbody.querySelectorAll('[data-links]').forEach(button => button.addEventListener('click', () => openLinkModal(pageRows.find(row => String(row.id) === String(button.dataset.links)))));
  tbody.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openModal(pageRows.find(row => String(row.id) === String(button.dataset.edit)))));
  tbody.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveParent(button.dataset.archive, button.dataset.name)));
  renderPagination(total);
}

async function getLinkedCounts(parentIds) {
  if (!parentIds.length) return {};
  const { data } = await supabase.from('parent_student_links').select('parent_id').in('parent_id', parentIds);
  return (data || []).reduce((acc, row) => { acc[row.parent_id] = (acc[row.parent_id] || 0) + 1; return acc; }, {});
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => `<button class="page-btn ${index + 1 === currentPage ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>`).join('');
  pagination.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { currentPage = Number(button.dataset.page); loadParents(); }));
}

function openModal(row = null) {
  editingId = row?.id || null;
  modalTitle.textContent = row ? 'Edit Parent' : 'Add Parent';
  modalSubmit.textContent = row ? 'Update Parent' : 'Save Parent';
  form.reset();
  clearValidation();
  if (row) ['full_name','username','phone','email','village','relation','address'].forEach(key => { if (form[key]) form[key].value = row[key] || ''; });
  formDirty = false;
  modal.hidden = false;
  form.full_name.focus();
}

async function closeModal() {
  if (formDirty && !await confirmAction('Discard unsaved parent changes?', 'Discard')) return;
  modal.hidden = true;
  formDirty = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearValidation();
  const payload = {
    full_name: form.full_name.value.trim(), username: form.username.value.trim().toLowerCase() || null,
    phone: form.phone.value.trim() || null, email: form.email.value.trim() || null,
    village: form.village.value.trim() || null, relation: form.relation.value || null,
    address: form.address.value.trim() || null
  };
  if (!payload.full_name) { markInvalid(form.full_name, 'Full name is required.'); return; }
  if (payload.phone && !/^[0-9+\-\s]{7,15}$/.test(payload.phone)) { markInvalid(form.phone, 'Enter a valid phone number.'); return; }

  setButtonLoading(modalSubmit, true, 'Saving…');
  const { error } = editingId ? await supabase.from('parents').update(payload).eq('id', editingId) : await supabase.from('parents').insert(payload);
  setButtonLoading(modalSubmit, false);
  if (error) { showToast(`Parent could not be saved: ${error.message}`, 'error'); return; }

  await logActivity(editingId ? 'Parent updated' : 'Parent added', payload.full_name);
  showToast(editingId ? 'Parent updated successfully.' : 'Parent added successfully.', 'success');
  modal.hidden = true;
  formDirty = false;
  await loadParents();
});

async function archiveParent(id, name) {
  if (!await confirmAction(`Archive ${name}? Student links will remain in the database.`, 'Archive')) return;
  const { error } = await supabase.from('parents').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast(`Archive failed. Run the updated Supabase schema first. ${error.message}`, 'error', 6500); return; }
  await logActivity('Parent archived', name);
  showToast('Parent archived safely.', 'success');
  await loadParents();
}

function markInvalid(control, message) {
  control.classList.add('invalid-field');
  const error = document.createElement('span');
  error.className = 'field-error-text';
  error.textContent = message;
  control.insertAdjacentElement('afterend', error);
  control.focus();
  showToast('Please correct the highlighted field.', 'warning');
}
function clearValidation() {
  form.querySelectorAll('.invalid-field').forEach(control => control.classList.remove('invalid-field'));
  form.querySelectorAll('.field-error-text').forEach(error => error.remove());
}


function createLinkModal() {
  if (document.getElementById('parent-link-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="parent-link-modal" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="parent-link-title">
        <div class="modal-header"><h2 class="modal-title" id="parent-link-title">Link Students</h2><button class="modal-close" id="parent-link-close" aria-label="Close">✕</button></div>
        <div class="modal-form">
          <div class="field-group"><label for="parent-link-search">Search students</label><input id="parent-link-search" placeholder="Name, admission number, class…"></div>
          <div id="parent-link-list" class="csv-preview" style="max-height:360px; margin-top:12px;"></div>
          <div class="modal-footer"><button type="button" class="btn-ghost" id="parent-link-cancel">Cancel</button><button type="button" class="btn-primary" id="parent-link-save">Save Links</button></div>
        </div>
      </div>
    </div>`);
  document.getElementById('parent-link-close').addEventListener('click', closeLinkModal);
  document.getElementById('parent-link-cancel').addEventListener('click', closeLinkModal);
  document.getElementById('parent-link-search').addEventListener('input', filterLinkStudents);
  document.getElementById('parent-link-save').addEventListener('click', saveStudentLinks);
  document.getElementById('parent-link-modal').addEventListener('click', event => { if (event.target.id === 'parent-link-modal') closeLinkModal(); });
}

async function openLinkModal(parent) {
  if (!parent) return;
  linkParent = parent;
  const modal = document.getElementById('parent-link-modal');
  const list = document.getElementById('parent-link-list');
  document.getElementById('parent-link-title').textContent = `Link Students — ${parent.full_name}`;
  document.getElementById('parent-link-search').value = '';
  list.innerHTML = '<p class="empty-state">Loading students…</p>';
  modal.hidden = false;
  document.getElementById('parent-link-search').focus();

  const [{ data: students, error }, { data: links, error: linkError }] = await Promise.all([
    supabase.from('students').select('id,full_name,admission_no,class,section,roll_no,is_archived').order('class').order('admission_no'),
    supabase.from('parent_student_links').select('student_id').eq('parent_id', parent.id)
  ]);
  if (error || linkError) { list.innerHTML = `<p class="empty-state">${display((error || linkError).message)}</p>`; return; }
  const linked = new Set((links || []).map(row => row.student_id));
  const activeStudents = (students || []).filter(student => !student.is_archived);
  list.innerHTML = activeStudents.map(student => `<label class="attention-item student-link-option" data-search="${display(`${student.full_name} ${student.admission_no || ''} ${student.class || ''} ${student.section || ''}`.toLowerCase())}" style="cursor:pointer; margin:8px;"><input type="checkbox" value="${student.id}" ${linked.has(student.id) ? 'checked' : ''}><span><span class="attention-title">${display(student.full_name)}</span><span class="attention-detail">Class ${display(student.class)} ${display(student.section)} · Roll ${display(student.roll_no)} · Adm ${display(student.admission_no)}</span></span></label>`).join('') || '<p class="empty-state">No active students found.</p>';
}

function filterLinkStudents() {
  const term = document.getElementById('parent-link-search').value.trim().toLowerCase();
  document.querySelectorAll('.student-link-option').forEach(option => { option.style.display = option.dataset.search.includes(term) ? 'flex' : 'none'; });
}

function closeLinkModal() {
  document.getElementById('parent-link-modal').hidden = true;
  linkParent = null;
}

async function saveStudentLinks() {
  if (!linkParent) return;
  const button = document.getElementById('parent-link-save');
  const selected = [...document.querySelectorAll('#parent-link-list input[type="checkbox"]:checked')].map(input => input.value);
  setButtonLoading(button, true, 'Saving…');
  const { data: existing, error: existingError } = await supabase.from('parent_student_links').select('student_id').eq('parent_id', linkParent.id);
  if (existingError) { setButtonLoading(button, false); showToast(`Existing links could not be read: ${existingError.message}`, 'error'); return; }
  const existingSet = new Set((existing || []).map(row => row.student_id));
  const selectedSet = new Set(selected);
  const removeIds = [...existingSet].filter(id => !selectedSet.has(id));
  const addIds = selected.filter(id => !existingSet.has(id));
  let error = null;
  if (removeIds.length) ({ error } = await supabase.from('parent_student_links').delete().eq('parent_id', linkParent.id).in('student_id', removeIds));
  if (!error && addIds.length) ({ error } = await supabase.from('parent_student_links').insert(addIds.map(student_id => ({ parent_id: linkParent.id, student_id }))));
  setButtonLoading(button, false);
  if (error) { showToast(`Student links could not be saved: ${error.message}`, 'error'); return; }
  await logActivity('Parent-student links updated', `${linkParent.full_name} · ${selected.length} linked students`);
  showToast('Parent-student links saved.', 'success');
  closeLinkModal();
  await loadParents();
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return;
  const button = document.createElement('button');
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    if (!allRows.length) { showToast('No parent records to export.', 'warning'); return; }
    downloadCSV('jnv-parents.csv', allRows, [
      { label: 'Full Name', value: 'full_name' }, { label: 'Username', value: 'username' }, { label: 'Relation', value: 'relation' },
      { label: 'Phone', value: 'phone' }, { label: 'Email', value: 'email' }, { label: 'Village', value: 'village' }, { label: 'Address', value: 'address' }
    ]);
    showToast('Parent CSV exported.', 'success');
  });
  actions.prepend(button);
}

await loadParents();
if (new URLSearchParams(window.location.search).get('action') === 'add') openModal();

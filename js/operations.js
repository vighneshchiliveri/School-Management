import {
  supabase, requireSession, initLogout, getProfile, isPrincipal, OPERATION_TYPES,
  fillSelect, display, escapeHTML, statusBadge, formatDate, showToast,
  setButtonLoading, confirmAction, logActivity, sanitizeSearchTerm, downloadCSV, todayISO
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();
const profile = getProfile();

const list = document.getElementById('operations-list');
const summary = document.getElementById('operations-summary');
const modal = document.getElementById('operation-modal');
const form = document.getElementById('operation-form');
const modalTitle = document.getElementById('operation-modal-title');
const submitBtn = document.getElementById('operation-submit');
const typeFilter = document.getElementById('filter-type');
let allRows = [];
let editingId = null;
let formDirty = false;

fillSelect(typeFilter, OPERATION_TYPES, 'All Types');
fillSelect(document.getElementById('operation-type'), OPERATION_TYPES, 'Select Type');

document.getElementById('add-operation-btn').addEventListener('click', () => openModal());
document.getElementById('operation-modal-close').addEventListener('click', closeModal);
document.getElementById('operation-modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
form.addEventListener('input', () => { formDirty = true; });
form.addEventListener('submit', saveRecord);
document.getElementById('export-operations-btn').addEventListener('click', exportRows);

['filter-type', 'filter-status', 'filter-priority'].forEach(id => document.getElementById(id).addEventListener('change', loadOperations));
let searchTimer;
document.getElementById('search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadOperations, 300); });
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  document.getElementById('search-input').value = '';
  ['filter-type', 'filter-status', 'filter-priority'].forEach(id => document.getElementById(id).value = '');
  loadOperations();
});

async function loadOperations() {
  list.innerHTML = '<p class="empty-state-card">Loading operations…</p>';
  let query = supabase.from('school_operations').select('*').order('created_at', { ascending: false });
  const search = sanitizeSearchTerm(document.getElementById('search-input').value);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,student_name.ilike.%${search}%,assigned_to.ilike.%${search}%`);
  if (typeFilter.value) query = query.eq('type', typeFilter.value);
  if (document.getElementById('filter-status').value) query = query.eq('status', document.getElementById('filter-status').value);
  if (document.getElementById('filter-priority').value) query = query.eq('priority', document.getElementById('filter-priority').value);

  const { data, error } = await query;
  if (error) {
    list.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}<br><span class="hint-text">Run the updated Supabase schema to create the school_operations table.</span></p>`;
    summary.innerHTML = '';
    return;
  }
  allRows = (data || []).filter(row => !row.is_archived);
  renderSummary();
  if (!allRows.length) { list.innerHTML = '<p class="empty-state-card">No operational records match the selected filters.</p>'; return; }

  list.innerHTML = allRows.map(row => `<article class="operation-card">
    <div class="operation-card-head"><div><div class="operation-type">${display(row.type)}</div><div class="operation-title">${display(row.title)}</div></div><div>${statusBadge(row.status || 'Open')}</div></div>
    <div class="record-meta"><span class="status-badge priority-${String(row.priority || 'Medium').toLowerCase()}">${display(row.priority || 'Medium')} priority</span>${row.event_date ? `<span class="meta-pill">${formatDate(row.event_date)}</span>` : ''}${row.class_section ? `<span class="meta-pill">Class ${display(row.class_section)}</span>` : ''}</div>
    <div class="operation-description">${display(row.description, '')}</div>
    <div class="hint-text" style="margin-top:12px;">${row.student_name ? `Person: ${display(row.student_name)} · ` : ''}${row.assigned_to ? `Assigned: ${display(row.assigned_to)} · ` : ''}${row.created_by ? `Created by ${display(row.created_by)}` : ''}</div>
    <div class="inline-actions" style="margin-top:12px;"><button class="action-btn action-edit" data-edit="${row.id}">Edit</button>${isPrincipal() ? `<button class="action-btn action-delete" data-archive="${row.id}" data-title="${display(row.title)}">Archive</button>` : ''}</div>
  </article>`).join('');
  list.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openModal(allRows.find(row => String(row.id) === String(button.dataset.edit)))));
  list.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveRecord(button.dataset.archive, button.dataset.title)));
}

function renderSummary() {
  summary.innerHTML = `
    <div class="summary-tile"><div class="summary-label">Total Records</div><div class="summary-value">${allRows.length}</div></div>
    <div class="summary-tile"><div class="summary-label">Open / In Progress</div><div class="summary-value">${allRows.filter(row => ['Open', 'In Progress'].includes(row.status)).length}</div></div>
    <div class="summary-tile"><div class="summary-label">High Priority</div><div class="summary-value">${allRows.filter(row => row.priority === 'High' && !['Completed','Closed'].includes(row.status)).length}</div></div>
    <div class="summary-tile"><div class="summary-label">Completed</div><div class="summary-value">${allRows.filter(row => ['Completed','Closed'].includes(row.status)).length}</div></div>`;
}

function openModal(row = null) {
  editingId = row?.id || null;
  modalTitle.textContent = row ? 'Edit Operational Record' : 'Add Operational Record';
  submitBtn.textContent = row ? 'Update Record' : 'Save Record';
  form.reset();
  if (row) {
    ['type','title','event_date','priority','status','assigned_to','student_name','class_section','description'].forEach(key => { if (form[key]) form[key].value = row[key] || ''; });
  } else {
    form.event_date.value = todayISO();
    form.priority.value = 'Medium';
    form.status.value = 'Open';
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') && OPERATION_TYPES.includes(params.get('type'))) form.type.value = params.get('type');
  }
  formDirty = false;
  modal.hidden = false;
  form.type.focus();
}

async function closeModal() {
  if (formDirty && !await confirmAction('Discard unsaved operational record changes?', 'Discard')) return;
  modal.hidden = true;
  formDirty = false;
}

async function saveRecord(event) {
  event.preventDefault();
  const payload = {
    type: form.type.value, title: form.title.value.trim(), event_date: form.event_date.value || null,
    priority: form.priority.value || 'Medium', status: form.status.value || 'Open',
    assigned_to: form.assigned_to.value.trim() || null, student_name: form.student_name.value.trim() || null,
    class_section: form.class_section.value.trim() || null, description: form.description.value.trim(),
    created_by: profile?.full_name || profile?.username || null, created_by_user_id: profile?.auth_user_id || null,
    updated_at: new Date().toISOString()
  };
  if (!payload.type || !payload.title || !payload.description) { showToast('Type, title, and description are required.', 'warning'); return; }
  setButtonLoading(submitBtn, true, 'Saving…');
  const { error } = editingId ? await supabase.from('school_operations').update(payload).eq('id', editingId) : await supabase.from('school_operations').insert(payload);
  setButtonLoading(submitBtn, false);
  if (error) { showToast(`Record could not be saved: ${error.message}`, 'error'); return; }
  await logActivity(editingId ? 'Operational record updated' : 'Operational record added', `${payload.type} · ${payload.title}`);
  showToast(editingId ? 'Operational record updated.' : 'Operational record added.', 'success');
  modal.hidden = true;
  formDirty = false;
  await loadOperations();
}

async function archiveRecord(id, title) {
  if (!await confirmAction(`Archive “${title}”?`, 'Archive')) return;
  const { error } = await supabase.from('school_operations').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast(`Archive failed: ${error.message}`, 'error'); return; }
  await logActivity('Operational record archived', title);
  showToast('Operational record archived.', 'success');
  await loadOperations();
}

function exportRows() {
  if (!allRows.length) { showToast('No operational records to export.', 'warning'); return; }
  downloadCSV('jnv-operations.csv', allRows, [
    { label: 'Type', value: 'type' }, { label: 'Title', value: 'title' }, { label: 'Event Date', value: 'event_date' },
    { label: 'Priority', value: 'priority' }, { label: 'Status', value: 'status' }, { label: 'Assigned To', value: 'assigned_to' },
    { label: 'Student / Person', value: 'student_name' }, { label: 'Class / Section', value: 'class_section' },
    { label: 'Description / Action Taken', value: 'description' }, { label: 'Created By', value: 'created_by' }
  ]);
  showToast('Operations CSV exported.', 'success');
}

await loadOperations();
if (new URLSearchParams(window.location.search).get('action') === 'add') openModal();

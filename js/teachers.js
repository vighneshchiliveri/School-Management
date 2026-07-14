import {
  supabase, requireSession, initLogout, JNV_HOUSES, JNV_CLASSES, SECTIONS, display, fillSelect,
  showTableError, isPrincipal, showToast, setButtonLoading, confirmAction,
  logActivity, sanitizeSearchTerm, downloadCSV
} from './app-config.js';

await requireSession(['principal']);
initLogout();

const PAGE_SIZE = 20;
let rows = [];
let exportRows = [];
let currentPage = 1;
let totalCount = 0;
let editingId = null;
let formDirty = false;
let accessTeacher = null;

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
addExportButton();
createAccessModal();

addBtn.addEventListener('click', () => openModal());
['modal-close', 'modal-cancel'].forEach(id => document.getElementById(id).addEventListener('click', closeModal));
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
form.addEventListener('input', () => { formDirty = true; });

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
  const { data } = await supabase.from('teachers').select('subject,is_archived').not('subject', 'is', null);
  const subjects = [...new Set((data || []).filter(x => !x.is_archived).map(x => x.subject).filter(Boolean))].sort();
  fillSelect(subjectFilter, subjects, 'All Subjects');
}

async function loadTeachers() {
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading teachers…</td></tr>';
  let query = supabase.from('teachers').select('*');
  const search = sanitizeSearchTerm(searchInput.value);
  if (search) query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%,subject.ilike.%${search}%,username.ilike.%${search}%`);
  if (subjectFilter.value) query = query.eq('subject', subjectFilter.value);
  if (houseFilter.value) query = query.eq('house', houseFilter.value);
  query = query.order('full_name', { ascending: true });

  const { data, error } = await query;
  if (error) { showTableError(tbody, 8, error, 'teachers'); return; }
  exportRows = (data || []).filter(row => !row.is_archived);
  totalCount = exportRows.length;
  const pageRows = exportRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  rows = pageRows;

  document.getElementById('teacher-summary').innerHTML = `
    <div class="summary-tile"><div class="summary-label">Teachers</div><div class="summary-value">${totalCount}</div></div>
    <div class="summary-tile"><div class="summary-label">Active</div><div class="summary-value">${exportRows.filter(t => !t.status || t.status === 'Active').length}</div></div>
    <div class="summary-tile"><div class="summary-label">Subjects</div><div class="summary-value">${new Set(exportRows.map(t => t.subject).filter(Boolean)).size}</div></div>
    <div class="summary-tile"><div class="summary-label">Class Access Pending</div><div class="summary-value">${exportRows.filter(t => !t.permissions_configured).length}</div></div>`;

  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No teachers found.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = pageRows.map(teacher => `
    <tr>
      <td>${display(teacher.employee_id)}</td>
      <td><strong>${display(teacher.full_name)}</strong><div class="hint-text">${display(teacher.email || teacher.username, '')}</div></td>
      <td>${display(teacher.designation)}</td><td>${display(teacher.subject)}</td><td>${display(teacher.phone)}</td>
      <td>${display(teacher.class_teacher_of)}</td><td>${display(teacher.house)}</td>
      <td><button class="action-btn action-view" data-access="${teacher.id}">${teacher.permissions_configured ? 'Class Access' : 'Set Class Access'}</button><button class="action-btn action-edit" data-edit="${teacher.id}">Edit</button><button class="action-btn action-delete" data-archive="${teacher.id}" data-name="${display(teacher.full_name)}">Archive</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-access]').forEach(button => button.addEventListener('click', () => openAccessModal(pageRows.find(row => String(row.id) === String(button.dataset.access)))));
  tbody.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openModal(pageRows.find(row => String(row.id) === String(button.dataset.edit)))));
  tbody.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveTeacher(button.dataset.archive, button.dataset.name)));
  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => `<button class="page-btn ${index + 1 === currentPage ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>`).join('');
  pagination.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { currentPage = Number(button.dataset.page); loadTeachers(); }));
}

function openModal(row = null) {
  editingId = row?.id || null;
  modalTitle.textContent = row ? 'Edit Teacher' : 'Add Teacher';
  modalSubmit.textContent = row ? 'Update Teacher' : 'Save Teacher';
  form.reset();
  clearValidation();
  if (row) {
    ['full_name','username','employee_id','designation','subject','phone','email','class_teacher_of','house','status','address'].forEach(key => { if (form[key]) form[key].value = row[key] || ''; });
  } else {
    form.status.value = 'Active';
  }
  formDirty = false;
  modal.hidden = false;
  form.full_name.focus();
}

async function closeModal() {
  if (formDirty && !await confirmAction('Discard unsaved teacher changes?', 'Discard')) return;
  modal.hidden = true;
  formDirty = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearValidation();
  const payload = {
    full_name: form.full_name.value.trim(), username: form.username.value.trim().toLowerCase() || null,
    employee_id: form.employee_id.value.trim() || null, designation: form.designation.value.trim() || null,
    subject: form.subject.value.trim() || null, phone: form.phone.value.trim() || null,
    email: form.email.value.trim() || null, class_teacher_of: form.class_teacher_of.value.trim() || null,
    house: form.house.value || null, status: form.status.value || 'Active', address: form.address.value.trim() || null
  };
  if (!payload.full_name) { markInvalid(form.full_name, 'Full name is required.'); return; }
  if (payload.phone && !/^[0-9+\-\s]{7,15}$/.test(payload.phone)) { markInvalid(form.phone, 'Enter a valid phone number.'); return; }

  setButtonLoading(modalSubmit, true, 'Saving…');
  const { error } = editingId
    ? await supabase.from('teachers').update(payload).eq('id', editingId)
    : await supabase.from('teachers').insert(payload);
  setButtonLoading(modalSubmit, false);
  if (error) { showToast(`Teacher could not be saved: ${error.message}`, 'error'); return; }

  if (editingId) {
    const { error: permissionSubjectError } = await supabase.from('teacher_class_permissions').update({ subject: payload.subject }).eq('teacher_id', editingId);
    if (permissionSubjectError) console.warn('Teacher permission subject sync skipped:', permissionSubjectError.message);
  }

  await logActivity(editingId ? 'Teacher updated' : 'Teacher added', `${payload.full_name}${payload.subject ? ` · ${payload.subject}` : ''}`);
  showToast(editingId ? 'Teacher updated successfully.' : 'Teacher added successfully.', 'success');
  modal.hidden = true;
  formDirty = false;
  await loadSubjects();
  await loadTeachers();
});

async function archiveTeacher(id, name) {
  if (!await confirmAction(`Archive ${name}? The record remains available for audit.`, 'Archive')) return;
  const { error } = await supabase.from('teachers').update({ is_archived: true, archived_at: new Date().toISOString(), status: 'Inactive' }).eq('id', id);
  if (error) { showToast(`Archive failed. Run the updated Supabase schema first. ${error.message}`, 'error', 6500); return; }
  await logActivity('Teacher archived', name);
  showToast('Teacher archived safely.', 'success');
  await loadTeachers();
}

function markInvalid(control, message) {
  control.classList.add('invalid-field');
  control.setAttribute('aria-invalid', 'true');
  const error = document.createElement('span');
  error.className = 'field-error-text';
  error.textContent = message;
  control.insertAdjacentElement('afterend', error);
  control.focus();
  showToast('Please correct the highlighted field.', 'warning');
}
function clearValidation() {
  form.querySelectorAll('.invalid-field').forEach(control => { control.classList.remove('invalid-field'); control.removeAttribute('aria-invalid'); });
  form.querySelectorAll('.field-error-text').forEach(error => error.remove());
}


function createAccessModal() {
  if (document.getElementById('teacher-access-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="teacher-access-modal" hidden>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="teacher-access-title">
        <div class="modal-header"><h2 class="modal-title" id="teacher-access-title">Teacher Class Access</h2><button class="modal-close" id="teacher-access-close" aria-label="Close">✕</button></div>
        <div class="modal-form">
          <div class="setup-banner"><strong>How it works:</strong> Once permissions are saved, this teacher can view students and mark attendance only for selected class-sections. Grade entry is also limited to the teacher’s Subject field when it is filled. Saving with no selections gives the teacher no class access.</div>
          <div class="bulk-action-bar"><button type="button" class="btn-ghost" id="access-select-all">Select All</button><button type="button" class="btn-ghost" id="access-clear-all">Clear All</button></div>
          <div id="teacher-access-list" class="operations-grid"></div>
          <div class="modal-footer"><button type="button" class="btn-ghost" id="teacher-access-cancel">Cancel</button><button type="button" class="btn-primary" id="teacher-access-save">Save Access</button></div>
        </div>
      </div>
    </div>`);
  document.getElementById('teacher-access-close').addEventListener('click', closeAccessModal);
  document.getElementById('teacher-access-cancel').addEventListener('click', closeAccessModal);
  document.getElementById('teacher-access-save').addEventListener('click', saveTeacherAccess);
  document.getElementById('access-select-all').addEventListener('click', () => document.querySelectorAll('#teacher-access-list input').forEach(input => { input.checked = true; }));
  document.getElementById('access-clear-all').addEventListener('click', () => document.querySelectorAll('#teacher-access-list input').forEach(input => { input.checked = false; }));
  document.getElementById('teacher-access-modal').addEventListener('click', event => { if (event.target.id === 'teacher-access-modal') closeAccessModal(); });
}

async function openAccessModal(teacher) {
  if (!teacher) return;
  accessTeacher = teacher;
  const modal = document.getElementById('teacher-access-modal');
  const accessList = document.getElementById('teacher-access-list');
  document.getElementById('teacher-access-title').textContent = `Class Access — ${teacher.full_name}`;
  accessList.innerHTML = '<p class="empty-state">Loading access…</p>';
  modal.hidden = false;
  document.getElementById('teacher-access-close').focus();
  const { data, error } = await supabase.from('teacher_class_permissions').select('class,section,subject').eq('teacher_id', teacher.id);
  if (error) {
    accessList.innerHTML = `<p class="empty-state-card">${display(error.message)}<br><span class="hint-text">Run the updated schema and security scripts first.</span></p>`;
    return;
  }
  const selected = new Set((data || []).map(row => `${row.class}-${row.section}`));
  accessList.innerHTML = JNV_CLASSES.map(cls => `<div class="operation-card"><div class="operation-title">Class ${display(cls)}</div><div class="record-meta" style="margin-top:12px;">${SECTIONS.map(section => `<label class="attention-item" style="cursor:pointer;"><input type="checkbox" value="${cls}-${section}" ${selected.has(`${cls}-${section}`) ? 'checked' : ''}><span><span class="attention-title">Section ${section}</span><span class="attention-detail">Attendance and ${teacher.subject ? `${display(teacher.subject)} grades` : 'grades'}</span></span></label>`).join('')}</div></div>`).join('');
}

function closeAccessModal() {
  document.getElementById('teacher-access-modal').hidden = true;
  accessTeacher = null;
}

async function saveTeacherAccess() {
  if (!accessTeacher) return;
  const button = document.getElementById('teacher-access-save');
  const selected = [...document.querySelectorAll('#teacher-access-list input:checked')].map(input => input.value.split('-'));
  setButtonLoading(button, true, 'Saving…');
  let { error } = await supabase.from('teacher_class_permissions').delete().eq('teacher_id', accessTeacher.id);
  if (!error && selected.length) {
    ({ error } = await supabase.from('teacher_class_permissions').insert(selected.map(([cls, section]) => ({
      teacher_id: accessTeacher.id,
      class: cls,
      section,
      subject: accessTeacher.subject || null,
      can_mark_attendance: true,
      can_enter_grades: true
    }))));
  }
  if (!error) {
    ({ error } = await supabase.from('teachers').update({ permissions_configured: true }).eq('id', accessTeacher.id));
  }
  setButtonLoading(button, false);
  if (error) { showToast(`Teacher access could not be saved: ${error.message}`, 'error'); return; }
  await logActivity('Teacher class access updated', `${accessTeacher.full_name} · ${selected.length} class-sections`);
  showToast('Teacher class access saved.', 'success');
  closeAccessModal();
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions || document.getElementById('export-teachers-btn')) return;
  const button = document.createElement('button');
  button.id = 'export-teachers-btn';
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    if (!exportRows.length) { showToast('No teacher records to export.', 'warning'); return; }
    downloadCSV('jnv-teachers.csv', exportRows, [
      { label: 'Employee ID', value: 'employee_id' }, { label: 'Full Name', value: 'full_name' }, { label: 'Designation', value: 'designation' },
      { label: 'Subject', value: 'subject' }, { label: 'Phone', value: 'phone' }, { label: 'Email', value: 'email' },
      { label: 'Class Teacher Of', value: 'class_teacher_of' }, { label: 'House', value: 'house' }, { label: 'Status', value: 'status' }
    ]);
    showToast('Teacher CSV exported.', 'success');
  });
  actions.prepend(button);
}

await loadSubjects();
await loadTeachers();
if (new URLSearchParams(window.location.search).get('action') === 'add' && isPrincipal()) openModal();

import {
  supabase, requireSession, initLogout, isPrincipal, display, escapeHTML,
  sortStudentsByRollOrAdmission, showToast, setButtonLoading, confirmAction,
  logActivity, sanitizeSearchTerm, downloadCSV, parseCSV
} from './app-config.js';

await requireSession(['principal', 'teacher']);
initLogout();

const PAGE_SIZE = 20;
let currentPage = 1;
let totalCount = 0;
let editingId = null;
let archiveId = null;
let allFilteredRows = [];
let formDirty = false;
let parsedImport = [];

const tbody = document.getElementById('students-tbody');
const countEl = document.getElementById('student-count');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const addBtn = document.getElementById('add-student-btn');
const importBtn = document.getElementById('import-csv-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const studentForm = document.getElementById('student-form');
const modalSubmit = document.getElementById('modal-submit');
const csvModal = document.getElementById('csv-modal-overlay');
const csvStatus = document.getElementById('csv-status');
const csvUploadBtn = document.getElementById('csv-upload-btn');

if (!isPrincipal()) {
  addBtn.style.display = 'none';
  importBtn.style.display = 'none';
}

addExportButton();

async function fetchStudents() {
  tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Loading students…</td></tr>';
  let query = supabase.from('students').select('*');

  const search = sanitizeSearchTerm(searchInput.value);
  const cls = value('filter-class');
  const section = value('filter-section');
  const house = value('filter-house');
  const category = value('filter-category');
  const gender = value('filter-gender');
  const blood = value('filter-blood');

  if (search) query = query.or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%,father_name.ilike.%${search}%,mother_name.ilike.%${search}%`);
  if (cls) query = query.eq('class', cls);
  if (section) query = query.eq('section', section);
  if (house) query = query.eq('house', house);
  if (category) query = query.eq('category', category);
  if (gender) query = query.eq('gender', gender);
  if (blood) query = query.eq('blood_group', blood);
  query = query.order('admission_no', { ascending: true });

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">${escapeHTML(error.message)}</td></tr>`;
    showToast('Unable to load students.', 'error');
    return;
  }

  allFilteredRows = sortStudentsByRollOrAdmission((data || []).filter(row => !row.is_archived));
  totalCount = allFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  countEl.textContent = `${totalCount} student${totalCount === 1 ? '' : 's'} found`;

  if (!allFilteredRows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No students match the selected filters.</td></tr>';
    pagination.innerHTML = '';
    return;
  }

  const pageRows = allFilteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  tbody.innerHTML = pageRows.map(student => `
    <tr>
      <td>${display(student.admission_no)}</td>
      <td><a href="student-profile.html?id=${encodeURIComponent(student.id)}" class="text-link">${display(student.full_name)}</a></td>
      <td>${display(student.class)}</td>
      <td>${display(student.section)}</td>
      <td>${display(student.roll_no)}</td>
      <td>${display(student.gender)}</td>
      <td>${display(student.house)}</td>
      <td>${display(student.category)}</td>
      <td>
        <button class="action-btn action-view" data-view="${student.id}">View</button>
        ${isPrincipal() ? `<button class="action-btn action-edit" data-edit="${student.id}">Edit</button><button class="action-btn action-delete" data-archive="${student.id}" data-name="${escapeHTML(student.full_name)}">Archive</button>` : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    window.location.href = `student-profile.html?id=${encodeURIComponent(button.dataset.view)}`;
  }));
  tbody.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditModal(button.dataset.edit)));
  tbody.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveStudent(button.dataset.archive, button.dataset.name)));
  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const buttons = [];
  if (currentPage > 1) buttons.push(`<button class="page-btn" data-page="${currentPage - 1}">Previous</button>`);
  for (let page = start; page <= end; page++) buttons.push(`<button class="page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`);
  if (currentPage < totalPages) buttons.push(`<button class="page-btn" data-page="${currentPage + 1}">Next</button>`);
  pagination.innerHTML = buttons.join('');
  pagination.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    currentPage = Number(button.dataset.page);
    renderCurrentPage();
  }));
}

function renderCurrentPage() {
  // Reuse already fetched data without another network request.
  const pageRows = allFilteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  if (!pageRows.length) { fetchStudents(); return; }
  tbody.innerHTML = pageRows.map(student => `
    <tr><td>${display(student.admission_no)}</td><td><a href="student-profile.html?id=${encodeURIComponent(student.id)}" class="text-link">${display(student.full_name)}</a></td><td>${display(student.class)}</td><td>${display(student.section)}</td><td>${display(student.roll_no)}</td><td>${display(student.gender)}</td><td>${display(student.house)}</td><td>${display(student.category)}</td><td><button class="action-btn action-view" data-view="${student.id}">View</button>${isPrincipal() ? `<button class="action-btn action-edit" data-edit="${student.id}">Edit</button><button class="action-btn action-delete" data-archive="${student.id}" data-name="${escapeHTML(student.full_name)}">Archive</button>` : ''}</td></tr>`).join('');
  tbody.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => window.location.href = `student-profile.html?id=${encodeURIComponent(button.dataset.view)}`));
  tbody.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditModal(button.dataset.edit)));
  tbody.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveStudent(button.dataset.archive, button.dataset.name)));
  renderPagination();
  document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function value(id) { return document.getElementById(id)?.value || ''; }

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage = 1; fetchStudents(); }, 320);
});
['filter-class', 'filter-section', 'filter-house', 'filter-category', 'filter-gender', 'filter-blood'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { currentPage = 1; fetchStudents(); });
});
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  searchInput.value = '';
  ['filter-class', 'filter-section', 'filter-house', 'filter-category', 'filter-gender', 'filter-blood'].forEach(id => document.getElementById(id).value = '');
  currentPage = 1;
  fetchStudents();
});

addBtn.addEventListener('click', () => openAddModal());
['modal-close', 'modal-cancel'].forEach(id => document.getElementById(id).addEventListener('click', closeStudentModal));
studentForm.addEventListener('input', () => { formDirty = true; });
modalOverlay.addEventListener('click', event => { if (event.target === modalOverlay) closeStudentModal(); });

function openAddModal() {
  editingId = null;
  modalTitle.textContent = 'Add Student';
  modalSubmit.textContent = 'Save Student';
  studentForm.reset();
  clearValidation(studentForm);
  formDirty = false;
  modalOverlay.hidden = false;
  studentForm.full_name.focus();
}

function openEditModal(id) {
  const student = allFilteredRows.find(row => String(row.id) === String(id));
  if (!student) return;
  editingId = id;
  modalTitle.textContent = 'Edit Student';
  modalSubmit.textContent = 'Update Student';
  studentForm.reset();
  clearValidation(studentForm);
  ['full_name', 'admission_no', 'class', 'section', 'roll_no', 'date_of_birth', 'gender', 'blood_group', 'category', 'house', 'father_name', 'mother_name', 'parent_phone', 'address'].forEach(key => {
    if (studentForm[key]) studentForm[key].value = student[key] || '';
  });
  formDirty = false;
  modalOverlay.hidden = false;
  studentForm.full_name.focus();
}

async function closeStudentModal() {
  if (formDirty && !await confirmAction('Discard unsaved student changes?', 'Discard')) return;
  modalOverlay.hidden = true;
  formDirty = false;
}

studentForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearValidation(studentForm);
  const payload = studentPayload();
  if (!validateStudent(payload)) return;

  setButtonLoading(modalSubmit, true, 'Saving…');
  const { error } = editingId
    ? await supabase.from('students').update(payload).eq('id', editingId)
    : await supabase.from('students').insert(payload);
  setButtonLoading(modalSubmit, false);

  if (error) {
    showToast(`Student could not be saved: ${error.message}`, 'error');
    return;
  }

  await logActivity(editingId ? 'Student updated' : 'Student added', `${payload.full_name} · Class ${payload.class}${payload.section}`);
  showToast(editingId ? 'Student updated successfully.' : 'Student added successfully.', 'success');
  modalOverlay.hidden = true;
  formDirty = false;
  await fetchStudents();
});

function studentPayload() {
  const form = studentForm;
  return {
    full_name: form.full_name.value.trim(),
    admission_no: form.admission_no.value.trim(),
    class: form.class.value,
    section: form.section.value,
    roll_no: form.roll_no.value.trim(),
    date_of_birth: form.date_of_birth.value || null,
    gender: form.gender.value,
    blood_group: form.blood_group.value || null,
    category: form.category.value,
    house: form.house.value || null,
    father_name: form.father_name.value.trim() || null,
    mother_name: form.mother_name.value.trim() || null,
    parent_phone: form.parent_phone.value.trim() || null,
    address: form.address.value.trim() || null
  };
}

function validateStudent(payload) {
  let valid = true;
  if (!payload.full_name) valid = fieldInvalid(studentForm.full_name, 'Full name is required.') && valid;
  if (!payload.admission_no) valid = fieldInvalid(studentForm.admission_no, 'Admission number is required.') && valid;
  if (!payload.class) valid = fieldInvalid(studentForm.class, 'Class is required.') && valid;
  if (!payload.section) valid = fieldInvalid(studentForm.section, 'Section is required.') && valid;
  if (payload.parent_phone && !/^[0-9+\-\s]{7,15}$/.test(payload.parent_phone)) valid = fieldInvalid(studentForm.parent_phone, 'Enter a valid phone number.') && valid;
  if (!valid) showToast('Please correct the highlighted fields.', 'warning');
  return valid;
}

function fieldInvalid(control, message) {
  control.classList.add('invalid-field');
  control.setAttribute('aria-invalid', 'true');
  let error = control.parentElement.querySelector('.field-error-text');
  if (!error) {
    error = document.createElement('span');
    error.className = 'field-error-text';
    control.insertAdjacentElement('afterend', error);
  }
  error.textContent = message;
  control.focus();
  return false;
}

function clearValidation(form) {
  form.querySelectorAll('.invalid-field').forEach(control => { control.classList.remove('invalid-field'); control.removeAttribute('aria-invalid'); });
  form.querySelectorAll('.field-error-text').forEach(error => error.remove());
}

async function archiveStudent(id, name) {
  archiveId = id;
  const confirmed = await confirmAction(`Archive ${name}? The record will be hidden but retained for audit and restoration.`, 'Archive');
  if (!confirmed) return;
  const { error } = await supabase.from('students').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', archiveId);
  if (error) {
    showToast(`Archive failed. Run the updated Supabase schema first. ${error.message}`, 'error', 6500);
    return;
  }
  await logActivity('Student archived', name);
  showToast('Student archived safely.', 'success');
  await fetchStudents();
}

function addExportButton() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions || document.getElementById('export-students-btn')) return;
  const button = document.createElement('button');
  button.id = 'export-students-btn';
  button.className = 'btn-secondary';
  button.type = 'button';
  button.textContent = 'Export CSV';
  button.addEventListener('click', () => {
    if (!allFilteredRows.length) { showToast('No student records to export.', 'warning'); return; }
    downloadCSV('jnv-students.csv', allFilteredRows, [
      { label: 'Admission No', value: 'admission_no' }, { label: 'Full Name', value: 'full_name' },
      { label: 'Class', value: 'class' }, { label: 'Section', value: 'section' }, { label: 'Roll No', value: 'roll_no' },
      { label: 'Gender', value: 'gender' }, { label: 'House', value: 'house' }, { label: 'Category', value: 'category' },
      { label: 'Father Name', value: 'father_name' }, { label: 'Mother Name', value: 'mother_name' },
      { label: 'Parent Phone', value: 'parent_phone' }, { label: 'Address', value: 'address' }
    ]);
    showToast('Student CSV exported.', 'success');
  });
  actions.prepend(button);
}

importBtn.addEventListener('click', () => {
  parsedImport = [];
  document.getElementById('csv-file-input').value = '';
  csvStatus.textContent = 'Select a CSV file to validate and preview it before importing.';
  removeCSVPreview();
  csvUploadBtn.textContent = 'Validate CSV';
  csvModal.hidden = false;
});
document.getElementById('csv-modal-close').addEventListener('click', () => { csvModal.hidden = true; });
document.getElementById('csv-file-input').addEventListener('change', () => {
  parsedImport = [];
  csvUploadBtn.textContent = 'Validate CSV';
  csvStatus.textContent = 'File selected. Click Validate CSV.';
  removeCSVPreview();
});

csvUploadBtn.addEventListener('click', async () => {
  if (parsedImport.length) {
    await importValidatedRows();
    return;
  }
  const file = document.getElementById('csv-file-input').files[0];
  if (!file) { showToast('Select a CSV file first.', 'warning'); return; }
  setButtonLoading(csvUploadBtn, true, 'Validating…');
  try {
    const matrix = parseCSV(await file.text());
    const result = validateCSV(matrix);
    parsedImport = result.rows;
    renderCSVPreview(result.rows, result.errors);
    csvStatus.textContent = `${result.rows.length} valid row${result.rows.length === 1 ? '' : 's'} ready. ${result.errors.length ? `${result.errors.length} row issue${result.errors.length === 1 ? '' : 's'} found.` : 'No row errors found.'}`;
    if (result.rows.length) csvUploadBtn.textContent = `Import ${result.rows.length} Students`;
  } catch (error) {
    showToast(`CSV could not be read: ${error.message}`, 'error');
  } finally {
    if (!parsedImport.length) setButtonLoading(csvUploadBtn, false);
    else { csvUploadBtn.disabled = false; delete csvUploadBtn.dataset.originalText; }
  }
});

function validateCSV(matrix) {
  if (matrix.length < 2) throw new Error('The CSV has no data rows.');
  const headers = matrix[0].map(header => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const required = ['full_name', 'class', 'section'];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

  const allowed = new Set(['full_name','admission_no','class','section','roll_no','date_of_birth','gender','blood_group','category','house','father_name','mother_name','parent_phone','address']);
  const rows = [];
  const errors = [];
  matrix.slice(1).forEach((values, index) => {
    const row = {};
    headers.forEach((header, column) => { if (allowed.has(header)) row[header] = values[column]?.trim() || null; });
    const rowNumber = index + 2;
    if (!row.full_name || !row.class || !row.section) { errors.push(`Row ${rowNumber}: full_name, class and section are required.`); return; }
    if (!['6','7','8','9','10','11','12'].includes(String(row.class))) { errors.push(`Row ${rowNumber}: invalid class ${row.class}.`); return; }
    if (!['A','B'].includes(String(row.section).toUpperCase())) { errors.push(`Row ${rowNumber}: invalid section ${row.section}.`); return; }
    row.section = String(row.section).toUpperCase();
    rows.push(row);
  });
  return { rows, errors };
}

function renderCSVPreview(rows, errors) {
  removeCSVPreview();
  const preview = document.createElement('div');
  preview.id = 'csv-preview';
  preview.className = 'csv-preview';
  preview.innerHTML = `<table class="data-table"><thead><tr><th>Full Name</th><th>Admission No</th><th>Class</th><th>Section</th></tr></thead><tbody>${rows.slice(0, 8).map(row => `<tr><td>${display(row.full_name)}</td><td>${display(row.admission_no)}</td><td>${display(row.class)}</td><td>${display(row.section)}</td></tr>`).join('')}</tbody></table>${rows.length > 8 ? `<p class="hint-text" style="padding:8px 12px;">Showing first 8 of ${rows.length} valid rows.</p>` : ''}${errors.length ? `<div class="setup-banner" style="margin:10px;">${errors.slice(0, 5).map(escapeHTML).join('<br>')}${errors.length > 5 ? '<br>More errors omitted…' : ''}</div>` : ''}`;
  csvStatus.insertAdjacentElement('afterend', preview);
}

function removeCSVPreview() { document.getElementById('csv-preview')?.remove(); }

async function importValidatedRows() {
  setButtonLoading(csvUploadBtn, true, 'Importing…');
  const { error } = await supabase.from('students').upsert(parsedImport, { onConflict: 'admission_no' });
  setButtonLoading(csvUploadBtn, false);
  if (error) { showToast(`Import failed: ${error.message}`, 'error'); return; }
  await logActivity('Student CSV imported', `${parsedImport.length} records processed`);
  showToast(`${parsedImport.length} students imported successfully.`, 'success');
  csvStatus.textContent = `Imported ${parsedImport.length} students successfully.`;
  parsedImport = [];
  csvUploadBtn.textContent = 'Validate CSV';
  await fetchStudents();
}

window.addEventListener('beforeunload', event => {
  if (!modalOverlay.hidden && formDirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

await fetchStudents();
const params = new URLSearchParams(window.location.search);
if (params.get('action') === 'add' && isPrincipal()) openAddModal();
if (params.get('edit') && isPrincipal()) openEditModal(params.get('edit'));

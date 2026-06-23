import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth guard
const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '../index.html'; }

const role = sessionStorage.getItem('role');

// Pagination
const PAGE_SIZE = 20;
let currentPage = 1;
let totalCount = 0;
let editingId = null;
let deleteId = null;

// DOM refs
const tbody       = document.getElementById('students-tbody');
const countEl     = document.getElementById('student-count');
const pagination  = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
});

// Hide add/import for teachers
if (role === 'teacher') {
  document.getElementById('add-student-btn').style.display = 'none';
  document.getElementById('import-csv-btn').style.display = 'none';
}

// ── Fetch & render ───────────────────────────
async function fetchStudents() {
  tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Loading...</td></tr>';

  let query = supabase.from('students').select('*', { count: 'exact' });

  const search   = searchInput.value.trim();
  const cls      = document.getElementById('filter-class').value;
  const section  = document.getElementById('filter-section').value;
  const house    = document.getElementById('filter-house').value;
  const category = document.getElementById('filter-category').value;
  const gender   = document.getElementById('filter-gender').value;
  const blood    = document.getElementById('filter-blood').value;

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%`);
  }
  if (cls)      query = query.eq('class', cls);
  if (section)  query = query.eq('section', section);
  if (house)    query = query.eq('house', house);
  if (category) query = query.eq('category', category);
  if (gender)   query = query.eq('gender', gender);
  if (blood)    query = query.eq('blood_group', blood);

  query = query
    .order('class', { ascending: true })
    .order('section', { ascending: true })
    .order('roll_no', { ascending: true })
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

  const { data, count, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Error loading students.</td></tr>`;
    return;
  }

  totalCount = count || 0;
  countEl.textContent = `${totalCount} student${totalCount !== 1 ? 's' : ''} found`;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No students found.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${s.admission_no || '—'}</td>
      <td><a href="student-profile.html?id=${s.id}" style="color:#1a3a5c; text-decoration:none; font-weight:500;">${s.full_name}</a></td>
      <td>${s.class || '—'}</td>
      <td>${s.section || '—'}</td>
      <td>${s.roll_no || '—'}</td>
      <td>${s.gender || '—'}</td>
      <td>${s.house || '—'}</td>
      <td>${s.category || '—'}</td>
      <td>
        <button class="action-btn action-view" onclick="window.location.href='student-profile.html?id=${s.id}'">View</button>
        ${role !== 'teacher' ? `
          <button class="action-btn action-edit" data-id="${s.id}">Edit</button>
          <button class="action-btn action-delete" data-id="${s.id}" data-name="${s.full_name}">Delete</button>
        ` : ''}
      </td>
    </tr>
  `).join('');

  // Attach edit/delete listeners
  tbody.querySelectorAll('.action-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id, data));
  });
  tbody.querySelectorAll('.action-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name));
  });

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  pagination.innerHTML = html;
  pagination.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      fetchStudents();
    });
  });
}

// ── Filters ──────────────────────────────────
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage = 1; fetchStudents(); }, 300);
});

['filter-class','filter-section','filter-house','filter-category','filter-gender','filter-blood'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { currentPage = 1; fetchStudents(); });
});

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  searchInput.value = '';
  ['filter-class','filter-section','filter-house','filter-category','filter-gender','filter-blood'].forEach(id => {
    document.getElementById(id).value = '';
  });
  currentPage = 1;
  fetchStudents();
});

// ── Add/Edit Modal ────────────────────────────
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle   = document.getElementById('modal-title');
const studentForm  = document.getElementById('student-form');
const modalSubmit  = document.getElementById('modal-submit');

document.getElementById('add-student-btn').addEventListener('click', () => {
  editingId = null;
  modalTitle.textContent = 'Add Student';
  modalSubmit.textContent = 'Save Student';
  studentForm.reset();
  modalOverlay.hidden = false;
});

function openEditModal(id, data) {
  const s = data.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  modalTitle.textContent = 'Edit Student';
  modalSubmit.textContent = 'Update Student';

  const f = studentForm;
  f.full_name.value    = s.full_name || '';
  f.admission_no.value = s.admission_no || '';
  f.class.value        = s.class || '';
  f.section.value      = s.section || '';
  f.roll_no.value      = s.roll_no || '';
  f.date_of_birth.value = s.date_of_birth || '';
  f.gender.value       = s.gender || '';
  f.blood_group.value  = s.blood_group || '';
  f.category.value     = s.category || '';
  f.house.value        = s.house || '';
  f.father_name.value  = s.father_name || '';
  f.mother_name.value  = s.mother_name || '';
  f.parent_phone.value = s.parent_phone || '';
  f.address.value      = s.address || '';
  modalOverlay.hidden  = false;
}

['modal-close','modal-cancel'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => { modalOverlay.hidden = true; });
});

studentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalSubmit.disabled = true;
  modalSubmit.textContent = 'Saving...';

  const f = studentForm;
  const payload = {
    full_name:    f.full_name.value.trim(),
    admission_no: f.admission_no.value.trim(),
    class:        f.class.value,
    section:      f.section.value,
    roll_no:      f.roll_no.value.trim(),
    date_of_birth: f.date_of_birth.value || null,
    gender:       f.gender.value,
    blood_group:  f.blood_group.value || null,
    category:     f.category.value,
    house:        f.house.value || null,
    father_name:  f.father_name.value.trim() || null,
    mother_name:  f.mother_name.value.trim() || null,
    parent_phone: f.parent_phone.value.trim() || null,
    address:      f.address.value.trim() || null,
  };

  let error;
  if (editingId) {
    ({ error } = await supabase.from('students').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabase.from('students').insert(payload));
  }

  modalSubmit.disabled = false;
  modalSubmit.textContent = editingId ? 'Update Student' : 'Save Student';

  if (error) { alert('Error: ' + error.message); return; }

  modalOverlay.hidden = true;
  fetchStudents();
});

// ── Delete Modal ──────────────────────────────
function openDeleteModal(id, name) {
  deleteId = id;
  document.getElementById('delete-student-name').textContent = name;
  document.getElementById('delete-modal-overlay').hidden = false;
}

document.getElementById('delete-modal-close').addEventListener('click', () => {
  document.getElementById('delete-modal-overlay').hidden = true;
});
document.getElementById('delete-cancel').addEventListener('click', () => {
  document.getElementById('delete-modal-overlay').hidden = true;
});
document.getElementById('delete-confirm').addEventListener('click', async () => {
  if (!deleteId) return;
  const { error } = await supabase.from('students').delete().eq('id', deleteId);
  if (error) { alert('Error: ' + error.message); return; }
  document.getElementById('delete-modal-overlay').hidden = true;
  fetchStudents();
});

// ── CSV Import ────────────────────────────────
document.getElementById('import-csv-btn').addEventListener('click', () => {
  document.getElementById('csv-modal-overlay').hidden = false;
});
document.getElementById('csv-modal-close').addEventListener('click', () => {
  document.getElementById('csv-modal-overlay').hidden = true;
});

document.getElementById('csv-upload-btn').addEventListener('click', async () => {
  const file = document.getElementById('csv-file-input').files[0];
  const status = document.getElementById('csv-status');
  if (!file) { status.textContent = 'Please select a CSV file.'; return; }

  status.textContent = 'Parsing...';
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g,'_'));

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    if (vals.length < 3) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || null; });

    if (!row.full_name || !row.class || !row.section) {
      errors.push(`Row ${i + 1}: missing required fields`);
      continue;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    status.textContent = 'No valid rows found. ' + errors.join(', ');
    return;
  }

  status.textContent = `Importing ${rows.length} students...`;
  const { error } = await supabase.from('students').upsert(rows, { onConflict: 'admission_no' });

  if (error) {
    status.textContent = 'Import failed: ' + error.message;
    return;
  }

  status.textContent = `✓ Imported ${rows.length} students. ${errors.length > 0 ? errors.length + ' rows skipped.' : ''}`;
  fetchStudents();
});

// Init
fetchStudents();

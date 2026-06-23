import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = '../index.html'; }

const role = sessionStorage.getItem('role');

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
});

// Get student ID from URL
const params = new URLSearchParams(window.location.search);
const studentId = params.get('id');

if (!studentId) {
  window.location.href = 'students.html';
}

// Load profile
const { data: s, error } = await supabase.from('students').select('*').eq('id', studentId).single();

if (error || !s) {
  document.getElementById('profile-content').innerHTML = '<p style="color:#888;">Student not found.</p>';
} else {
  document.getElementById('profile-name').textContent = s.full_name;

  // Hide edit button for teachers
  if (role === 'teacher') {
    document.getElementById('edit-btn').style.display = 'none';
  }

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-card">
      <div class="profile-top">
        <div class="profile-photo">👤</div>
        <div>
          <div class="profile-name">${s.full_name}</div>
          <div class="profile-sub">Class ${s.class || '—'} – ${s.section || '—'} &nbsp;·&nbsp; Roll No: ${s.roll_no || '—'} &nbsp;·&nbsp; Adm: ${s.admission_no || '—'}</div>
          <div style="margin-top:8px; display:flex; gap:6px;">
            ${s.house ? `<span class="badge badge-house">${s.house} House</span>` : ''}
            ${s.category ? `<span class="badge badge-cat">${s.category}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="profile-grid">
        <div class="profile-field"><span class="profile-label">Gender</span><span class="profile-value">${s.gender || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Date of Birth</span><span class="profile-value">${s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('en-IN') : '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Blood Group</span><span class="profile-value">${s.blood_group || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Category</span><span class="profile-value">${s.category || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Father's Name</span><span class="profile-value">${s.father_name || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Mother's Name</span><span class="profile-value">${s.mother_name || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Parent Phone</span><span class="profile-value">${s.parent_phone || '—'}</span></div>
        <div class="profile-field"><span class="profile-label">Address</span><span class="profile-value">${s.address || '—'}</span></div>
      </div>
    </div>
  `;

  // Populate ID card
  document.getElementById('id-name').textContent     = s.full_name;
  document.getElementById('id-adm').textContent      = s.admission_no || '—';
  document.getElementById('id-class').textContent    = `${s.class || '—'} – ${s.section || '—'}`;
  document.getElementById('id-roll').textContent     = s.roll_no || '—';
  document.getElementById('id-house').textContent    = s.house || '—';
  document.getElementById('id-blood').textContent    = s.blood_group || '—';
  document.getElementById('id-category').textContent = s.category || '—';

  // Print ID card
  document.getElementById('print-id-btn').addEventListener('click', () => {
    document.getElementById('id-card-print').hidden = false;
    window.print();
    document.getElementById('id-card-print').hidden = true;
  });

  // Edit button — go back to students list with edit param
  document.getElementById('edit-btn').addEventListener('click', () => {
    window.location.href = `students.html?edit=${s.id}`;
  });
}

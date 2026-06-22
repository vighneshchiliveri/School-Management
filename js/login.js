import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Role toggle ──────────────────────────────
const btnStaff  = document.getElementById('btn-staff');
const btnParent = document.getElementById('btn-parent');
const roleHint  = document.getElementById('role-hint');
let currentRole = 'staff';

function setRole(role) {
  currentRole = role;
  btnStaff.classList.toggle('active', role === 'staff');
  btnParent.classList.toggle('active', role === 'parent');
  roleHint.innerHTML = role === 'staff'
    ? 'Signing in as <strong>Admin or Teacher</strong>. Contact your administrator if you need help.'
    : 'Signing in as <strong>Parent</strong>. Contact the school office if you need help.';
  clearErrors();
}

btnStaff.addEventListener('click', () => setRole('staff'));
btnParent.addEventListener('click', () => setRole('parent'));

// ── Password show/hide ───────────────────────
const passwordInput  = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');

togglePassword.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

// ── Form submit ──────────────────────────────
const form        = document.getElementById('login-form');
const submitBtn   = document.getElementById('submit-btn');
const btnLabel    = submitBtn.querySelector('.btn-label');
const btnSpinner  = submitBtn.querySelector('.btn-spinner');
const formError   = document.getElementById('form-error');
const formErrorTx = document.getElementById('form-error-text');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  setLoading(true);
  clearErrors();

  try {
    let role = null;

    if (currentRole === 'staff') {
      const { data: admin } = await supabase
        .from('admins')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

      if (admin) {
        role = 'admin';
      } else {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id, username, full_name')
          .eq('username', username)
          .single();

        if (teacher) role = 'teacher';
      }

      if (!role) throw new Error('Username not found. Please check and try again.');

      const { error } = await supabase.auth.signInWithPassword({
        email: `${username}@school.local`,
        password
      });

      if (error) throw new Error('Incorrect password. Please try again.');

      sessionStorage.setItem('role', role);
      sessionStorage.setItem('username', username);

      window.location.href = role === 'admin'
        ? 'pages/admin-dashboard.html'
        : 'pages/teacher-dashboard.html';

    } else {
      const { data: parent } = await supabase
        .from('parents')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

      if (!parent) throw new Error('Username not found. Please check and try again.');

      const { error } = await supabase.auth.signInWithPassword({
        email: `${username}@school.local`,
        password
      });

      if (error) throw new Error('Incorrect password. Please try again.');

      sessionStorage.setItem('role', 'parent');
      sessionStorage.setItem('username', username);

      window.location.href = 'pages/parent-dashboard.html';
    }

  } catch (err) {
    showFormError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ── Validation ───────────────────────────────
function validateForm() {
  let valid = true;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username) { showFieldError('username', 'Username is required.'); valid = false; }
  if (!password) { showFieldError('password', 'Password is required.'); valid = false; }
  return valid;
}

function showFieldError(field, msg) {
  document.getElementById(field).classList.add('is-error');
  document.getElementById(field + '-error').textContent = msg;
}

function showFormError(msg) {
  formErrorTx.textContent = msg;
  formError.hidden = false;
}

function clearErrors() {
  ['username', 'password'].forEach(f => {
    document.getElementById(f).classList.remove('is-error');
    document.getElementById(f + '-error').textContent = '';
  });
  formError.hidden = true;
}

function setLoading(on) {
  submitBtn.disabled = on;
  btnLabel.textContent = on ? 'Signing in…' : 'Sign in';
  btnSpinner.hidden = !on;
}

['username', 'password'].forEach(f => {
  document.getElementById(f).addEventListener('input', () => {
    document.getElementById(f).classList.remove('is-error');
    document.getElementById(f + '-error').textContent = '';
  });
});

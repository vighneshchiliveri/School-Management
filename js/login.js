import { supabase, resolveUserProfile } from './app-config.js';

const btnStaff = document.getElementById('btn-staff');
const btnParent = document.getElementById('btn-parent');
const roleHint = document.getElementById('role-hint');
let currentRole = 'staff';

function destination(role) {
  if (role === 'teacher') return 'pages/teacher-dashboard.html';
  if (role === 'parent') return 'pages/parent-dashboard.html';
  return 'pages/principal-dashboard.html';
}

function setRole(role) {
  currentRole = role;
  const staffActive = role === 'staff';
  btnStaff.classList.toggle('active', staffActive);
  btnParent.classList.toggle('active', !staffActive);
  btnStaff.setAttribute('aria-pressed', String(staffActive));
  btnParent.setAttribute('aria-pressed', String(!staffActive));
  roleHint.innerHTML = staffActive
    ? 'Signing in as <strong>Principal or Teacher</strong>. Your role is verified after authentication.'
    : 'Signing in as <strong>Parent</strong>. You can access only linked children and published notices.';
  clearErrors();
}

btnStaff.addEventListener('click', () => setRole('staff'));
btnParent.addEventListener('click', () => setRole('parent'));

const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
togglePassword.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const formError = document.getElementById('form-error');
const formErrorTx = document.getElementById('form-error-text');

const queryError = new URLSearchParams(window.location.search).get('error');
if (queryError) showFormError(queryError);

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateForm()) return;

  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = passwordInput.value;
  setLoading(true);
  clearErrors();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${username}@school.local`,
      password
    });
    if (error || !data.session) throw new Error('Incorrect username or password. Please try again.');

    const profile = await resolveUserProfile(data.session);
    const roleMatchesToggle = currentRole === 'parent' ? profile.role === 'parent' : profile.role !== 'parent';
    if (!roleMatchesToggle) {
      await supabase.auth.signOut();
      sessionStorage.clear();
      throw new Error(`This account is registered as ${profile.role}. Select the correct login type.`);
    }

    window.location.href = destination(profile.role);
  } catch (error) {
    showFormError(error.message || 'Sign in failed. Please try again.');
  } finally {
    setLoading(false);
  }
});

function validateForm() {
  let valid = true;
  const username = document.getElementById('username').value.trim();
  const password = passwordInput.value;
  if (!username) { showFieldError('username', 'Username is required.'); valid = false; }
  if (!password) { showFieldError('password', 'Password is required.'); valid = false; }
  return valid;
}

function showFieldError(field, message) {
  document.getElementById(field).classList.add('is-error');
  document.getElementById(`${field}-error`).textContent = message;
}

function showFormError(message) {
  formErrorTx.textContent = message;
  formError.hidden = false;
}

function clearErrors() {
  ['username', 'password'].forEach(field => {
    document.getElementById(field).classList.remove('is-error');
    document.getElementById(`${field}-error`).textContent = '';
  });
  formError.hidden = true;
}

function setLoading(on) {
  submitBtn.disabled = on;
  btnLabel.textContent = on ? 'Signing in…' : 'Sign in';
  btnSpinner.hidden = !on;
}

['username', 'password'].forEach(field => {
  document.getElementById(field).addEventListener('input', () => {
    document.getElementById(field).classList.remove('is-error');
    document.getElementById(`${field}-error`).textContent = '';
  });
});

const { data: { session } } = await supabase.auth.getSession();
if (session) {
  try {
    const profile = await resolveUserProfile(session);
    window.location.replace(destination(profile.role));
  } catch {
    await supabase.auth.signOut();
    sessionStorage.clear();
  }
}

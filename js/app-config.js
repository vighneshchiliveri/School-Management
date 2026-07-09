import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const JNV_HOUSES = ['Aravali', 'Nilgiri', 'Shivalik', 'Udaigiri'];
export const JNV_CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
export const SECTIONS = ['A', 'B'];
export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = '../index.html';
  return session;
}

export function getRole() {
  return sessionStorage.getItem('role') || 'admin';
}

export function canWrite() {
  return getRole() !== 'parent';
}

export async function logout() {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
}

export function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', logout);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

export function display(value, fallback = '—') {
  const text = value === null || value === undefined || value === '' ? fallback : value;
  return escapeHTML(text);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return escapeHTML(date);
  return parsed.toLocaleDateString('en-IN');
}

export function statusBadge(text) {
  const safe = escapeHTML(text || '—');
  const key = safe.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-${key}">${safe}</span>`;
}

export function showTableError(tbody, colspan, error, tableName) {
  const message = error?.message || `Unable to load ${tableName}.`;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="table-empty">${escapeHTML(message)}<br><span class="hint-text">Create/check the ${escapeHTML(tableName)} table in Supabase if this is a new module.</span></td></tr>`;
}

export function fillSelect(select, values, placeholder = 'Select') {
  select.innerHTML = `<option value="">${escapeHTML(placeholder)}</option>` + values.map(v => `<option>${escapeHTML(v)}</option>`).join('');
}

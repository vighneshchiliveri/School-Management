import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://lwoyqujqcmigfqtlbfvc.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3b3lxdWpxY21pZ2ZxdGxiZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTU3NzMsImV4cCI6MjA5NzY5MTc3M30.bCtMtepa5QD1kInndVUdohTmm2-CSZBENF8IjG1mbtk';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const JNV_HOUSES = ['Aravali', 'Nilgiri', 'Shivalik', 'Udaigiri'];
export const JNV_CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
export const SECTIONS = ['A', 'B'];
export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const ACADEMIC_SESSION = '2026–27';
export const OPERATION_TYPES = [
  'MOD Daily Report', 'Hostel / Dormitory', 'Mess & Hygiene', 'Medical Room',
  'Staff Leave', 'Duty Roster', 'Library', 'Maintenance', 'Gate Pass',
  'Visitor Register', 'Inventory / Stock', 'Student Welfare', 'School Event / Examination'
];

let verifiedProfile = null;
let sessionPromise = null;

const PAGE_ACCESS = {
  'principal-dashboard.html': ['principal'],
  'admin-dashboard.html': ['principal'],
  'teacher-dashboard.html': ['teacher'],
  'parent-dashboard.html': ['parent'],
  'students.html': ['principal', 'teacher'],
  'student-profile.html': ['principal', 'teacher'],
  'teachers.html': ['principal'],
  'parents.html': ['principal'],
  'attendance.html': ['principal', 'teacher'],
  'grades.html': ['principal', 'teacher'],
  'timetable.html': ['principal', 'teacher'],
  'notices.html': ['principal', 'teacher', 'parent'],
  'houses.html': ['principal', 'teacher'],
  'my-children.html': ['parent'],
  'operations.html': ['principal', 'teacher']
};

function pageName() {
  return window.location.pathname.split('/').pop() || '';
}

function dashboardForRole(role) {
  if (role === 'teacher') return 'teacher-dashboard.html';
  if (role === 'parent') return 'parent-dashboard.html';
  return 'principal-dashboard.html';
}

function usernameFromSession(session) {
  const email = session?.user?.email || '';
  return email.includes('@') ? email.split('@')[0].toLowerCase() : '';
}

async function findProfile(table, session, username) {
  const fields = 'id, auth_user_id, username, full_name';
  let result = await supabase.from(table).select(fields).eq('auth_user_id', session.user.id).limit(1);
  if (!result.error && result.data?.[0]) return result.data[0];

  if (username) {
    result = await supabase.from(table).select(fields).eq('username', username).limit(1);
    if (!result.error && result.data?.[0]) return result.data[0];
  }
  return null;
}

export async function resolveUserProfile(session) {
  const username = usernameFromSession(session);
  const checks = [
    ['admins', 'principal'],
    ['teachers', 'teacher'],
    ['parents', 'parent']
  ];

  for (const [table, role] of checks) {
    const profile = await findProfile(table, session, username);
    if (profile) {
      verifiedProfile = {
        ...profile,
        role,
        username: profile.username || username,
        full_name: profile.full_name || profile.username || username
      };
      sessionStorage.setItem('role', role);
      sessionStorage.setItem('username', verifiedProfile.username || '');
      sessionStorage.setItem('display_name', verifiedProfile.full_name || '');
      sessionStorage.setItem('profile_id', verifiedProfile.id || '');
      return verifiedProfile;
    }
  }

  throw new Error('Your authenticated account is not linked to an administrator, teacher, or parent profile. Contact the school administrator.');
}

export async function requireSession(allowedRoles = null) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        sessionStorage.clear();
        window.location.replace('../index.html');
        throw error || new Error('No active login session.');
      }

      let profile;
      try {
        profile = await resolveUserProfile(session);
      } catch (profileError) {
        await supabase.auth.signOut();
        sessionStorage.clear();
        window.location.replace(`../index.html?error=${encodeURIComponent(profileError.message)}`);
        throw profileError;
      }

      initAppShell(profile);
      return { ...session, profile };
    })();
  }

  const session = await sessionPromise;
  const allowed = allowedRoles || PAGE_ACCESS[pageName()] || ['principal', 'teacher', 'parent'];
  if (!allowed.includes(session.profile.role)) {
    window.location.replace(dashboardForRole(session.profile.role));
    throw new Error('You do not have permission to access this page.');
  }
  return session;
}

export function getProfile() {
  return verifiedProfile;
}

export function getRole() {
  return verifiedProfile?.role || '';
}

export function hasRole(...roles) {
  return roles.includes(getRole());
}

export function canWrite() {
  return hasRole('principal', 'teacher');
}

export function isPrincipal() {
  return hasRole('principal');
}

export async function logout() {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../index.html';
}

export function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', logout);
  }
}

export function initAppShell(profile = verifiedProfile) {
  initLogout();
  enhanceAccessibility();

  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');
  if (sidebar && main && !document.getElementById('mobile-menu-btn')) {
    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobile-menu-btn';
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.type = 'button';
    menuBtn.setAttribute('aria-label', 'Open navigation menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.innerHTML = '<span aria-hidden="true">☰</span><span>Menu</span>';
    main.prepend(menuBtn);

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-label', 'Close navigation menu');
    document.body.appendChild(overlay);

    const setOpen = (open) => {
      document.body.classList.toggle('sidebar-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', () => setOpen(!document.body.classList.contains('sidebar-open')));
    overlay.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', event => {
      if (event.target.closest('a')) setOpen(false);
    });
  }

  const logo = document.querySelector('.sidebar-logo');
  if (logo && !logo.querySelector('.academic-session')) {
    logo.insertAdjacentHTML('beforeend', `<span class="academic-session">Academic Session ${ACADEMIC_SESSION}</span>`);
  }

  const topbarActions = document.querySelector('.topbar-actions');
  if (topbarActions && !topbarActions.querySelector('.shell-print-btn')) {
    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.className = 'shell-print-btn';
    printButton.textContent = 'Print / PDF';
    printButton.addEventListener('click', () => window.print());
    topbarActions.appendChild(printButton);
  }

  const sidebarEl = document.querySelector('.sidebar');
  const logoutBtn = document.getElementById('logout-btn');
  if (sidebarEl && logoutBtn && !sidebarEl.querySelector('.sidebar-user')) {
    logoutBtn.insertAdjacentHTML('beforebegin', `
      <div class="sidebar-user">
        <span class="user-avatar" aria-hidden="true">${escapeHTML((profile?.full_name || 'U').slice(0, 1).toUpperCase())}</span>
        <span><strong>${escapeHTML(profile?.full_name || profile?.username || 'User')}</strong><small>${escapeHTML(profile?.role || '')}</small></span>
      </div>`);
  }
}

export function enhanceAccessibility() {
  if (!document.querySelector('.skip-link')) {
    document.body.insertAdjacentHTML('afterbegin', '<a class="skip-link" href="#main-content">Skip to main content</a>');
  }
  const main = document.querySelector('.main');
  if (main && !main.id) main.id = 'main-content';

  document.querySelectorAll('.field-group').forEach((group, index) => {
    const control = group.querySelector('input, select, textarea');
    const label = group.querySelector('label');
    if (!control || !label) return;
    if (!control.id) control.id = `field-${index}-${Math.random().toString(36).slice(2, 7)}`;
    label.htmlFor = control.id;
    if (control.required && !label.textContent.includes('*')) label.insertAdjacentHTML('beforeend', '<span class="required-mark" aria-hidden="true">*</span>');
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    const dialog = overlay.querySelector('.modal');
    if (!dialog) return;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = dialog.querySelector('.modal-title');
    if (title) {
      if (!title.id) title.id = `dialog-title-${Math.random().toString(36).slice(2, 7)}`;
      dialog.setAttribute('aria-labelledby', title.id);
    }
  });

  if (!document.body.dataset.escapeBound) {
    document.body.dataset.escapeBound = 'true';
    document.addEventListener('keydown', event => {
      const openOverlay = [...document.querySelectorAll('.modal-overlay')].find(el => !el.hidden);
      if (event.key === 'Escape') {
        if (openOverlay) {
          const closeControl = openOverlay.querySelector('.modal-close, [data-cancel]');
          if (closeControl) closeControl.click();
          else openOverlay.hidden = true;
        }
        document.body.classList.remove('sidebar-open');
        return;
      }
      if (event.key === 'Tab' && openOverlay) {
        const focusable = [...openOverlay.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden && el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
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

export function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(date, options = {}) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return escapeHTML(date);
  return parsed.toLocaleDateString('en-IN', options);
}

export function statusBadge(text) {
  const safe = escapeHTML(text || '—');
  const key = safe.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `<span class="status-badge status-${key}">${safe}</span>`;
}

export function showTableError(tbody, colspan, error, tableName) {
  const message = error?.message || `Unable to load ${tableName}.`;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="table-empty">${escapeHTML(message)}<br><span class="hint-text">Check the ${escapeHTML(tableName)} table and RLS policies in Supabase.</span></td></tr>`;
}

export function fillSelect(select, values, placeholder = 'Select') {
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHTML(placeholder)}</option>` + values.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('');
}

export function numericValue(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

export function compareStudentOrder(a, b) {
  const classA = numericValue(a?.class);
  const classB = numericValue(b?.class);
  if (classA !== null && classB !== null && classA !== classB) return classA - classB;
  if (classA !== classB) return classA === null ? 1 : -1;
  const sectionCompare = String(a?.section ?? '').localeCompare(String(b?.section ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  if (sectionCompare !== 0) return sectionCompare;
  const rollA = numericValue(a?.roll_no);
  const rollB = numericValue(b?.roll_no);
  if (rollA !== null && rollB !== null && rollA !== rollB) return rollA - rollB;
  if (rollA !== rollB) return rollA === null ? 1 : -1;
  const admissionCompare = String(a?.admission_no ?? '').localeCompare(String(b?.admission_no ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  if (admissionCompare !== 0) return admissionCompare;
  return String(a?.full_name ?? '').localeCompare(String(b?.full_name ?? ''), undefined, { sensitivity: 'base' });
}

export function sortStudentsByRollOrAdmission(rows) {
  return [...(rows || [])].sort(compareStudentOrder);
}

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 4200) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  window.setTimeout(() => {
    toast.classList.remove('toast-visible');
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

export function setButtonLoading(button, loading, loadingText = 'Saving…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

export function confirmAction(message, confirmLabel = 'Confirm') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-header"><h2 class="modal-title" id="confirm-title">Please confirm</h2></div>
        <div class="modal-form">
          <p class="confirm-message">${escapeHTML(message)}</p>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" data-cancel>Cancel</button>
            <button type="button" class="btn-danger" data-confirm>${escapeHTML(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = value => { overlay.remove(); resolve(value); };
    overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    overlay.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
    overlay.addEventListener('click', event => { if (event.target === overlay) finish(false); });
    overlay.querySelector('[data-cancel]').focus();
  });
}

export async function logActivity(action, details = '') {
  const profile = getProfile();
  try {
    const { error } = await supabase.from('activity_log').insert({
      action,
      details: details || null,
      actor_role: profile?.role || getRole() || null,
      actor_name: profile?.full_name || profile?.username || null,
      actor_user_id: profile?.auth_user_id || null
    });
    if (error) console.warn('Activity logging skipped:', error.message);
  } catch (error) {
    console.warn('Activity logging skipped:', error?.message || error);
  }
}

export function sanitizeSearchTerm(value) {
  return String(value || '').replace(/[,%()]/g, ' ').trim();
}

export function downloadCSV(filename, rows, columns) {
  const escapeCell = value => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };
  const headers = columns.map(column => escapeCell(column.label));
  const body = rows.map(row => columns.map(column => escapeCell(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(','));
  const blob = new Blob(['\uFEFF' + [headers.join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

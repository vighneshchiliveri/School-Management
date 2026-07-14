import {
  supabase, requireSession, initLogout, getProfile, display, escapeHTML, formatDate,
  statusBadge, isPrincipal, showToast, setButtonLoading, confirmAction,
  logActivity, sanitizeSearchTerm
} from './app-config.js';

await requireSession(['principal', 'teacher', 'parent']);
initLogout();

const profile = getProfile();
const list = document.getElementById('notices-list');
const searchInput = document.getElementById('search-input');
const audienceFilter = document.getElementById('filter-audience');
const publishBtn = document.getElementById('publish-notice-btn');
const formCard = document.getElementById('notice-form-card');

if (!isPrincipal()) formCard.style.display = 'none';
if (isPrincipal()) publishBtn.addEventListener('click', saveNotice);

let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadNotices, 300); });
audienceFilter.addEventListener('change', loadNotices);
document.getElementById('clear-filters-btn').addEventListener('click', () => { searchInput.value = ''; audienceFilter.value = ''; loadNotices(); });

async function saveNotice() {
  const titleInput = document.getElementById('notice-title');
  const messageInput = document.getElementById('notice-message');
  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  const audience = document.getElementById('notice-audience').value;
  const isPublished = document.getElementById('notice-status').value === 'Published';
  titleInput.classList.toggle('invalid-field', !title);
  messageInput.classList.toggle('invalid-field', !message);
  if (!title || !message) { showToast('Enter both a title and message.', 'warning'); return; }

  setButtonLoading(publishBtn, true, 'Saving…');
  const { error } = await supabase.from('notices').insert({
    title, message, audience, is_published: isPublished,
    created_by: profile?.full_name || profile?.username || null,
    created_by_user_id: profile?.auth_user_id || null,
    published_at: isPublished ? new Date().toISOString() : null
  });
  setButtonLoading(publishBtn, false);
  if (error) { showToast(`Notice could not be saved: ${error.message}`, 'error'); return; }

  await logActivity(isPublished ? 'Notice published' : 'Notice draft saved', `${title} · ${audience}`);
  showToast(isPublished ? 'Notice published successfully.' : 'Notice draft saved.', 'success');
  titleInput.value = '';
  messageInput.value = '';
  await loadNotices();
}

async function loadNotices() {
  list.innerHTML = '<p class="empty-state-card">Loading notices…</p>';
  let query = supabase.from('notices').select('*');
  const search = sanitizeSearchTerm(searchInput.value);
  if (search) query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  if (audienceFilter.value) query = query.eq('audience', audienceFilter.value);
  if (!isPrincipal()) query = query.eq('is_published', true);
  query = query.order('created_at', { ascending: false }).limit(100);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<p class="empty-state-card">${escapeHTML(error.message)}<br><span class="hint-text">Check the notices table and RLS policies.</span></p>`; return; }
  const rows = (data || []).filter(notice => !notice.is_archived);
  if (!rows.length) { list.innerHTML = '<p class="empty-state-card">No notices found.</p>'; return; }

  list.innerHTML = rows.map(notice => `
    <article class="notice-card">
      <div class="notice-title">${display(notice.title)}</div>
      <div class="notice-meta">${display(notice.audience || 'All')} · ${statusBadge(notice.is_published ? 'Published' : 'Unpublished')} · ${formatDate(notice.published_at || notice.created_at)} ${notice.created_by ? `· By ${display(notice.created_by)}` : ''}</div>
      <div class="notice-body">${display(notice.message || notice.body, '')}</div>
      ${isPrincipal() ? `<div class="inline-actions" style="margin-top:12px;"><button class="action-btn action-delete" data-archive="${notice.id}" data-title="${display(notice.title)}">Archive</button></div>` : ''}
    </article>`).join('');
  list.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveNotice(button.dataset.archive, button.dataset.title)));
}

async function archiveNotice(id, title) {
  if (!await confirmAction(`Archive the notice “${title}”?`, 'Archive')) return;
  const { error } = await supabase.from('notices').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast(`Archive failed. Run the updated Supabase schema first. ${error.message}`, 'error', 6500); return; }
  await logActivity('Notice archived', title);
  showToast('Notice archived safely.', 'success');
  await loadNotices();
}

await loadNotices();
if (new URLSearchParams(window.location.search).get('action') === 'add' && isPrincipal()) document.getElementById('notice-title').focus();

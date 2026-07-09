import { supabase, requireSession, initLogout, display, escapeHTML, formatDate, statusBadge, canWrite } from './app-config.js';

await requireSession();
initLogout();

const list = document.getElementById('notices-list');
const searchInput = document.getElementById('search-input');
const audienceFilter = document.getElementById('filter-audience');
const publishBtn = document.getElementById('publish-notice-btn');

if (!canWrite()) document.getElementById('notice-form-card').style.display = 'none';

publishBtn.addEventListener('click', saveNotice);
let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadNotices, 300); });
audienceFilter.addEventListener('change', loadNotices);
document.getElementById('clear-filters-btn').addEventListener('click', () => { searchInput.value = ''; audienceFilter.value = ''; loadNotices(); });

async function saveNotice() {
  const title = document.getElementById('notice-title').value.trim();
  const message = document.getElementById('notice-message').value.trim();
  const audience = document.getElementById('notice-audience').value;
  const isPublished = document.getElementById('notice-status').value === 'Published';
  if (!title || !message) { alert('Please enter title and message.'); return; }
  publishBtn.disabled = true;
  publishBtn.textContent = 'Saving...';
  const { error } = await supabase.from('notices').insert({
    title,
    message,
    audience,
    is_published: isPublished,
    created_by: sessionStorage.getItem('username') || null,
    published_at: isPublished ? new Date().toISOString() : null
  });
  publishBtn.disabled = false;
  publishBtn.textContent = 'Save Notice';
  if (error) { alert('Error: ' + error.message); return; }
  document.getElementById('notice-title').value = '';
  document.getElementById('notice-message').value = '';
  await loadNotices();
}

async function loadNotices() {
  list.innerHTML = '<p class="empty-state">Loading notices...</p>';
  let query = supabase.from('notices').select('*');
  const search = searchInput.value.trim();
  if (search) query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  if (audienceFilter.value) query = query.eq('audience', audienceFilter.value);
  if (!canWrite()) query = query.eq('is_published', true);
  query = query.order('created_at', { ascending: false }).limit(50);
  const { data, error } = await query;
  if (error) { list.innerHTML = `<p class="empty-state">${escapeHTML(error.message)}<br><span class="hint-text">Create/check the notices table in Supabase if this is a new module.</span></p>`; return; }
  if (!data || data.length === 0) { list.innerHTML = '<p class="empty-state">No notices found.</p>'; return; }
  list.innerHTML = data.map(n => `
    <div class="notice-card">
      <div class="notice-title">${display(n.title)}</div>
      <div class="notice-meta">${display(n.audience || 'All')} · ${statusBadge(n.is_published ? 'Published' : 'Unpublished')} · ${formatDate(n.created_at || n.published_at)} ${n.created_by ? '· By ' + display(n.created_by) : ''}</div>
      <div class="notice-body">${display(n.message || n.body, '')}</div>
      ${canWrite() ? `<div class="inline-actions" style="margin-top:12px;"><button class="action-btn action-delete" data-id="${n.id}">Delete</button></div>` : ''}
    </div>`).join('');
  list.querySelectorAll('.action-delete').forEach(btn => btn.addEventListener('click', () => deleteNotice(btn.dataset.id)));
}

async function deleteNotice(id) {
  if (!confirm('Delete this notice?')) return;
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await loadNotices();
}

await loadNotices();

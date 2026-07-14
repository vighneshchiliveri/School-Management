import {
  supabase, requireSession, getProfile, initLogout, escapeHTML, todayISO,
  formatDate, showToast, ACADEMIC_SESSION
} from './app-config.js';

await requireSession(['principal']);
initLogout();

const profile = getProfile();
const content = document.getElementById('dashboard-content');
const welcome = document.getElementById('welcome-msg');
const title = document.getElementById('dashboard-title');

if (title) title.textContent = 'Principal Dashboard';
if (welcome) welcome.textContent = `Welcome back, ${profile?.full_name || profile?.username || 'Principal'} · Academic Session ${ACADEMIC_SESSION}`;

renderLoading();
await loadDashboard();

async function safeQuery(promise, fallback = []) {
  try {
    const { data, error, count } = await promise;
    if (error) {
      console.warn(error.message);
      return { data: fallback, count: 0, error };
    }
    return { data: data ?? fallback, count: count ?? 0, error: null };
  } catch (error) {
    console.warn(error);
    return { data: fallback, count: 0, error };
  }
}

function sevenDayStart() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return todayISO(date);
}

async function loadDashboard() {
  const today = todayISO();
  const [studentsResult, teachersResult, parentsResult, noticesResult, todayAttendanceResult, trendResult, activityResult, operationsResult, timetableResult] = await Promise.all([
    safeQuery(supabase.from('students').select('*')),
    safeQuery(supabase.from('teachers').select('*')),
    safeQuery(supabase.from('parents').select('id,is_archived')),
    safeQuery(supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(8)),
    safeQuery(supabase.from('attendance').select('student_id,status,class,section,date').eq('date', today)),
    safeQuery(supabase.from('attendance').select('date,status').gte('date', sevenDayStart()).lte('date', today).order('date', { ascending: true })),
    safeQuery(supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10)),
    safeQuery(supabase.from('school_operations').select('id,status,priority,type,title,event_date,is_archived').neq('status', 'Closed').order('created_at', { ascending: false }).limit(50)),
    safeQuery(supabase.from('timetable').select('id,class,section,day,period_no,subject,teacher_name,is_archived'))
  ]);

  const students = studentsResult.data.filter(row => !row.is_archived);
  const teachers = teachersResult.data.filter(row => !row.is_archived);
  const parents = parentsResult.data.filter(row => !row.is_archived);
  const notices = noticesResult.data.filter(row => !row.is_archived);
  const activeStudentIds = new Set(students.map(row => row.id));
  const attendance = todayAttendanceResult.data.filter(row => activeStudentIds.has(row.student_id));
  const operations = operationsResult.data.filter(row => !row.is_archived);
  const timetable = timetableResult.data.filter(row => !row.is_archived);

  const present = attendance.filter(row => ['Present', 'Late'].includes(row.status)).length;
  const absent = attendance.filter(row => row.status === 'Absent').length;
  const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const activeTeachers = teachers.filter(row => !row.status || row.status === 'Active').length;
  const unconfiguredTeachers = teachers.filter(row => !row.permissions_configured).length;
  const staffOnLeave = operations.filter(item => item.type === 'Staff Leave' && item.event_date === today && !['Completed', 'Closed'].includes(item.status)).length;
  const staffAvailable = Math.max(0, activeTeachers - staffOnLeave);
  const publishedNotices = notices.filter(row => row.is_published).length;
  const allClassSections = [...new Set(students.filter(s => s.class && s.section).map(s => `${s.class}-${s.section}`))];
  const submittedClassSections = new Set(attendance.filter(a => a.class && a.section).map(a => `${a.class}-${a.section}`));
  const missingAttendance = allClassSections.filter(key => !submittedClassSections.has(key));
  const highPriorityOperations = operations.filter(item => item.priority === 'High' && !['Completed', 'Closed'].includes(item.status));
  const unassignedPeriods = timetable.filter(item => !item.teacher_name);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingEvents = operations.filter(item => item.type === 'School Event / Examination' && item.event_date && item.event_date >= today && item.event_date <= todayISO(nextWeek) && !['Completed', 'Closed'].includes(item.status));

  renderDashboard({
    students, teachers, parents, notices, attendance, operations,
    trend: trendResult.data,
    activity: activityResult.data,
    present, absent, rate, activeTeachers, unconfiguredTeachers, staffOnLeave, staffAvailable, publishedNotices,
    missingAttendance, highPriorityOperations, unassignedPeriods, upcomingEvents,
    tableErrors: [studentsResult, teachersResult, parentsResult, noticesResult, todayAttendanceResult, operationsResult, timetableResult].some(r => r.error)
  });
}

function renderLoading() {
  if (!content) return;
  content.innerHTML = `
    <div class="stat-grid">
      ${Array.from({ length: 4 }, () => '<div class="stat-card"><div class="stat-label skeleton">Loading metric</div><div class="stat-value skeleton" style="width:45%; margin-top:12px;">00</div><div class="stat-detail skeleton">Loading details</div></div>').join('')}
    </div>
    <div class="dashboard-grid"><div class="dashboard-panel" style="height:260px;"></div><div class="dashboard-panel" style="height:260px;"></div></div>`;
}

function renderDashboard(data) {
  const attention = buildAttention(data);
  const notices = data.notices.filter(n => n.is_published).slice(0, 5);
  const activity = data.activity.slice(0, 8);

  content.innerHTML = `
    ${data.tableErrors ? '<div class="setup-banner"><strong>Setup note:</strong> One or more Supabase tables or policies could not be read. Run <code>sql/supabase-schema.sql</code> and then <code>sql/supabase-security.sql</code> in Supabase SQL Editor.</div>' : ''}

    <div class="stat-grid">
      ${statCard('students.html', 'Students', data.students.length, '♟', `${classCount(data.students)} active class-section groups`)}
      ${statCard('attendance.html', "Today's Attendance", `${data.rate}%`, '✓', `${data.present} present · ${data.absent} absent`, data.rate >= 90 ? 'stat-trend' : 'stat-warning')}
      ${statCard('teachers.html', 'Staff Available', data.staffAvailable, '♙', `${data.staffOnLeave} on recorded leave · ${data.activeTeachers} active staff`)}
      ${statCard('notices.html', 'Published Notices', data.publishedNotices, '!', `${data.notices.length - data.publishedNotices} unpublished in recent records`)}
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">Immediate Attention</h2><p class="panel-subtitle">Items that may need action today</p></div><a class="text-link" href="operations.html">Open operations</a></div>
        <div class="attention-list">${attention}</div>
      </section>
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">Quick Actions</h2><p class="panel-subtitle">Common principal tasks</p></div></div>
        <div class="quick-action-grid">
          ${quickAction('students.html?action=add', '+', 'Add Student')}
          ${quickAction('teachers.html?action=add', '+', 'Add Teacher')}
          ${quickAction('notices.html?action=add', '!', 'Publish Notice')}
          ${quickAction('attendance.html', '✓', "Today's Attendance")}
          ${quickAction('operations.html?action=add&type=Staff%20Leave', '◷', 'Staff Leave')}
          ${quickAction('#', '⇩', 'Print Report', 'print-dashboard')}
        </div>
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">Seven-Day Attendance Trend</h2><p class="panel-subtitle">Present students as a percentage of marked attendance</p></div><a class="text-link" href="attendance.html">Attendance module</a></div>
        ${renderTrend(data.trend)}
      </section>
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">School Snapshot</h2><p class="panel-subtitle">Current enrolment and residential structure</p></div></div>
        <div class="chart-bars">
          ${snapshotRow('Girls', data.students.filter(s => String(s.gender || '').toLowerCase() === 'female').length, Math.max(data.students.length, 1))}
          ${snapshotRow('Boys', data.students.filter(s => String(s.gender || '').toLowerCase() === 'male').length, Math.max(data.students.length, 1))}
          ${snapshotRow('Parents', data.parents.length, Math.max(data.students.length, data.parents.length, 1))}
          ${snapshotRow('Active Houses', new Set(data.students.map(s => s.house).filter(Boolean)).size, 4)}
        </div>
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">Recent Notices</h2><p class="panel-subtitle">Latest published school communication</p></div><a class="text-link" href="notices.html">View all</a></div>
        <div class="activity-list">${notices.length ? notices.map(renderNotice).join('') : '<p class="empty-state">No published notices yet.</p>'}</div>
      </section>
      <section class="dashboard-panel">
        <div class="panel-header"><div><h2 class="panel-title">Recent Activity</h2><p class="panel-subtitle">Recorded changes across the portal</p></div></div>
        <div class="activity-list">${activity.length ? activity.map(renderActivity).join('') : '<p class="empty-state">No activity logged yet. New changes will appear here.</p>'}</div>
      </section>
    </div>`;

  document.getElementById('print-dashboard')?.addEventListener('click', event => {
    event.preventDefault();
    window.print();
    showToast('Print dialog opened.', 'success');
  });
}

function classCount(students) {
  return new Set(students.filter(s => s.class && s.section).map(s => `${s.class}-${s.section}`)).size;
}

function statCard(href, label, value, icon, detail, detailClass = '') {
  return `<a class="stat-card" href="${href}"><div class="stat-card-head"><div><div class="stat-label">${escapeHTML(label)}</div><div class="stat-value">${escapeHTML(value)}</div></div><span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-detail ${detailClass}">${escapeHTML(detail)}</div></a>`;
}

function quickAction(href, icon, label, id = '') {
  return `<a class="quick-action" href="${href}" ${id ? `id="${id}"` : ''}><span class="quick-action-icon" aria-hidden="true">${icon}</span><span>${escapeHTML(label)}</span></a>`;
}

function buildAttention(data) {
  const items = [];
  if (data.missingAttendance.length) {
    items.push(attentionItem('danger', `${data.missingAttendance.length} class-section attendance registers are not submitted`, data.missingAttendance.slice(0, 6).join(', ') + (data.missingAttendance.length > 6 ? '…' : '')));
  } else {
    items.push(attentionItem('success', 'Attendance submission is complete for all detected classes', 'Based on students currently assigned to class and section.'));
  }
  if (data.absent) items.push(attentionItem('danger', `${data.absent} students are marked absent today`, 'Open Attendance to review remarks and follow-up.'));
  if (data.highPriorityOperations.length) items.push(attentionItem('danger', `${data.highPriorityOperations.length} high-priority operational records are open`, data.highPriorityOperations.slice(0, 3).map(x => x.title).join(' · ')));
  if (data.unassignedPeriods.length) items.push(attentionItem('', `${data.unassignedPeriods.length} timetable periods have no teacher assigned`, data.unassignedPeriods.slice(0, 4).map(x => `Class ${x.class}${x.section} ${x.day} P${x.period_no}`).join(' · ')));
  if (data.upcomingEvents.length) items.push(attentionItem('', `${data.upcomingEvents.length} event or examination records are due within seven days`, data.upcomingEvents.slice(0, 3).map(x => `${x.event_date}: ${x.title}`).join(' · ')));
  if (data.staffOnLeave) items.push(attentionItem('', `${data.staffOnLeave} staff leave record${data.staffOnLeave === 1 ? '' : 's'} for today`, 'Review duty substitutions and the duty roster.'));
  if (data.unconfiguredTeachers) items.push(attentionItem('danger', `${data.unconfiguredTeachers} teacher account${data.unconfiguredTeachers === 1 ? '' : 's'} still use legacy broad class access`, 'Open Teachers → Set Class Access to restrict classes and subjects.'));
  const unpublished = data.notices.filter(n => !n.is_published).length;
  if (unpublished) items.push(attentionItem('', `${unpublished} recent notice drafts are unpublished`, 'Review and publish when ready.'));
  if (items.length < 2) items.push(attentionItem('success', 'No additional urgent items detected', 'Continue monitoring attendance, notices, and operations.'));
  return items.join('');
}

function attentionItem(type, title, detail) {
  return `<div class="attention-item ${type}"><span class="attention-dot"></span><div><div class="attention-title">${escapeHTML(title)}</div><div class="attention-detail">${escapeHTML(detail)}</div></div></div>`;
}

function renderTrend(rows) {
  const grouped = {};
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    grouped[todayISO(date)] = { total: 0, present: 0 };
  }
  rows.forEach(row => {
    if (!grouped[row.date]) return;
    grouped[row.date].total++;
    if (['Present', 'Late'].includes(row.status)) grouped[row.date].present++;
  });
  return `<div class="chart-bars">${Object.entries(grouped).map(([date, item]) => {
    const percent = item.total ? Math.round((item.present / item.total) * 100) : 0;
    return `<div class="chart-row"><div class="chart-label">${formatDate(date, { weekday: 'short', day: '2-digit' })}</div><div class="chart-track"><div class="chart-fill" style="width:${percent}%"></div></div><div class="chart-value">${item.total ? percent + '%' : '—'}</div></div>`;
  }).join('')}</div>`;
}

function snapshotRow(label, value, max) {
  const percent = Math.max(0, Math.min(100, Math.round((value / Math.max(max, 1)) * 100)));
  return `<div class="chart-row"><div class="chart-label">${escapeHTML(label)}</div><div class="chart-track"><div class="chart-fill" style="width:${percent}%"></div></div><div class="chart-value">${escapeHTML(value)}</div></div>`;
}

function renderNotice(notice) {
  const date = notice.published_at || notice.created_at;
  return `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><strong>${escapeHTML(notice.title)}</strong> · ${escapeHTML(notice.audience || 'All')}</div><div class="activity-time">${formatDate(date)}</div></div></div>`;
}

function renderActivity(activity) {
  return `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text">${escapeHTML(activity.action || 'Activity')}${activity.details ? ` — ${escapeHTML(activity.details)}` : ''}</div><div class="activity-time">${activity.created_at ? new Date(activity.created_at).toLocaleString('en-IN') : ''}${activity.actor_name ? ` · ${escapeHTML(activity.actor_name)}` : activity.actor_role ? ` · ${escapeHTML(activity.actor_role)}` : ''}</div></div></div>`;
}

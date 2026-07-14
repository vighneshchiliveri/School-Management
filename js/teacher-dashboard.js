import { supabase, requireSession, initLogout, getProfile, escapeHTML, todayISO, statusBadge, formatDate } from './app-config.js';

await requireSession(['teacher']);
initLogout();
const profile = getProfile();
document.getElementById('welcome-msg').textContent = `Welcome back, ${profile?.full_name || profile?.username || 'Teacher'}`;

const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
const [studentsResult, attendanceResult, timetableResult, noticesResult] = await Promise.all([
  supabase.from('students').select('id,class,section,is_archived'),
  supabase.from('attendance').select('status').eq('date', todayISO()),
  supabase.from('timetable').select('*').eq('day', weekday).order('period_no', { ascending: true }),
  supabase.from('notices').select('title,audience,published_at,created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(5)
]);

const students = (studentsResult.data || []).filter(student => !student.is_archived);
const attendance = attendanceResult.data || [];
const timetable = (timetableResult.data || []).filter(row => !row.is_archived && (!row.teacher_name || row.teacher_name.toLowerCase().includes((profile?.full_name || '').toLowerCase())));
const notices = noticesResult.data || [];
const present = attendance.filter(row => ['Present', 'Late'].includes(row.status)).length;
const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

document.getElementById('dashboard-content').innerHTML = `
  <div class="stat-grid">
    <a class="stat-card" href="students.html"><div class="stat-label">Students</div><div class="stat-value">${students.length}</div><div class="stat-detail">Active student records</div></a>
    <a class="stat-card" href="attendance.html"><div class="stat-label">Today's Attendance</div><div class="stat-value">${attendance.length ? rate + '%' : '—'}</div><div class="stat-detail">${attendance.length} records marked</div></a>
    <a class="stat-card" href="timetable.html"><div class="stat-label">Today's Periods</div><div class="stat-value">${timetable.length}</div><div class="stat-detail">${escapeHTML(weekday)}</div></a>
    <a class="stat-card" href="notices.html"><div class="stat-label">Recent Notices</div><div class="stat-value">${notices.length}</div><div class="stat-detail">Published updates</div></a>
  </div>
  <div class="dashboard-grid">
    <section class="dashboard-panel"><div class="panel-header"><div><h2 class="panel-title">Today's Work Area</h2><p class="panel-subtitle">Quick access to teaching tasks</p></div></div>
      <div class="quick-action-grid"><a class="quick-action" href="attendance.html"><span>✓</span><span>Mark Attendance</span></a><a class="quick-action" href="grades.html"><span>A+</span><span>Enter Grades</span></a><a class="quick-action" href="students.html"><span>♟</span><span>View Students</span></a><a class="quick-action" href="operations.html"><span>⚙</span><span>School Operations</span></a></div>
    </section>
    <section class="dashboard-panel"><div class="panel-header"><div><h2 class="panel-title">Today's Timetable</h2><p class="panel-subtitle">Periods matching your name, where available</p></div></div>
      <div class="activity-list">${timetable.length ? timetable.map(row => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text"><strong>Period ${escapeHTML(row.period_no)}</strong> · ${escapeHTML(row.subject)} · Class ${escapeHTML(row.class)}${escapeHTML(row.section)}</div><div class="activity-time">${escapeHTML(row.teacher_name || '')}</div></div></div>`).join('') : '<p class="empty-state">No matching periods found for today.</p>'}</div>
    </section>
  </div>
  <section class="dashboard-panel"><div class="panel-header"><div><h2 class="panel-title">Recent Notices</h2></div><a class="text-link" href="notices.html">View all</a></div>
    <div class="activity-list">${notices.length ? notices.map(notice => `<div class="activity-item"><div class="activity-dot"></div><div><div class="activity-text">${escapeHTML(notice.title)} · ${escapeHTML(notice.audience || 'All')}</div><div class="activity-time">${formatDate(notice.published_at || notice.created_at)}</div></div></div>`).join('') : '<p class="empty-state">No notices.</p>'}</div>
  </section>`;

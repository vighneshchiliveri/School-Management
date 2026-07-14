import { requireSession, getRole, ACADEMIC_SESSION, escapeHTML } from './app-config.js';

await requireSession();

const role = getRole();
const current = window.location.pathname.split('/').pop();
const nav = document.querySelector('.sidebar-nav');

const icons = {
  Dashboard: '⌂', Students: '♟', Teachers: '♙', Parents: '♧', Attendance: '✓',
  Grades: 'A+', Timetable: '◷', Notices: '!', Houses: '◆', Operations: '⚙',
  'My Children': '♡'
};

const navigation = {
  principal: [
    ['Overview', [['principal-dashboard.html', 'Dashboard']]],
    ['Academics', [['students.html', 'Students'], ['teachers.html', 'Teachers'], ['parents.html', 'Parents'], ['attendance.html', 'Attendance'], ['grades.html', 'Grades'], ['timetable.html', 'Timetable']]],
    ['School Life', [['notices.html', 'Notices'], ['houses.html', 'Houses'], ['operations.html', 'Operations']]]
  ],
  teacher: [
    ['Overview', [['teacher-dashboard.html', 'Dashboard']]],
    ['Academics', [['students.html', 'Students'], ['attendance.html', 'Attendance'], ['grades.html', 'Grades'], ['timetable.html', 'Timetable']]],
    ['School Life', [['notices.html', 'Notices'], ['houses.html', 'Houses'], ['operations.html', 'Operations']]]
  ],
  parent: [
    ['Overview', [['parent-dashboard.html', 'Dashboard']]],
    ['Student Information', [['my-children.html', 'My Children'], ['notices.html', 'Notices']]]
  ]
};

if (nav) {
  nav.innerHTML = (navigation[role] || []).map(([group, items]) => `
    <div class="nav-group">
      <div class="nav-group-title">${escapeHTML(group)}</div>
      ${items.map(([href, label]) => {
        const dashboardPair = ['admin-dashboard.html', 'principal-dashboard.html'].includes(current) && ['admin-dashboard.html', 'principal-dashboard.html'].includes(href);
        const active = href === current || dashboardPair || (current === 'student-profile.html' && href === 'students.html');
        return `<a href="${href}" class="nav-item ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>
          <span class="nav-icon" aria-hidden="true">${icons[label] || '•'}</span><span>${escapeHTML(label)}</span>
        </a>`;
      }).join('')}
    </div>`).join('');
}

document.querySelectorAll('.academic-session').forEach(el => {
  el.textContent = `Academic Session ${ACADEMIC_SESSION}`;
});

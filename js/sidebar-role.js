const role = sessionStorage.getItem('role') || 'principal';
const current = window.location.pathname.split('/').pop();
const nav = document.querySelector('.sidebar-nav');

const principalItems = [
  ['principal-dashboard.html', 'Dashboard'], ['students.html', 'Students'], ['teachers.html', 'Teachers'],
  ['parents.html', 'Parents'], ['attendance.html', 'Attendance'], ['grades.html', 'Grades'],
  ['timetable.html', 'Timetable'], ['notices.html', 'Notices'], ['houses.html', 'Houses']
];

const navItems = {
  principal: principalItems,
  admin: [
    ['admin-dashboard.html', 'Dashboard'], ['students.html', 'Students'], ['teachers.html', 'Teachers'],
    ['parents.html', 'Parents'], ['attendance.html', 'Attendance'], ['grades.html', 'Grades'],
    ['timetable.html', 'Timetable'], ['notices.html', 'Notices'], ['houses.html', 'Houses']
  ],
  teacher: [
    ['teacher-dashboard.html', 'Dashboard'], ['students.html', 'Students'], ['attendance.html', 'Attendance'],
    ['grades.html', 'Grades'], ['timetable.html', 'Timetable'], ['notices.html', 'Notices']
  ],
  parent: [
    ['parent-dashboard.html', 'Dashboard'], ['my-children.html', 'My Children'],
    ['attendance.html', 'Attendance'], ['notices.html', 'Notices']
  ]
};

if (nav) {
  const items = navItems[role] || principalItems;
  nav.innerHTML = items.map(([href, label]) => {
    const isDashboardPair = (current === 'admin-dashboard.html' && href === 'principal-dashboard.html') || (current === 'principal-dashboard.html' && href === 'admin-dashboard.html');
    const active = href === current || isDashboardPair || (current === 'student-profile.html' && href === 'students.html');
    return `<a href="${href}" class="nav-item ${active ? 'active' : ''}">${label}</a>`;
  }).join('');
}

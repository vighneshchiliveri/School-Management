const role = sessionStorage.getItem('role') || 'admin';
const current = window.location.pathname.split('/').pop();
const nav = document.querySelector('.sidebar-nav');

const navItems = {
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
  const items = navItems[role] || navItems.admin;
  nav.innerHTML = items.map(([href, label]) => {
    const active = href === current || (current === 'student-profile.html' && href === 'students.html');
    return `<a href="${href}" class="nav-item ${active ? 'active' : ''}">${label}</a>`;
  }).join('');
}

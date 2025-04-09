document.addEventListener('DOMContentLoaded', function () {
    const nav = document.querySelector('nav');
    const menuToggle = document.querySelector('.menu-toggle');

    // Menu toggle functionality
    menuToggle.addEventListener('click', function () {
        nav.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (event) {
        const isClickInside = nav.contains(event.target);
        if (!isClickInside && nav.classList.contains('menu-open')) {
            nav.classList.remove('menu-open');
        }
    });
}); 
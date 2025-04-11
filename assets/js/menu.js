document.addEventListener('DOMContentLoaded', function () {
    const nav = document.querySelector('nav');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelectorAll('.nav-links a');
    const navLinksContainer = document.querySelector('.nav-links');

    function closeMenu() {
        nav.classList.remove('menu-open');
        // Wait for transition to finish before hiding
        navLinksContainer.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'opacity' && !nav.classList.contains('menu-open')) {
                navLinksContainer.classList.add('hidden');
            }
            navLinksContainer.removeEventListener('transitionend', handler);
        });
    }

    function openMenu() {
        navLinksContainer.classList.remove('hidden');
        // Force a reflow to ensure the removal of 'hidden' takes effect
        navLinksContainer.offsetHeight;
        nav.classList.add('menu-open');
    }

    // Menu toggle functionality
    menuToggle.addEventListener('click', function () {
        if (nav.classList.contains('menu-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (event) {
        const isClickInside = nav.contains(event.target);
        if (!isClickInside && nav.classList.contains('menu-open')) {
            closeMenu();
        }
    });

    // Add click handler for nav links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (nav.classList.contains('menu-open')) {
                closeMenu();
            }
        });
    });
}); 
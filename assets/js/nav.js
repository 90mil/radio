document.addEventListener('DOMContentLoaded', function () {
    // Create header structure
    const header = document.createElement('div');
    header.className = 'fixed-header';

    // Add banner
    const banner = document.createElement('div');
    banner.className = 'banner-container';
    const bannerIframe = document.createElement('iframe');
    bannerIframe.src = 'https://90mil.github.io/radio-banner/';
    bannerIframe.frameBorder = '0';
    bannerIframe.scrolling = 'no';
    banner.appendChild(bannerIframe);

    // Create navigation
    const nav = document.createElement('nav');
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '<span class="menu-icon"></span>';

    // Add mobile header link for shows page
    if (window.location.pathname.includes('shows')) {
        const mobileHeaderLink = document.createElement('a');
        mobileHeaderLink.className = 'mobile-header-link';
        mobileHeaderLink.href = 'https://www.mixcloud.com/90milradio/';
        mobileHeaderLink.target = '_blank';
        mobileHeaderLink.innerHTML = '<span class="nav-text">mixcloud library</span>';
        nav.appendChild(mobileHeaderLink);
    }

    const navLinks = document.createElement('div');
    navLinks.className = 'nav-links';

    // Define navigation items with correct paths
    const links = [
        { href: 'https://90mil.berlin', text: '90mil home' },
        { href: '/radio/', text: 'home' },
        { href: '/radio/shows', text: 'shows' },
        { href: '/radio/schedule', text: 'schedule' },
        { href: 'https://docs.google.com/forms/d/e/1FAIpQLSejVzDBVudAlY4jlctyPiwXqQcUM-kM7cDaXZlVHuS4tr81vw/viewform', text: 'submit proposal' }
    ];

    // Create navigation links
    links.forEach(link => {
        const a = document.createElement('a');
        a.href = link.href;
        a.innerHTML = `<span class="nav-text">${link.text}</span>`;
        navLinks.appendChild(a);
    });

    // Assemble the header
    nav.appendChild(menuToggle);
    nav.appendChild(navLinks);
    header.appendChild(banner);
    header.appendChild(nav);

    // Add Mixcloud link if we're on the shows page
    if (window.location.pathname.includes('shows')) {
        const mixcloudRow = document.createElement('div');
        mixcloudRow.className = 'mixcloud-row';

        const mixcloudLinks = document.createElement('div');
        mixcloudLinks.className = 'nav-links';

        const mixcloudLink = document.createElement('a');
        mixcloudLink.href = 'https://www.mixcloud.com/90milradio/';
        mixcloudLink.target = '_blank';
        mixcloudLink.innerHTML = '<span class="nav-text">mixcloud library</span>';

        mixcloudLinks.appendChild(mixcloudLink);
        mixcloudRow.appendChild(mixcloudLinks);
        header.appendChild(mixcloudRow);
    }

    // Insert header at the start of the body
    document.body.insertBefore(header, document.body.firstChild);

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
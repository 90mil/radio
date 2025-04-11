/**
 * Lightweight SPA navigation for Jekyll sites
 * Preserves the banner iframe state while updating only content
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize page-specific functionality on first load
    if (window.PageInit) {
        window.PageInit.byPath(window.location.pathname);
    }

    // Check if the browser supports the necessary features
    if (!window.history || !window.fetch) return;

    // Track the current page to avoid unnecessary reloads
    let currentPath = window.location.pathname;

    // Get all internal navigation links
    const navLinks = document.querySelectorAll('a[href^="/"], a[href^="' + document.baseURI + '"]');

    // Attach click event to each internal link
    navLinks.forEach(link => {
        // Skip links that should force a full page load
        if (link.hasAttribute('data-no-spa')) return;

        // Skip external links and anchor links
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http')) return;

        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Get the target URL
            const targetUrl = this.href;
            const targetPath = new URL(targetUrl).pathname;

            // Don't reload the current page
            if (targetPath === currentPath) return;

            // Update navigation history
            window.history.pushState({ path: targetPath }, '', targetUrl);

            // Show a loading indicator
            document.body.classList.add('loading-page');

            // Fetch the new page
            fetch(targetUrl)
                .then(response => response.text())
                .then(html => {
                    // Parse the HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // Update the page title
                    document.title = doc.title;

                    // Get the main content from the new page
                    const newContent = doc.querySelector('#content-container');

                    // Get the current content container
                    const currentContent = document.querySelector('#content-container');

                    // Update just the main content, preserving the banner
                    if (newContent && currentContent) {
                        // Reset any existing page state
                        if (window.PageInit) {
                            window.PageInit.reset();
                        }

                        // Update the content
                        currentContent.innerHTML = newContent.innerHTML;

                        // Update the current path
                        currentPath = targetPath;

                        // Initialize the new page's functionality
                        setTimeout(() => {
                            if (window.PageInit) {
                                window.PageInit.byPath(targetPath);
                            }
                        }, 10);
                    } else {
                        // Fallback to full page load if content areas aren't found
                        window.location.href = targetUrl;
                    }
                })
                .catch(err => {
                    console.error('Failed to load page:', err);
                    window.location.href = targetUrl;
                })
                .finally(() => {
                    // Hide the loading indicator
                    document.body.classList.remove('loading-page');
                });
        });
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', function (event) {
        // Get the current URL from the browser
        const newPath = window.location.pathname;

        // Don't reload if we're already on this page
        if (newPath === currentPath) return;

        // Show loading indicator
        document.body.classList.add('loading-page');

        // Load the new page content
        fetch(window.location.href)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                document.title = doc.title;

                const newContent = doc.querySelector('#content-container');
                const currentContent = document.querySelector('#content-container');

                if (newContent && currentContent) {
                    // Reset any existing page state
                    if (window.PageInit) {
                        window.PageInit.reset();
                    }

                    // Update content
                    currentContent.innerHTML = newContent.innerHTML;
                    currentPath = newPath;

                    // Initialize the new page's functionality
                    setTimeout(() => {
                        if (window.PageInit) {
                            window.PageInit.byPath(newPath);
                        }
                    }, 10);
                } else {
                    window.location.reload();
                }
            })
            .catch(() => window.location.reload())
            .finally(() => {
                document.body.classList.remove('loading-page');
            });
    });
}); 
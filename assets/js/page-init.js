/**
 * Page initialization module for 90mil Radio SPA
 * Provides functions to initialize page-specific functionality
 */
window.PageInit = (function () {
    // Track page state
    const state = {
        showsInitialized: false,
        scheduleInitialized: false,
        observers: {}
    };

    // Public API
    return {
        /**
         * Initialize a page based on its path
         */
        byPath: function (path) {
            this.reset();

            if (path.includes('/shows')) {
                if (!state.showsInitialized) {
                    this.showsPage();
                    state.showsInitialized = true;
                }
            } else if (path.includes('/schedule')) {
                if (!state.scheduleInitialized) {
                    this.schedulePage();
                    state.scheduleInitialized = true;
                }
            } else if (path === '/' || path === '/radio/' || path.endsWith('/radio')) {
                this.homePage();
            }
        },

        /**
         * Reset all page-specific state
         */
        reset: function () {
            // Clean up IntersectionObservers
            Object.values(state.observers).forEach(observer => {
                if (observer) observer.disconnect();
            });
            state.observers = {};

            // Clean up schedule if it was initialized
            if (state.scheduleInitialized && typeof window.scheduleCleanup === 'function') {
                window.scheduleCleanup();
            }

            // Reset global variables that might be set by page scripts
            window.isLoadingMore = false;
            window.currentOffset = 0;

            // Reset initialization states
            state.showsInitialized = false;
            state.scheduleInitialized = false;

            // Reset show loading state
            const showContainer = document.querySelector('#show-list');
            if (showContainer) {
                showContainer.innerHTML = '';
            }

            // Clear event handlers that might be duplicated
            window.removeEventListener('scroll', window.handleScroll);
        },

        /**
         * Initialize the shows page
         */
        showsPage: function () {
            const showContainer = document.querySelector('#show-list');
            if (showContainer) {
                showContainer.innerHTML = '';
            }

            this.loadScriptIfNeeded('/radio/assets/js/shows.js', () => {
                setTimeout(() => {
                    if (typeof window.showsInit === 'function') {
                        window.showsInit();
                    } else if (typeof window.renderShows === 'function') {
                        window.renderShows();
                    }
                }, 100);
            });
        },

        /**
         * Initialize the schedule page
         */
        schedulePage: function () {
            this.loadScriptIfNeeded('/radio/assets/js/schedule.js', () => {
                if (typeof window.scheduleInit === 'function') {
                    window.scheduleInit();
                }
            });
        },

        /**
         * Initialize the home page
         */
        homePage: function () {
            // Home page initialization if needed
        },

        /**
         * Load a script if it hasn't been loaded yet
         */
        loadScriptIfNeeded: function (src, callback) {
            const isLoaded = Array.from(document.scripts).some(script =>
                script.src && script.src.includes(src.split('/').pop())
            );

            if (isLoaded) {
                callback();
            } else {
                const script = document.createElement('script');
                script.src = src;
                script.onload = callback;
                document.head.appendChild(script);
            }
        }
    };
})();

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    PageInit.byPath(window.location.pathname);
});

// Handle SPA navigation
window.addEventListener('popstate', () => {
    PageInit.byPath(window.location.pathname);
}); 
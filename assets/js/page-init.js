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
            } else if (path === '/') {
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
            
            // Clean up now playing widget
            if (typeof destroyNowPlaying === 'function') {
                destroyNowPlaying();
            }

            // Reset global widget loading states
            window.nowPlayingLoaded = false;
            window.featuredShowLoaded = false;

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
            const mainContainer = document.getElementById('content-container');
            if (mainContainer && window.handleScroll) {
                mainContainer.removeEventListener('scroll', window.handleScroll);
            }
        },

        /**
         * Initialize the shows page
         */
        showsPage: function () {
            const showContainer = document.querySelector('#show-list');
            if (showContainer) {
                showContainer.innerHTML = '';
            }

            this.loadScriptIfNeeded('/assets/js/shows.js', () => {
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
            this.loadScriptIfNeeded('/assets/js/schedule.js', () => {
                if (typeof window.scheduleInit === 'function') {
                    window.scheduleInit();
                }
            });
        },

        /**
         * Initialize the home page
         */
        homePage: function () {
            // Force reset widget loading states for home page
            window.nowPlayingLoaded = false;
            window.featuredShowLoaded = false;
            
            // Load the widget scripts first, then initialize
            this.loadScriptIfNeeded('/assets/js/featured-show.js', () => {
                // Initialize featured show widget with forced reload
                if (typeof checkAndLoadFeaturedShow === 'function') {
                    checkAndLoadFeaturedShow();
                }
            });
            
            this.loadScriptIfNeeded('/assets/js/now-playing.js', () => {
                // Initialize now playing widget with forced reload
                if (typeof checkAndLoadNowPlaying === 'function') {
                    checkAndLoadNowPlaying();
                }
            });
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
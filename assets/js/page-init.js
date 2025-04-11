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
            console.log(`Initializing page for path: ${path}`);
            // Reset state when navigating to a new page
            this.reset();

            if (path.includes('/shows')) {
                // Only initialize if not already initialized
                if (!state.showsInitialized) {
                    this.showsPage();
                    state.showsInitialized = true;
                }
            } else if (path.includes('/schedule')) {
                this.schedulePage();
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

            console.log('Page state reset');
        },

        /**
         * Initialize the shows page
         */
        showsPage: function () {
            console.log('Initializing Shows page');

            // Clear any existing content first
            const showContainer = document.querySelector('#show-list');
            if (showContainer) {
                showContainer.innerHTML = '';
            }

            // Load shows.js if needed
            this.loadScriptIfNeeded('/radio/assets/js/shows.js', () => {
                console.log('Shows script loaded');

                // Initialize shows page after a short delay
                setTimeout(() => {
                    if (typeof window.showsInit === 'function') {
                        console.log('Calling shows init function');
                        window.showsInit();
                    } else {
                        console.error('Shows init function not found!');
                        // Fallback - try to call render directly
                        if (typeof window.renderShows === 'function') {
                            console.log('Falling back to direct renderShows call');
                            window.renderShows();
                        } else {
                            console.error('Shows rendering function not found!');
                        }
                    }
                }, 100); // Short delay to ensure DOM is ready
            });
        },

        /**
         * Initialize the schedule page
         */
        schedulePage: function () {
            console.log('Initializing Schedule page');

            this.loadScriptIfNeeded('/radio/assets/js/schedule.js', () => {
                // Directly call schedule initialization here or through a global function
                if (typeof window.scheduleInit === 'function') {
                    window.scheduleInit();
                } else {
                    console.error('Schedule init function not found!');
                }
            });
        },

        /**
         * Initialize the home page
         */
        homePage: function () {
            console.log('Initializing Home page');
            // Add any home page specific initialization
        },

        /**
         * Load a script if it hasn't been loaded yet
         */
        loadScriptIfNeeded: function (src, callback) {
            // Check if script is already loaded
            const isLoaded = Array.from(document.scripts).some(script =>
                script.src && script.src.includes(src.split('/').pop())
            );

            if (isLoaded) {
                console.log(`Script ${src} already loaded, calling callback directly`);
                callback();
            } else {
                console.log(`Loading script: ${src}`);
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    console.log(`Script loaded: ${src}`);
                    callback();
                };
                script.onerror = (err) => {
                    console.error(`Error loading script ${src}:`, err);
                };
                document.head.appendChild(script);
            }
        }
    };
})(); 
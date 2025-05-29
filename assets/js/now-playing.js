// Now Playing Widget
class NowPlayingWidget {
    constructor() {
        this.apiUrl = 'https://neunzugmilradio.airtime.pro/api/week-info';
        this.refreshInterval = 30000; // 30 seconds
        this.intervalId = null;
        this.container = null;
        this.isActive = false;
    }

    init() {
        this.container = document.querySelector('.now-playing');
        if (!this.container) return;

        this.isActive = true;
        this.updateNowPlaying();
        this.startAutoRefresh();
    }

    destroy() {
        this.isActive = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    startAutoRefresh() {
        if (this.intervalId) clearInterval(this.intervalId);
        
        this.intervalId = setInterval(() => {
            if (this.isActive) {
                this.updateNowPlaying();
            }
        }, this.refreshInterval);
    }

    async updateNowPlaying() {
        if (!this.container) return;

        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            const currentShow = this.getCurrentShow(data);
            
            this.renderNowPlaying(currentShow);
        } catch (error) {
            console.warn('Error fetching now playing data:', error);
            this.renderFallback();
        }
    }

    getCurrentShow(data) {
        const now = new Date();
        const currentDay = this.getCurrentDayKey(now);
        const todayShows = data[currentDay] || [];

        // Filter out the generic "90mil Radio" entries and find current show
        const activeShows = todayShows.filter(show => 
            show.name !== "90mil Radio" && 
            new Date(show.start_timestamp) <= now && 
            new Date(show.end_timestamp) > now
        );

        return activeShows.length > 0 ? activeShows[0] : null;
    }

    getCurrentDayKey(date) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[date.getDay()];
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    renderNowPlaying(show) {
        if (!show) {
            this.renderOffAir();
            return;
        }

        const startTime = this.formatTime(show.start_timestamp);
        const endTime = this.formatTime(show.end_timestamp);
        const showName = this.decodeHtmlEntities(show.name);
        const description = show.description ? this.decodeHtmlEntities(show.description) : '';

        this.container.innerHTML = `
            <div class="now-playing-content">
                <h2>Now Playing</h2>
                <div class="show-info">
                    <div class="show-title">${showName}</div>
                    <div class="show-time">${startTime} - ${endTime}</div>
                    ${description ? `<div class="show-description">${description}</div>` : ''}
                </div>
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    <span class="live-text">LIVE</span>
                </div>
            </div>
        `;
    }

    renderOffAir() {
        this.container.innerHTML = `
            <div class="now-playing-content">
                <h2>Now Playing</h2>
                <div class="show-info">
                    <div class="show-title">Off Air</div>
                    <div class="show-description">No scheduled programming at the moment</div>
                </div>
                <div class="live-indicator off-air">
                    <span class="live-text">OFF AIR</span>
                </div>
            </div>
        `;
    }

    renderFallback() {
        this.container.innerHTML = `
            <div class="now-playing-content">
                <h2>Now Playing</h2>
                <div class="show-info">
                    <div class="show-title">90mil Radio</div>
                    <div class="show-description">Independent experimental radio from Berlin</div>
                </div>
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    <span class="live-text">LIVE</span>
                </div>
            </div>
        `;
    }
}

// Global instance and state tracking
let nowPlayingWidget = null;
window.nowPlayingLoaded = false;

// Function to check and load now playing widget
function checkAndLoadNowPlaying() {
    // Check if we're on the right page and elements exist
    const nowPlayingContainer = document.querySelector('.now-playing');
    
    if (!nowPlayingContainer) {
        // Clean up if container doesn't exist
        if (nowPlayingWidget) {
            destroyNowPlaying();
        }
        return false;
    }
    
    // Always force reload to ensure widgets work after SPA navigation
    initNowPlaying();
    window.nowPlayingLoaded = true;
    return true;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initial load
    checkAndLoadNowPlaying();
});

// Initialize function that can be called from page navigation
function initNowPlaying() {
    // Clean up existing instance
    if (nowPlayingWidget) {
        nowPlayingWidget.destroy();
    }
    
    // Create new instance if container exists
    const container = document.querySelector('.now-playing');
    if (container) {
        nowPlayingWidget = new NowPlayingWidget();
        nowPlayingWidget.init();
    }
}

// Cleanup function for page navigation
function destroyNowPlaying() {
    if (nowPlayingWidget) {
        nowPlayingWidget.destroy();
        nowPlayingWidget = null;
    }
    window.nowPlayingLoaded = false;
}

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NowPlayingWidget, initNowPlaying, destroyNowPlaying, checkAndLoadNowPlaying };
} 
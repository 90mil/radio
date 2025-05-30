// Now Playing Widget
class NowPlayingWidget {
    constructor() {
        this.weekApiUrl = 'https://neunzugmilradio.airtime.pro/api/week-info';
        this.liveApiUrl = 'https://neunzugmilradio.airtime.pro/api/live-info';
        this.refreshInterval = 30000; // 30 seconds
        this.intervalId = null;
        this.container = null;
        this.isActive = false;
    }

    init() {
        this.container = document.getElementById('now-playing-content');
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
            let liveData = null;
            
            // First try to get live show info
            const liveResponse = await fetch(this.liveApiUrl, { cache: 'no-store' });
            if (liveResponse.ok) {
                liveData = await liveResponse.json();
                
                // Check if there's a current show that's not autodj
                if (liveData.currentShow && liveData.currentShow.length > 0) {
                    const currentShow = liveData.currentShow[0];
                    
                    // If it's a real show (not "90mil Radio"), display it
                    if (currentShow.name !== "90mil Radio") {
                        this.renderLiveShow(currentShow, liveData.current);
                        return;
                    }
                }
            }
            
            // Try to get scheduled shows
            const weekResponse = await fetch(this.weekApiUrl);
            if (weekResponse.ok) {
                const weekData = await weekResponse.json();
                const currentShow = this.getCurrentShow(weekData);
                
                if (currentShow) {
                    this.renderScheduledShow(currentShow);
                    return;
                }
            }
            
            // Fallback to autodj if no scheduled show and we have live data
            if (liveData && liveData.current && liveData.current.metadata && liveData.current.metadata.track_title) {
                this.renderAutodj(liveData.current);
                return;
            }
            
            // If nothing else, show off air
            this.renderOffAir();
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

    renderLiveShow(show, current) {
        const showName = this.decodeHtmlEntities(show.name);
        const isLive = current && current.type === 'livestream';
        
        let timeInfo = '';
        if (current && current.starts && current.ends) {
            const startTime = this.formatTime(current.starts);
            const endTime = this.formatTime(current.ends);
            timeInfo = `${startTime} - ${endTime}`;
        }

        // Get description from show data
        const description = show.description ? this.decodeHtmlEntities(show.description) : '';

        this.container.innerHTML = `
            <div class="show-info">
                <div class="show-title">${showName}</div>
                ${timeInfo ? `<div class="show-time">${timeInfo}</div>` : ''}
                ${description ? `<div class="show-description">${description}</div>` : ''}
            </div>
            <div class="live-indicator">
                ${isLive ? '<span class="live-dot"></span>' : ''}
                <span class="live-text">${isLive ? 'LIVE' : 'ON AIR'}</span>
            </div>
        `;
    }

    renderAutodj(current) {
        const trackTitle = this.decodeHtmlEntities(current.metadata.track_title || 'Unknown Track');
        
        // Remove .mp3 extension if present
        const cleanTitle = trackTitle.replace(/\.mp3$/, '');
        
        // Parse title and host from track title if it contains "hosted by"
        let title = cleanTitle;
        let host = '';
        
        if (cleanTitle.includes("hosted by")) {
            const parts = cleanTitle.split("hosted by").map(part => part.trim());
            title = parts[0];
            host = parts[1] || '';
        }

        // Get description if available
        const description = current.metadata.description ? this.decodeHtmlEntities(current.metadata.description) : '';

        this.container.innerHTML = `
            <div class="show-info">
                <div class="show-title">${title}</div>
                ${host ? `<div class="show-host">hosted by ${host}</div>` : ''}
                ${description ? `<div class="show-description">${description}</div>` : ''}
            </div>
            <div class="live-indicator archives">
                <span class="live-text">FROM THE ARCHIVES</span>
            </div>
        `;
    }

    renderScheduledShow(show) {
        const startTime = this.formatTime(show.start_timestamp);
        const endTime = this.formatTime(show.end_timestamp);
        const showName = this.decodeHtmlEntities(show.name);
        const description = show.description ? this.decodeHtmlEntities(show.description) : '';

        this.container.innerHTML = `
            <div class="show-info">
                <div class="show-title">${showName}</div>
                <div class="show-time">${startTime} - ${endTime}</div>
                ${description ? `<div class="show-description">${description}</div>` : ''}
            </div>
            <div class="live-indicator">
                <span class="live-dot"></span>
                <span class="live-text">ON AIR</span>
            </div>
        `;
    }

    renderOffAir() {
        this.container.innerHTML = `
            <div class="show-info">
                <div class="show-title">Off Air</div>
                <div class="show-description">No scheduled programming at the moment</div>
            </div>
            <div class="live-indicator off-air">
                <span class="live-text">OFF AIR</span>
            </div>
        `;
    }

    renderFallback() {
        this.container.innerHTML = `
            <div class="show-info">
                <div class="show-title">Off Air</div>
                <div class="show-description">No scheduled programming at the moment</div>
            </div>
            <div class="live-indicator off-air">
                <span class="live-text">OFF AIR</span>
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
    const nowPlayingContainer = document.getElementById('now-playing-content');
    
    if (!nowPlayingContainer) {
        // Clean up if container doesn't exist
        if (nowPlayingWidget) {
            destroyNowPlaying();
        }
        return false;
    }
    
    // Always force reload to ensure widgets work after SPA navigation
    initNowPlaying();
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
    
    // Reset state
    window.nowPlayingLoaded = false;
    
    // Create new instance if container exists
    const container = document.getElementById('now-playing-content');
    if (container) {
        // Clear container
        container.innerHTML = '';
        
        // Create and initialize widget
        nowPlayingWidget = new NowPlayingWidget();
        nowPlayingWidget.init();
        window.nowPlayingLoaded = true;
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
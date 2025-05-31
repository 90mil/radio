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
            // Get live data
            const liveResponse = await fetch(this.liveApiUrl, { cache: 'no-store' });
            if (liveResponse.ok) {
                const liveData = await liveResponse.json();
                
                // Check if there's actual live content (not autodj)
                const isLiveShow = liveData.currentShow && 
                                   liveData.currentShow.length > 0 && 
                                   liveData.currentShow[0].name !== "90mil Radio" &&
                                   !liveData.currentShow[0].auto_dj;
                
                if (isLiveShow) {
                    this.renderLiveShow(liveData.currentShow[0], liveData.current, liveData.next);
                } else if (liveData.current && liveData.current.metadata && liveData.current.metadata.track_title) {
                    // Show archived content
                    this.renderArchivedContent(liveData.current, liveData.next);
                } else {
                    this.renderOffAir();
                }
                return;
            }
            
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

    roundToNearestHalfHourAndAdjustCET(date) {
        // Create a copy of the date to avoid modifying the original
        const adjustedDate = new Date(date);

        // Get timezone offset in hours for the current date
        // During summer time (DST) it will be 2, during winter time it will be 1
        const cetOffset = adjustedDate.getTimezoneOffset() === -120 ? 2 : 1;

        // Add the correct offset
        adjustedDate.setHours(adjustedDate.getHours() + cetOffset);

        const minutes = adjustedDate.getMinutes();
        let roundedMinutes;

        if (minutes < 15) {
            roundedMinutes = 0;
        } else if (minutes < 45) {
            roundedMinutes = 30;
        } else {
            roundedMinutes = 0;
            adjustedDate.setHours(adjustedDate.getHours() + 1);
        }

        adjustedDate.setMinutes(roundedMinutes, 0, 0);
        return adjustedDate;
    }

    formatTime(timestamp) {
        // Convert timestamp to Date object and round to nominal show time
        const date = new Date(timestamp);
        const nominalDate = this.roundToNearestHalfHourAndAdjustCET(date);
        
        return nominalDate.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    }
    
    formatTimeWithTimezone(timestamp) {
        // Convert timestamp to Date object and round to nominal show time
        const date = new Date(timestamp);
        const nominalDate = this.roundToNearestHalfHourAndAdjustCET(date);
        
        const timeString = nominalDate.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
        
        // Use CEST/CET based on DST
        const isDST = this.isDaylightSavingTime(nominalDate);
        const timezone = isDST ? 'CEST' : 'CET';
        
        return `${timeString} ${timezone}`;
    }
    
    formatTitleWithTime(title, startTime, endTime) {
        if (startTime && endTime) {
            const start = this.formatTime(startTime);
            const end = this.formatTimeWithTimezone(endTime);
            return `${title} <span class="time-display">${start} - ${end}</span>`;
        }
        return title;
    }
    
    isDaylightSavingTime(date) {
        // Create dates for start and end of DST in Berlin
        const year = date.getFullYear();
        const dstStart = new Date(year, 2, 31); // Last Sunday in March
        dstStart.setDate(31 - ((dstStart.getDay() + 6) % 7));
        dstStart.setHours(2, 0, 0, 0);
        
        const dstEnd = new Date(year, 9, 31); // Last Sunday in October
        dstEnd.setDate(31 - ((dstEnd.getDay() + 6) % 7));
        dstEnd.setHours(3, 0, 0, 0);
        
        return date >= dstStart && date < dstEnd;
    }

    formatOriginallyAired(metadata) {
        if (metadata.year && metadata.mtime) {
            const originalDate = new Date(metadata.mtime);
            return `Aired ${originalDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            })}`;
        }
        return '';
    }

    decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    renderLiveShow(show, current, next) {
        const showName = this.decodeHtmlEntities(show.name);
        const isLive = current && current.type === 'livestream';
        
        // Parse show name for host information like we do for next show
        let title = showName;
        let host = '';
        
        if (showName.includes("hosted by")) {
            const parts = showName.split("hosted by").map(part => part.trim());
            title = parts[0];
            host = parts[1] || '';
        }
        
        // Format title with time
        let showTitleWithTime = title;
        if (current && current.starts && current.ends) {
            showTitleWithTime = this.formatTitleWithTime(title, current.starts, current.ends);
        }

        // Get description from show data
        const description = show.description ? this.decodeHtmlEntities(show.description) : '';

        // Status for current show
        const currentStatus = isLive ? 'LIVE' : 'ON AIR';

        // Next up info
        let nextUpHtml = '';
        if (next && next.metadata && next.metadata.track_title) {
            const nextTitle = this.decodeHtmlEntities(next.metadata.track_title).replace(/\.mp3$/, '');
            let nextHost = '';
            let nextShowTitle = nextTitle;
            
            if (nextTitle.includes("hosted by")) {
                const parts = nextTitle.split("hosted by").map(part => part.trim());
                nextShowTitle = parts[0];
                nextHost = parts[1] || '';
            }
            
            let nextTitleWithTime = nextShowTitle;
            let nextAiredDate = '';
            const nextDescription = next.metadata.description ? this.decodeHtmlEntities(next.metadata.description) : '';
            if (next.starts && next.ends) {
                nextTitleWithTime = this.formatTitleWithTime(nextShowTitle, next.starts, next.ends);
                nextAiredDate = this.formatOriginallyAired(next.metadata);
            }
            
            nextUpHtml = `
                <div class="next-section">
                    <div class="section-label">NEXT:</div>
                    <div class="section-title">${nextTitleWithTime}</div>
                    ${nextHost ? `<div class="section-host">hosted by ${nextHost}</div>` : ''}
                    ${nextDescription ? `<div class="section-description">${nextDescription}</div>` : ''}
                    <div class="section-status">
                        ${nextAiredDate ? `<span class="aired-date">${nextAiredDate}</span>` : ''}
                        <span class="status-label">FROM THE ARCHIVES</span>
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="now-section">
                <div class="section-label">NOW:</div>
                <div class="section-title">${showTitleWithTime}</div>
                ${host ? `<div class="section-host">hosted by ${host}</div>` : ''}
                ${description ? `<div class="section-description">${description}</div>` : ''}
                <div class="section-status">
                    <span class="aired-date"></span><span class="status-label">${currentStatus}</span>
                </div>
            </div>
            ${nextUpHtml}
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

    renderArchivedContent(current, next) {
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

        // Format title with time and originally aired
        let showTitleWithTime = title;
        let airedDate = '';
        if (current.starts && current.ends) {
            showTitleWithTime = this.formatTitleWithTime(title, current.starts, current.ends);
            airedDate = this.formatOriginallyAired(current.metadata);
        }

        // Next up info
        let nextUpHtml = '';
        if (next && next.metadata && next.metadata.track_title) {
            const nextTitle = this.decodeHtmlEntities(next.metadata.track_title).replace(/\.mp3$/, '');
            let nextHost = '';
            let nextShowTitle = nextTitle;
            
            if (nextTitle.includes("hosted by")) {
                const parts = nextTitle.split("hosted by").map(part => part.trim());
                nextShowTitle = parts[0];
                nextHost = parts[1] || '';
            }
            
            let nextTitleWithTime = nextShowTitle;
            let nextAiredDate = '';
            const nextDescription = next.metadata.description ? this.decodeHtmlEntities(next.metadata.description) : '';
            if (next.starts && next.ends) {
                nextTitleWithTime = this.formatTitleWithTime(nextShowTitle, next.starts, next.ends);
                nextAiredDate = this.formatOriginallyAired(next.metadata);
            }
            
            nextUpHtml = `
                <div class="next-section">
                    <div class="section-label">NEXT:</div>
                    <div class="section-title">${nextTitleWithTime}</div>
                    ${nextHost ? `<div class="section-host">hosted by ${nextHost}</div>` : ''}
                    ${nextDescription ? `<div class="section-description">${nextDescription}</div>` : ''}
                    <div class="section-status">
                        ${nextAiredDate ? `<span class="aired-date">${nextAiredDate}</span>` : ''}
                        <span class="status-label">FROM THE ARCHIVES</span>
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="now-section">
                <div class="section-label">NOW:</div>
                <div class="section-title">${showTitleWithTime}</div>
                ${host ? `<div class="section-host">hosted by ${host}</div>` : ''}
                ${description ? `<div class="section-description">${description}</div>` : ''}
                <div class="section-status">
                    ${airedDate ? `<span class="aired-date">${airedDate}</span>` : ''}
                    <span class="status-label">FROM THE ARCHIVES</span>
                </div>
            </div>
            ${nextUpHtml}
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
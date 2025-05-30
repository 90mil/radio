// Global variable to track if we've loaded the data
window.featuredShowLoaded = false;

// Cache configuration
const CACHE_KEY = 'featuredShowData';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Function to get cached data
function getCachedData() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still fresh
        if (now - timestamp < CACHE_DURATION) {
            return data;
        } else {
            // Cache expired, remove it
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
}

// Function to cache data
function setCachedData(data) {
    try {
        const cacheObject = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
    } catch (error) {
        console.error('Error setting cache:', error);
    }
}

// Function to show loading state
function showLoadingState() {
    const showContent = document.querySelector('.show-content');
    
    // Hide the entire content container
    if (showContent) {
        showContent.style.opacity = '0';
        showContent.style.transition = 'opacity 0.3s ease';
    }
}

// Function to hide loading state
function hideLoadingState() {
    const showContent = document.querySelector('.show-content');
    
    // Fade in the entire content container
    if (showContent) {
        showContent.style.opacity = '1';
        showContent.style.transition = 'opacity 0.3s ease';
    }
}

// Function to check and load featured show data
function checkAndLoadFeaturedShow() {
    // Check if we're on the right page and elements exist
    const showImage = document.getElementById('featured-show-image');
    const showTitle = document.getElementById('featured-show-title');
    const showContent = document.querySelector('.show-content');
    
    if (!showImage || !showTitle || !showContent) {
        return false;
    }
    
    // Reset the loaded state and clear any existing content
    window.featuredShowLoaded = false;
    
    // Clear existing content to force fresh appearance
    showContent.style.opacity = '0';
    if (showImage) {
        showImage.src = '';
        showImage.classList.remove('loaded');
    }
    if (showTitle) showTitle.textContent = '';
    
    // Remove any existing subtitles
    const existingSubtitle = document.querySelector('.subtitle');
    if (existingSubtitle) {
        existingSubtitle.remove();
    }
    
    // Force fresh data fetch instead of using cache
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('featuredShowData');
        localStorage.removeItem('featuredShowTimestamp');
    }
    
    // Start loading
    showLoadingState();
    fetchFeaturedShow();
    
    return true;
}

// Function to populate show data (from cache or API)
function populateShowData(showData) {
    const showImage = document.getElementById('featured-show-image');
    const showTitle = document.getElementById('featured-show-title');
    const descriptionEl = document.getElementById('featured-show-description');
    const genresEl = document.getElementById('featured-show-genres');
    
    // Update the show image
    let imageUrl = null;
    if (showData.pictures) {
        imageUrl = showData.pictures.extra_large ||
                  showData.pictures.large ||
                  showData.pictures.medium_large ||
                  showData.pictures.medium ||
                  showData.pictures.small ||
                  showData.pictures.thumbnail;
    }
    
    if (imageUrl && showImage) {
        showImage.src = imageUrl;
        showImage.alt = `${showData.name} artwork`;
        showImage.style.display = 'block';
        
        showImage.onload = function() {
            this.classList.add('loaded');
            this.style.transition = 'opacity 0.3s ease';
            this.style.opacity = '1';
        };
        
        showImage.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDE4MCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMTgwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz4KPHN2ZyB4PSI3MCIgeT0iNzAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0zIDIyVjJsMTggMTBMMzIyeiIvPgo8L3N2Zz4KPC9zdmc+';
            this.style.opacity = '1';
        };
        
    } else if (showImage) {
        showImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDE4MCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMTgwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz4KPHN2ZyB4PSI3MCIgeT0iNzAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0zIDIyVjJsMTggMTBMMzIyeiIvPgo8L3N2Zz4KPC9zdmc+';
        showImage.style.opacity = '1';
    }
    
    // Update the show title with animation
    const title = showData.name.split(' (')[0];
    const subtitle = showData.name.includes('(') ? showData.name.match(/\(([^)]+)\)/)?.[1] : '';
    
    if (showTitle) {
        showTitle.style.transition = 'opacity 0.3s ease';
        showTitle.textContent = title;
    }
    
    // Update the description with animation
    if (descriptionEl) {
        descriptionEl.style.transition = 'opacity 0.3s ease';
        // Override with custom description for Tales of Our Inner Kingdoms
        const customDescription = `A concept series imagined by Random Kingdom

In the hush of night, when the veil between past and present thins, stories emerge—not as linear truths, but as echoes, fragments, whispering their way back into form.

Tales of Our Inner Kingdoms is a seven-episode sonic odyssey. Each episode unfolds the journey of a soul— distant
from its own life. Across an hour of intimate narration, memory and imagination blur, listeners are pulled into a world
where voices, field recordings, music, and poetry entwine. This is storytelling as invocation—an act of deep listening, a way to feel the weight of lives that came before.`;
        
        descriptionEl.textContent = customDescription;
    }
    
    // Update the genres with animation
    if (genresEl) {
        genresEl.style.transition = 'opacity 0.3s ease';
        const genres = showData.tags?.map(tag => tag.name).join(', ') || 'Ambient, Poetry, Soundscape, Radio, Electroacoustic';
        genresEl.textContent = `Genres: ${genres}`;
    }
    
    // Add subtitle if it exists
    if (subtitle && showTitle) {
        const existingSubtitle = showTitle.parentNode.querySelector('.subtitle');
        if (!existingSubtitle) {
            const subtitleElement = document.createElement('h4');
            subtitleElement.className = 'subtitle';
            subtitleElement.textContent = subtitle;
            subtitleElement.style.margin = '0 0 12px 0';
            subtitleElement.style.fontSize = '1.2rem';
            subtitleElement.style.fontStyle = 'italic';
            subtitleElement.style.opacity = '0';
            subtitleElement.style.transition = 'opacity 0.3s ease';
            showTitle.parentNode.insertBefore(subtitleElement, showTitle.nextSibling);
            
            // Fade in subtitle
            setTimeout(() => {
                subtitleElement.style.opacity = '0.9';
            }, 100);
        }
    }
    
    // Fade in all content
    setTimeout(hideLoadingState, 100);
}

// Watch for DOM changes to detect navigation
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if featured show elements were added
            setTimeout(checkAndLoadFeaturedShow, 100);
        }
    });
});

// Start observing the document body for changes
document.addEventListener('DOMContentLoaded', function() {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initial load
    checkAndLoadFeaturedShow();
});

async function fetchFeaturedShow() {
    try {
        const showImage = document.getElementById('featured-show-image');
        const showTitle = document.getElementById('featured-show-title');
        
        if (!showImage || !showTitle) {
            return;
        }

        const response = await fetch('https://api.mixcloud.com/90milradio/circling-the-whuhula-tales-of-our-i/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const showData = await response.json();
        
        // Cache the data
        setCachedData(showData);
        
        // Populate the UI
        populateShowData(showData);
        
        // Mark as loaded
        window.featuredShowLoaded = true;
        
    } catch (error) {
        console.error('Error fetching featured show data:', error);
        
        // Fallback content
        const fallbackData = {
            name: 'Circling the Whuhula (Tales Of Our Inner Kingdoms Ep. 1)',
            description: `A concept series imagined by Random Kingdom

In the hush of night, when the veil between past and present thins, stories emerge—not as linear truths, but as echoes, fragments, whispering their way back into form.

Tales of Our Inner Kingdoms is a seven-episode sonic odyssey. Each episode unfolds the journey of a soul— distant from its own life. Across an hour of intimate narration, memory and imagination blur, listeners are pulled into a world where voices, field recordings, music, and poetry entwine. This is storytelling as invocation—an act of deep listening, a way to feel the weight of lives that came before.`,
            tags: [
                { name: 'Ambient' },
                { name: 'Poetry' },
                { name: 'Soundscape' },
                { name: 'Radio' },
                { name: 'Electroacoustic' }
            ],
            pictures: null
        };
        
        populateShowData(fallbackData);
        window.featuredShowLoaded = true;
    }
}

// Cleanup function for page navigation
function destroyFeaturedShow() {
    // Reset the loading state
    window.featuredShowLoaded = false;
    
    // Disconnect the mutation observer
    if (observer) {
        observer.disconnect();
    }
    
    // Clear any existing content and reset opacity
    const showContent = document.querySelector('.show-content');
    if (showContent) {
        showContent.style.opacity = '1';
        showContent.style.transition = '';
    }
    
    // Remove any dynamically added subtitle elements
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.remove();
    }
} 
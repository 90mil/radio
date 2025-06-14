// Constants
const BATCH_SIZE = 20;
const BATCH_DELAY = 50; // Milliseconds between batches
const SCROLL_THRESHOLD = 500; // px from bottom to trigger next batch
let currentOffset = 0;
let isLoadingMore = false;
let reachedEnd = false;
let activeLoadingSpinners = 0;
const SPINNER_HIDE_DELAY = 300; // ms to keep spinner visible after load
const BANNER_ORIGIN = 'https://90mil.github.io';
const MIXCLOUD_ORIGIN = 'https://player-widget.mixcloud.com';

const CLOUDCAST_API_URL = `https://api.mixcloud.com/90milradio/cloudcasts/?limit=${BATCH_SIZE}`;

// DOM Elements
let showContainer;

// Add playlist filtering state
let currentPlaylist = '';

// Add state for filtered shows
let allShows = [];
let filteredShows = [];

// Add state for all shows metadata
let allShowsMetadata = [];
let allShowNames = new Set();
let isLoadingAllShows = false;

window.addEventListener('message', function (event) {
    // Check if message is from Mixcloud widget or banner
    if (event.origin === MIXCLOUD_ORIGIN || event.origin === BANNER_ORIGIN) {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

            // Handle Mixcloud widget events
            if (event.origin === MIXCLOUD_ORIGIN && data.type === 'ready') {
                const bannerFrame = document.querySelector('.banner-container iframe');
                if (bannerFrame) {
                    bannerFrame.contentWindow.postMessage('pause', '*');
                }
            }

            // Handle banner player events
            if (event.origin === BANNER_ORIGIN && data.type === 'play') {
                // Pause Mixcloud player when banner plays
                const mixcloudPlayer = document.getElementById('player-iframe');
                if (mixcloudPlayer) {
                    mixcloudPlayer.contentWindow.postMessage(JSON.stringify({
                        command: 'pause'
                    }), MIXCLOUD_ORIGIN);
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    }
});

window.showsInit = function () {
    // Clear state
    currentOffset = 0;
    isLoadingMore = false;
    reachedEnd = false;

    // Get container
    showContainer = document.getElementById('show-list');

    if (!showContainer) {
        console.error('Shows container not found!');
        return;
    }

    showContainer.innerHTML = ''; // Clear previous content

    // Add load more trigger
    const loadMoreTrigger = document.getElementById('load-more-trigger') ||
        createLoadMoreTrigger();

    // Render initial batch
    renderShows();

    // Set up scroll handler
    const mainContainer = document.getElementById('content-container');
    window.removeEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);
    
    // Also listen to the main container's scroll since it's the scrolling element
    if (mainContainer) {
        mainContainer.removeEventListener('scroll', handleScroll);
        mainContainer.addEventListener('scroll', handleScroll);
    }

    // Set up player close button if needed
    const player = document.querySelector('.play-bar-container');
    if (player && !player.querySelector('.close-button')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.addEventListener('click', closePlayer);
        player.querySelector('.play-bar').appendChild(closeButton);
    }

    // Check for hash to auto-play specific show
    checkForAutoPlay();

    // Initialize playlist filter
    initPlaylistFilter();
};

function createLoadMoreTrigger() {
    const trigger = document.createElement('div');
    trigger.id = 'load-more-trigger';
    trigger.style.height = '1px';
    trigger.style.width = '100%';
    trigger.style.marginTop = '50px';
    showContainer.parentNode.appendChild(trigger);
    return trigger;
}


async function fetchWithTimeout(url, timeout = 3000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

async function fetchShowDetails(showKey) {
    try {
        return await fetchWithTimeout(`https://api.mixcloud.com${showKey}`, 2000); // Even shorter timeout for details
    } catch (error) {
        console.warn(`Failed to fetch show details for ${showKey}:`, error.message);
        return null; // Return null instead of undefined for cleaner handling
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Date unavailable';
    }
}

// Add this helper function
function getMonthYear(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth()}-${date.getFullYear()}`;
}

// Add this helper function to format month headers
function formatMonthYear(date) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// Decode HTML entities using the browser's native parser
function decodeHtmlEntities(text) {
    if (!text) return '';
    const doc = new DOMParser();
    const txt = doc.parseFromString(text, 'text/html');
    return txt.body.textContent;
}

// UI Components
function createPlayButton(uploadKey) {
    const button = document.createElement('button');
    button.classList.add('play-button');
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M3 22V2l18 10L3 22z"/></svg>`;
    button.onclick = () => playShow(uploadKey);
    return button;
}

// Function to properly match the original implementation
function createShowBox(show, fadeIn = true, existingBox = null) {
    const showBox = existingBox || document.createElement('div');
    showBox.className = 'show-box';

    // If it's a new box, create all elements
    if (!existingBox) {
        // Image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        const img = document.createElement('img');
        img.className = 'show-image';
        img.src = show.pictures?.large || show.pictures?.medium || show.pictures?.thumbnail || '';
        img.onload = () => img.classList.add('loaded');
        imageContainer.appendChild(img);
        showBox.appendChild(imageContainer);

        // Show name - decode before splitting
        const name = document.createElement('div');
        name.className = 'show-name';
        const decodedName = decodeHtmlEntities(show.name);
        name.textContent = decodedName.split(' hosted by')[0].trim();
        showBox.appendChild(name);

        // Only add hosted-by if there's actually a host
        if (show.hostName && show.hostName.length > 0) {
            const hostedBy = document.createElement('div');
            hostedBy.className = 'hosted-by';
            hostedBy.textContent = `Hosted by ${show.hostName}`;
            showBox.appendChild(hostedBy);
        }

        // Genres
        if (show.tags?.length > 0) {
            const genres = document.createElement('div');
            genres.classList.add('genres');
            genres.textContent = `Genres: ${show.tags.map(tag => tag.name).join(', ')}`;
            showBox.appendChild(genres);
        }

        // Description
        const description = document.createElement('div');
        description.classList.add('description');
        description.textContent = show.description || 'No description available.';
        showBox.appendChild(description);
    }

    // Always update the play dates container
    let playDatesContainer = showBox.querySelector('.play-dates-container');
    if (!playDatesContainer) {
        playDatesContainer = document.createElement('div');
        playDatesContainer.classList.add('play-dates-container');
        showBox.appendChild(playDatesContainer);
    } else {
        playDatesContainer.innerHTML = ''; // Clear existing dates
    }

    // Sort uploads by date and create play containers
    const sortedUploads = show.uploads.sort((a, b) =>
        new Date(b.created_time) - new Date(a.created_time)
    );

    sortedUploads.forEach(upload => {
        const playContainer = document.createElement('div');
        playContainer.classList.add('play-container');
        playContainer.onclick = () => playShow(upload.url);

        playContainer.appendChild(createPlayButton(upload.url));

        const playDate = document.createElement('div');
        playDate.classList.add('play-date');
        playDate.textContent = formatDate(upload.created_time);
        playContainer.appendChild(playDate);

        playDatesContainer.appendChild(playContainer);
    });

    return showBox;
}

// Main Functions
function playShow(showUrl) {
    // Get player container from the DOM
    const playBarContainer = document.getElementById('bottom-player') ||
        document.querySelector('.play-bar-container');

    // Get or create mixcloud widget iframe
    let mixcloudWidget = document.getElementById('player-iframe');

    if (!playBarContainer || !mixcloudWidget) {
        // Create the player container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'bottom-player';
        container.className = 'play-bar-container';

        const playBar = document.createElement('div');
        playBar.className = 'play-bar';

        mixcloudWidget = document.createElement('iframe');
        mixcloudWidget.id = 'player-iframe';
        mixcloudWidget.width = '100%';
        mixcloudWidget.height = '60';
        mixcloudWidget.frameBorder = '0';

        playBar.appendChild(mixcloudWidget);
        container.appendChild(playBar);
        document.body.appendChild(container);
    }

    // Construct the player URL with autoplay and events API enabled
    const playerUrl = `https://player-widget.mixcloud.com/widget/iframe/?feed=${showUrl}&hide_cover=1&autoplay=1&enable_api=1`;

    // Set iframe source
    mixcloudWidget.src = playerUrl;

    // Show the player
    playBarContainer.style.display = 'flex';
}

// Add helper function to check if show matches filter
function showMatchesFilter(show, filterText) {
    if (!filterText) return true;
    
    const searchText = filterText.toLowerCase();
    
    // Check show name
    const name = decodeHtmlEntities(show.name).toLowerCase();
    if (name.includes(searchText)) return true;
    
    // Check host name
    const hostMatch = name.match(/hosted by (.+)/i);
    if (hostMatch && hostMatch[1].toLowerCase().includes(searchText)) return true;
    
    // Check genres/tags
    if (show.tags && show.tags.some(tag => tag.name.toLowerCase().includes(searchText))) return true;
    
    return false;
}

// Function to load all shows metadata for the dropdown
async function loadAllShowNames() {
    if (isLoadingAllShows) return;
    isLoadingAllShows = true;

    try {
        let offset = BATCH_SIZE; // Start from second batch since we already have first batch
        let hasMore = true;

        while (hasMore) {
            const url = `${CLOUDCAST_API_URL}&offset=${offset}`;
            console.log('Loading additional shows, offset:', offset);
            const response = await fetchWithTimeout(url);
            
            if (!response || !response.data || response.data.length === 0) {
                hasMore = false;
                break;
            }

            // Store all metadata
            allShowsMetadata = [...allShowsMetadata, ...response.data];

            // Add new show names to the set
            response.data.forEach(show => {
                const name = decodeHtmlEntities(show.name).split(' hosted by')[0].trim();
                allShowNames.add(name);
            });

            // If we have an active filter, update the filtered results
            if (currentPlaylist) {
                filteredShows = allShowsMetadata.filter(show => showMatchesFilter(show, currentPlaylist));
                // Only update the display if we have more filtered results than currently shown
                if (filteredShows.length > currentOffset) {
                    renderShows(true);
                }
            }

            offset += BATCH_SIZE;
        }
    } catch (error) {
        console.error('Error loading additional shows:', error);
    } finally {
        isLoadingAllShows = false;
    }
}

// Add playlist filter handler
function initPlaylistFilter() {
    console.log('Initializing playlist filter');
    const playlistFilter = document.getElementById('playlist-filter');
    if (!playlistFilter) {
        console.error('Playlist filter element not found');
        return;
    }

    // Set initial filter from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam) {
        playlistFilter.value = filterParam.trim();
        currentPlaylist = filterParam.trim();
        // Apply initial filter
        filteredShows = allShowsMetadata.filter(show => showMatchesFilter(show, currentPlaylist));
        renderShows();
    }

    // Add debounced input handler
    let debounceTimer;
    playlistFilter.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPlaylist = e.target.value.trim().toLowerCase();
            console.log('Filter changed to:', currentPlaylist);
            // Update URL without page reload
            const url = new URL(window.location);
            if (currentPlaylist) {
                url.searchParams.set('filter', currentPlaylist);
            } else {
                url.searchParams.delete('filter');
            }
            window.history.pushState({}, '', url);
            // Filter existing shows
            if (currentPlaylist) {
                filteredShows = allShowsMetadata.filter(show => showMatchesFilter(show, currentPlaylist));
            } else {
                filteredShows = allShowsMetadata;
            }
            // Reset and reload shows
            currentOffset = 0;
            reachedEnd = false;
            renderShows();
        }, 300); // 300ms debounce
    });
}

// Modify fetchShows to use stored metadata
async function fetchShows() {
    try {
        console.log('Starting fetchShows');
        // Reset state when fetching new shows
        currentOffset = 0;
        reachedEnd = false;
        filteredShows = [];

        // If we don't have metadata yet, fetch first batch immediately
        if (allShowsMetadata.length === 0) {
            console.log('No metadata yet, fetching first batch');
            const response = await fetchWithTimeout(CLOUDCAST_API_URL);
            if (!response || !response.data) {
                throw new Error('Invalid response from Mixcloud API');
            }
            
            // Store this batch as metadata
            allShowsMetadata = response.data;
            
            // Start loading the rest in the background
            loadAllShowNames();
            
            // If we have an initial filter, apply it
            if (currentPlaylist) {
                filteredShows = allShowsMetadata.filter(show => showMatchesFilter(show, currentPlaylist));
                return { data: filteredShows.slice(0, BATCH_SIZE) };
            }
            
            // Return first batch for immediate display
            return { data: response.data };
        }

        // If we have metadata, use it for filtering
        if (currentPlaylist) {
            // Search through all metadata for matches
            filteredShows = allShowsMetadata.filter(show => showMatchesFilter(show, currentPlaylist));
            console.log('Filtered shows:', filteredShows.length);
            
            // Only take the first batch for initial display
            return { data: filteredShows.slice(0, BATCH_SIZE) };
        } else {
            // For unfiltered view, just return first batch
            filteredShows = allShowsMetadata;
            return { data: allShowsMetadata.slice(0, BATCH_SIZE) };
        }
    } catch (error) {
        console.error('Failed to fetch shows:', error);
        throw error;
    }
}

// Add scroll handler
function handleScroll() {
    if (isLoadingMore || reachedEnd) return;

    // Get the main content container since it's now the scrolling element
    const mainContainer = document.getElementById('content-container');
    const scrollPosition = mainContainer ? mainContainer.scrollTop + mainContainer.clientHeight : window.scrollY + window.innerHeight;
    const totalHeight = mainContainer ? mainContainer.scrollHeight : document.documentElement.scrollHeight;

    // If we're filtering, we need to keep loading until we find matches
    if (currentPlaylist) {
        // Load more if we're near the bottom or if we haven't found any matches yet
        if (totalHeight - scrollPosition < SCROLL_THRESHOLD || filteredShows.length === 0) {
            loadMoreShows();
        }
    } else {
        // Normal pagination for unfiltered view
        if (totalHeight - scrollPosition < SCROLL_THRESHOLD) {
            loadMoreShows();
        }
    }
}

// Helper function to process uploads for rendering, with metadata enrichment
async function flattenAndEnrichUploads(rawShows) {
    // For each upload, fetch details and merge in
    const uploads = [];
    for (const show of rawShows) {
        const fullName = decodeHtmlEntities(show.name);
        const hostMatch = fullName.match(/hosted by (.+)/i);
        const hostName = hostMatch ? hostMatch[1].trim() : '';
        const showName = fullName.split(' hosted by')[0].trim();
        const showUploads = show.uploads ? show.uploads : [{
            key: show.key,
            url: show.url,
            created_time: show.created_time
        }];
        for (const upload of showUploads) {
            // Fetch details for each upload (by show key)
            const details = await fetchShowDetails(upload.key || show.key);
            uploads.push({
                showKey: show.key,
                showName,
                hostName,
                pictures: show.pictures,
                user: show.user,
                description: decodeHtmlEntities(details?.description || show.description || 'No description available'),
                tags: details?.tags || show.tags || [],
                uploadKey: upload.key,
                uploadUrl: upload.url,
                uploadCreated: upload.created_time
            });
        }
    }
    return uploads;
}

// Helper to create or get the loading ellipsis at the end
function getOrCreateSpinner() {
    let spinner = document.getElementById('shows-loading-spinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'shows-loading-spinner';
        spinner.className = 'shows-ellipsis';
        spinner.innerHTML = '<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
        showContainer.appendChild(spinner);
    } else {
        // Always move spinner to the end if not already
        if (spinner.parentNode === showContainer && spinner !== showContainer.lastElementChild) {
            showContainer.appendChild(spinner);
        }
    }
    return spinner;
}

function hideSpinner() {
    const spinner = getOrCreateSpinner();
    spinner.style.display = 'none';
}

function showSpinner() {
    const spinner = getOrCreateSpinner();
    spinner.style.display = 'flex';
}

// Modified renderShows to use spinner at the end, without clearing it
window.renderShows = async function (isAdditional = false) {
    if (isLoadingMore) return;
    isLoadingMore = true;

    if (!isAdditional) {
        // Only clear show content, not the spinner
        Array.from(showContainer.children).forEach(child => {
            if (child.id !== 'shows-loading-spinner') {
                showContainer.removeChild(child);
            }
        });
        showContainer.classList.remove('loaded');
    }
    showSpinner();

    try {
        const response = await fetchShows();
        const shows = response.data;
        if (!shows || !Array.isArray(shows)) {
            throw new Error(`Invalid shows data: ${JSON.stringify(shows)}`);
        }
        const uploads = await flattenAndEnrichUploads(shows);
        if (uploads.length === 0) {
            if (!isLoadingAllShows && allShowsMetadata.length > 0) {
                // Only clear show content, not the spinner
                Array.from(showContainer.children).forEach(child => {
                    if (child.id !== 'shows-loading-spinner') {
                        showContainer.removeChild(child);
                    }
                });
            }
            hideSpinner();
            return;
        }
        if (!isAdditional) {
            // Only clear show content, not the spinner
            Array.from(showContainer.children).forEach(child => {
                if (child.id !== 'shows-loading-spinner') {
                    showContainer.removeChild(child);
                }
            });
            showContainer.classList.add('loaded');
        }
        // Group uploads by month
        const uploadsByMonth = new Map();
        uploads.forEach(upload => {
            const monthYear = formatMonthYear(new Date(upload.uploadCreated));
            if (!uploadsByMonth.has(monthYear)) {
                uploadsByMonth.set(monthYear, []);
            }
            uploadsByMonth.get(monthYear).push(upload);
        });
        await renderUploadsInBatches(uploadsByMonth, isAdditional);
        // Always ensure spinner is at the end
        getOrCreateSpinner();
        currentOffset += shows.length;
        hideSpinner();
    } catch (error) {
        console.error('Error rendering shows:', error);
        if (!isAdditional) {
            // Only clear show content, not the spinner
            Array.from(showContainer.children).forEach(child => {
                if (child.id !== 'shows-loading-spinner') {
                    showContainer.removeChild(child);
                }
            });
            showContainer.innerHTML += `Error loading shows: ${error.message}`;
        }
        hideSpinner();
    } finally {
        isLoadingMore = false;
    }
};

// Helper function to render uploads in batches
async function renderUploadsInBatches(uploadsByMonth, isAdditional) {
    const sortedMonths = Array.from(uploadsByMonth.entries())
        .sort(([monthA, uploadsA], [monthB, uploadsB]) => {
            // Get the first upload of each month to compare dates
            const dateA = new Date(uploadsA[0].uploadCreated);
            const dateB = new Date(uploadsB[0].uploadCreated);
            return dateB - dateA;
        });

    for (const [monthYear, uploads] of sortedMonths) {
        let monthContainer = document.querySelector(`[data-month="${monthYear}"]`);
        if (!monthContainer) {
            const monthHeader = document.createElement('div');
            monthHeader.classList.add('month-header');
            monthHeader.textContent = monthYear;

            monthContainer = document.createElement('div');
            monthContainer.classList.add('month-container');
            monthContainer.dataset.month = monthYear;

            showContainer.appendChild(monthHeader);
            showContainer.appendChild(monthContainer);
        }

        // Sort uploads within month by date
        const sortedUploads = uploads.sort((a, b) => new Date(b.uploadCreated) - new Date(a.uploadCreated));
        for (const upload of sortedUploads) {
            // Use uploadUrl as unique key
            const showKey = `${upload.showName}-${upload.uploadUrl}`;
            let existingBox = monthContainer.querySelector(`[data-show-key="${showKey}"]`);
            if (!existingBox) {
                // Create a show box for this upload
                const showBox = document.createElement('div');
                showBox.className = 'show-box';
                showBox.dataset.showKey = showKey;

                // Image
                const imageContainer = document.createElement('div');
                imageContainer.className = 'image-container';
                const img = document.createElement('img');
                img.className = 'show-image';
                img.src = upload.pictures?.large || upload.pictures?.medium || upload.pictures?.thumbnail || '';
                img.onload = () => img.classList.add('loaded');
                imageContainer.appendChild(img);
                showBox.appendChild(imageContainer);

                // Show name
                const name = document.createElement('div');
                name.className = 'show-name';
                name.textContent = upload.showName;
                showBox.appendChild(name);

                // Host
                if (upload.hostName && upload.hostName.length > 0) {
                    const hostedBy = document.createElement('div');
                    hostedBy.className = 'hosted-by';
                    hostedBy.textContent = `Hosted by ${upload.hostName}`;
                    showBox.appendChild(hostedBy);
                }

                // Genres
                if (upload.tags?.length > 0) {
                    const genres = document.createElement('div');
                    genres.classList.add('genres');
                    genres.textContent = `Genres: ${upload.tags.map(tag => tag.name).join(', ')}`;
                    showBox.appendChild(genres);
                }

                // Description
                const description = document.createElement('div');
                description.classList.add('description');
                description.textContent = upload.description || 'No description available.';
                showBox.appendChild(description);

                // Play button and date
                const playDatesContainer = document.createElement('div');
                playDatesContainer.classList.add('play-dates-container');
                const playContainer = document.createElement('div');
                playContainer.classList.add('play-container');
                playContainer.onclick = () => playShow(upload.uploadUrl);
                playContainer.appendChild(createPlayButton(upload.uploadUrl));
                const playDate = document.createElement('div');
                playDate.classList.add('play-date');
                playDate.textContent = formatDate(upload.uploadCreated);
                playContainer.appendChild(playDate);
                playDatesContainer.appendChild(playContainer);
                showBox.appendChild(playDatesContainer);

                monthContainer.appendChild(showBox);
            }
        }
    }
}

function updatePlayDates(showBox, show) {
    let playDatesContainer = showBox.querySelector('.play-dates-container');
    if (!playDatesContainer) {
        playDatesContainer = document.createElement('div');
        playDatesContainer.classList.add('play-dates-container');
        showBox.appendChild(playDatesContainer);
    }

    // Deduplicate uploads from the same day
    const uniqueUploads = show.uploads.reduce((acc, upload) => {
        const date = new Date(upload.created_time).toDateString();
        if (!acc.has(date)) {
            acc.set(date, upload);
        }
        return acc;
    }, new Map());

    const sortedUploads = Array.from(uniqueUploads.values())
        .sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

    playDatesContainer.innerHTML = '';
    sortedUploads.forEach(upload => {
        const playContainer = document.createElement('div');
        playContainer.classList.add('play-container');
        playContainer.onclick = () => playShow(upload.url);

        playContainer.appendChild(createPlayButton(upload.url));

        const playDate = document.createElement('div');
        playDate.classList.add('play-date');
        playDate.textContent = formatDate(upload.created_time);
        playContainer.appendChild(playDate);

        playDatesContainer.appendChild(playContainer);
    });

    const description = showBox.querySelector('.description');
    if (description) {
        const marginBottom = 20 + (sortedUploads.length * 40);
        description.style.marginBottom = `${marginBottom}px`;
    }
}

// Update loadMoreShows to show/hide spinner and keep it at the end
async function loadMoreShows() {
    if (reachedEnd || isLoadingMore) return;
    try {
        isLoadingMore = true;
        showSpinner();
        let nextBatch;
        if (currentPlaylist) {
            nextBatch = filteredShows.slice(currentOffset, currentOffset + BATCH_SIZE);
        } else {
            nextBatch = allShowsMetadata.slice(currentOffset, currentOffset + BATCH_SIZE);
        }
        if (!nextBatch || nextBatch.length === 0) {
            reachedEnd = true;
            hideSpinner();
            return;
        }
        const uploads = await flattenAndEnrichUploads(nextBatch);
        if (uploads.length === 0) {
            reachedEnd = true;
            hideSpinner();
            return;
        }
        // Group uploads by month
        const uploadsByMonth = new Map();
        uploads.forEach(upload => {
            const monthYear = formatMonthYear(new Date(upload.uploadCreated));
            if (!uploadsByMonth.has(monthYear)) {
                uploadsByMonth.set(monthYear, []);
            }
            uploadsByMonth.get(monthYear).push(upload);
        });
        await renderUploadsInBatches(uploadsByMonth, true);
        // Always ensure spinner is at the end
        getOrCreateSpinner();
        currentOffset += nextBatch.length;
        hideSpinner();
    } catch (error) {
        console.error('Error loading more shows:', error);
        currentOffset -= BATCH_SIZE;
        hideSpinner();
    } finally {
        isLoadingMore = false;
    }
}

function createMonthContainer(month) {
    const monthContainer = document.createElement('div');
    monthContainer.className = 'month-container';
    monthContainer.setAttribute('data-month', month);
    return monthContainer;
}

function closePlayer() {
    const player = document.querySelector('.play-bar-container');
    if (player) {
        player.style.display = 'none';
        const iframe = player.querySelector('iframe');
        if (iframe) {
            iframe.src = '';
        }
    }
}

// Helper function to group shows by month
function groupShowsByMonth(shows) {
    const showsByMonth = new Map();

    shows.forEach(show => {
        if (show.date) {
            const dateObj = new Date(show.date);
            const monthYear = formatMonthYear(dateObj);

            if (!showsByMonth.has(monthYear)) {
                showsByMonth.set(monthYear, []);
            }

            showsByMonth.get(monthYear).push(show);
        }
    });

    return showsByMonth;
}

// Helper function to render shows in batches
async function renderInBatches(showsByMonth, isAdditional) {
    const sortedMonths = Array.from(showsByMonth.entries())
        .sort(([monthA, showsA], [monthB, showsB]) => {
            // Get the first show of each month to compare dates
            const dateA = new Date(showsA[0].created_time);
            const dateB = new Date(showsB[0].created_time);

            // Sort in descending order (newest first)
            return dateB - dateA;
        });

    // Process all months
    for (const [monthYear, shows] of sortedMonths) {
        let monthContainer = document.querySelector(`[data-month="${monthYear}"]`);

        if (!monthContainer) {
            // Create new month section if it doesn't exist
            const monthHeader = document.createElement('div');
            monthHeader.classList.add('month-header');
            monthHeader.textContent = monthYear;

            monthContainer = document.createElement('div');
            monthContainer.classList.add('month-container');
            monthContainer.dataset.month = monthYear;

            showContainer.appendChild(monthHeader);
            showContainer.appendChild(monthContainer);
        }

        // Sort shows within month by date
        const sortedShows = shows.sort((a, b) => 
            new Date(b.created_time) - new Date(a.created_time)
        );

        // Update shows within month container
        for (const show of sortedShows) {
            const existingBox = monthContainer.querySelector(`[data-show-key="${show.name}"]`);

            if (existingBox) {
                // Get existing show data
                const existingShow = existingBox.__showData;

                // Merge uploads without duplicates
                const allUploads = [...existingShow.uploads];
                show.uploads.forEach(newUpload => {
                    if (!allUploads.some(existing => existing.url === newUpload.url)) {
                        allUploads.push(newUpload);
                    }
                });

                // Sort merged uploads by date
                const sortedUploads = allUploads.sort((a, b) =>
                    new Date(b.created_time) - new Date(a.created_time)
                );

                // Update the show data with merged uploads
                const mergedShow = {
                    ...existingShow,
                    uploads: sortedUploads
                };

                // Update the box with merged data
                const updatedBox = createShowBox(mergedShow, false, existingBox);
                updatedBox.dataset.showKey = show.name;
                updatedBox.__showData = mergedShow;
                existingBox.replaceWith(updatedBox);
            } else {
                // Create new show box
                const newBox = createShowBox(show, true);
                newBox.dataset.showKey = show.name;
                newBox.__showData = show;
                monthContainer.appendChild(newBox);
            }
        }
    }
}

function checkForAutoPlay() {
    const hash = window.location.hash.substring(1); // Remove the #
    if (hash === 'circling-the-whuhula') {
        // Wait a bit for the shows to load, then trigger the play
        setTimeout(() => {
            playShow('https://www.mixcloud.com/90milradio/circling-the-whuhula-tales-of-our-i/');
        }, 1000);
    }
}

// Function to update the playlist dropdown
function updatePlaylistDropdown() {
    const playlistSelect = document.getElementById('playlist-select');
    if (!playlistSelect) return;

    // Store current selection
    const currentValue = playlistSelect.value;

    // Clear existing options except "All shows"
    while (playlistSelect.options.length > 1) {
        playlistSelect.remove(1);
    }

    // Add each show name as an option
    [...allShowNames].sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name.toLowerCase();
        option.textContent = name;
        playlistSelect.appendChild(option);
    });

    // Restore selection
    if (currentValue) {
        playlistSelect.value = currentValue;
    }
} 
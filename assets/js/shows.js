// Constants
const BATCH_SIZE = 20;
const BATCH_DELAY = 50; // Milliseconds between batches
const SCROLL_THRESHOLD = 500; // px from bottom to trigger next batch
let currentOffset = 0;
let isLoadingMore = false;
let reachedEnd = false;
let activeLoadingSpinners = 0;
const SPINNER_HIDE_DELAY = 300; // ms to keep spinner visible after load

// Update API URL to use Mixcloud directly
const CLOUDCAST_API_URL = `https://api.mixcloud.com/90milradio/cloudcasts/?limit=${BATCH_SIZE}`;

// DOM Elements
let showContainer;

window.addEventListener('message', function (event) {
    // Check if message is from Mixcloud widget
    if (event.origin === 'https://player-widget.mixcloud.com') {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

            // Use the ready event since widget autoplays
            if (data.type === 'ready') {
                const bannerFrame = document.querySelector('.banner-container iframe');
                if (bannerFrame) {
                    bannerFrame.contentWindow.postMessage('pause', '*');
                }
            }
        } catch (e) {
            // Handle potential JSON parse errors
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
    window.removeEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);

    // Set up player close button if needed
    const player = document.querySelector('.play-bar-container');
    if (player && !player.querySelector('.close-button')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.addEventListener('click', closePlayer);
        player.querySelector('.play-bar').appendChild(closeButton);
    }
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


async function fetchWithTimeout(url, timeout = 5000) {
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
        return await fetchWithTimeout(`https://api.mixcloud.com${showKey}`);
    } catch (error) {
        console.error(`Failed to fetch show details for ${showKey}:`, error);
        return null;
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

// Add this helper function
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
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

        // Show name
        const name = document.createElement('div');
        name.className = 'show-name';
        name.textContent = show.name.split(' hosted by')[0].trim();
        showBox.appendChild(name);

        // Hosted by
        if (show.hostName) {
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

    // Sort uploads by date (newest first)
    const sortedUploads = show.uploads.sort((a, b) =>
        new Date(b.created_time) - new Date(a.created_time)
    );

    // Create play container for each upload
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

    // Update description margin based on number of uploads
    const description = showBox.querySelector('.description');
    if (description) {
        const marginBottom = 20 + (sortedUploads.length * 40);
        description.style.marginBottom = `${marginBottom}px`;
    }

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

async function fetchShows() {
    try {
        return await fetchWithTimeout(CLOUDCAST_API_URL);
    } catch (error) {
        console.error('Failed to fetch cloudcasts:', error);
        return { data: [] };
    }
}

// Add scroll handler
function handleScroll() {
    if (isLoadingMore || reachedEnd) return;

    const scrollPosition = window.scrollY + window.innerHeight;
    const totalHeight = document.documentElement.scrollHeight;

    if (totalHeight - scrollPosition < SCROLL_THRESHOLD) {
        loadMoreShows();
    }
}

// Modified renderShows to be a global function and accept options
window.renderShows = async function (isAdditional = false) {
    if (isLoadingMore) return;
    isLoadingMore = true;

    if (!isAdditional) {
        const loadingText = document.createElement('div');
        loadingText.className = 'month-header';
        loadingText.textContent = 'Loading shows...';
        showContainer.innerHTML = '';
        showContainer.appendChild(loadingText);
        showContainer.classList.remove('loaded');
    }

    try {
        const initialShows = (await fetchShows()).data;
        if (initialShows.length === 0) {
            if (!isAdditional) {
                showContainer.innerHTML = 'No shows available at the moment.';
            }
            return;
        }

        const processedShows = await processShows(initialShows);

        if (!isAdditional) {
            showContainer.innerHTML = '';
            showContainer.classList.add('loaded');
        }

        let processedCount = 0;
        const mergedShows = new Map(); // Track shows across all batches

        async function processBatch() {
            const batchShows = processedShows.slice(processedCount, processedCount + BATCH_SIZE);
            if (batchShows.length === 0) return;

            const batchPromises = batchShows.map(async (show) => {
                const monthYear = getMonthYear(show.created_time);
                const showKey = `${show.name}-${monthYear}`;

                if (!mergedShows.has(showKey)) {
                    mergedShows.set(showKey, {
                        ...show,
                        monthYear,
                        uploads: [show],
                        latestDate: new Date(show.created_time)
                    });
                } else {
                    const existingShow = mergedShows.get(showKey);
                    existingShow.uploads.push(show);
                    const newDate = new Date(show.created_time);
                    if (newDate > existingShow.latestDate) {
                        existingShow.latestDate = newDate;
                    }
                }
                return showKey;
            });

            await Promise.all(batchPromises);

            // Group shows by month
            const showsByMonth = new Map();
            Array.from(mergedShows.values()).forEach(show => {
                const monthYear = formatMonthYear(show.latestDate);
                if (!showsByMonth.has(monthYear)) {
                    showsByMonth.set(monthYear, []);
                }
                showsByMonth.get(monthYear).push(show);
            });

            // Render this batch
            await renderInBatches(showsByMonth, isAdditional);

            processedCount += BATCH_SIZE;

            if (processedCount < processedShows.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                await processBatch();
            }
        }

        await processBatch();

        // Update offset for next fetch
        currentOffset += initialShows.length;

    } catch (error) {
        console.error('Error rendering shows:', error);
        if (!isAdditional) {
            showContainer.innerHTML = 'Error loading shows. Please try again later.';
        }
    } finally {
        isLoadingMore = false;
    }
};

// Helper function to process shows consistently
async function processShows(rawShows) {
    // First, group shows by their name to collect all uploads
    const showGroups = new Map();

    // First pass - group shows by name and collect their uploads
    rawShows.forEach(show => {
        // Get the full show name first and decode it
        const fullName = decodeHtmlEntities(show.name);
        // Extract show name and host name
        const hostMatch = fullName.match(/hosted by (.+)/i);
        const hostName = hostMatch ?
            decodeHtmlEntities(hostMatch[1].trim()) :
            decodeHtmlEntities(show.user?.name) || 'Unknown Host';
        const showName = decodeHtmlEntities(fullName.split(' hosted by')[0].trim());

        if (!showGroups.has(showName)) {
            showGroups.set(showName, {
                key: show.key,
                name: showName,
                hostName: hostName,
                pictures: show.pictures,
                user: show.user,
                uploads: []
            });
        }

        // Add this instance as an upload
        showGroups.get(showName).uploads.push({
            key: show.key,
            url: show.url,
            created_time: show.created_time
        });
    });

    // Second pass - fetch details and process each unique show
    const processedShows = await Promise.all(
        Array.from(showGroups.values()).map(async show => {
            // Fetch additional details using the first upload's key
            const details = await fetchShowDetails(show.key);

            // Get description and tags from details
            const description = decodeHtmlEntities(details?.description || 'No description available');
            const tags = details?.tags || [];

            // Sort uploads by date (newest first)
            const sortedUploads = show.uploads.sort((a, b) =>
                new Date(b.created_time) - new Date(a.created_time)
            );

            return {
                ...show,
                ...details,
                description,
                tags,
                uploads: sortedUploads,
                created_time: sortedUploads[0].created_time
            };
        })
    );

    return processedShows;
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

// Update loadMoreShows to use the common processing
async function loadMoreShows() {
    if (reachedEnd || isLoadingMore) return;

    try {
        isLoadingMore = true;
        const response = await fetchWithTimeout(
            `${CLOUDCAST_API_URL}&offset=${currentOffset}`
        );

        const newShows = response.data;

        if (!newShows || newShows.length === 0) {
            reachedEnd = true;
            return;
        }

        const processedShows = await processShows(newShows);

        // Group shows by month using actual upload dates
        const showsByMonth = new Map();
        processedShows.forEach(show => {
            const monthYear = formatMonthYear(new Date(show.created_time));
            if (!showsByMonth.has(monthYear)) {
                showsByMonth.set(monthYear, []);
            }
            showsByMonth.get(monthYear).push(show);
        });

        // Render the additional shows
        await renderInBatches(showsByMonth, true);

        // Update offset for next fetch
        currentOffset += BATCH_SIZE;

    } catch (error) {
        console.error('Error loading more shows:', error);
        currentOffset -= BATCH_SIZE;
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
    sortedMonths.forEach(([monthYear, shows]) => {
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

        // Update shows within month container
        shows.forEach(show => {
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
        });
    });
} 
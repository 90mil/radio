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

window.showsInit = function () {
    console.log('Initializing Shows...');

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

    console.log('Shows container found, rendering shows...');
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

    console.log('Shows initialization complete');
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
    console.log(`Playing show: ${showUrl}`);

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

    // Extract Mixcloud key from URL
    const mixcloudKey = showUrl.replace('https://www.mixcloud.com/', '');

    // Set iframe source
    mixcloudWidget.src = `https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&autoplay=1&feed=${encodeURIComponent(mixcloudKey)}`;

    // Create close button if it doesn't exist
    if (!document.querySelector('.close-button')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.onclick = closePlayer;
        playBarContainer.querySelector('.play-bar').appendChild(closeButton);
    }

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
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;

    // Start loading when we're within 500px of the bottom
    if (scrollPosition > documentHeight - 500 && !isLoadingMore && !reachedEnd) {
        loadMoreShows();
    }
}

// Modified renderShows to be a global function and accept options
window.renderShows = async function (isAdditional = false) {
    if (isLoadingMore) return;
    isLoadingMore = true;

    console.log(`Rendering shows with offset ${currentOffset}`);

    try {
        // Show loading indicator
        const loadingSpinner = showLoadingSpinner();

        // Fetch shows
        const response = await fetch(`${CLOUDCAST_API_URL}&offset=${currentOffset}`);
        const data = await response.json();

        if (!data || !data.data || data.data.length === 0) {
            console.log('No more shows found');
            hideLoadingSpinner(loadingSpinner);
            isLoadingMore = false;
            reachedEnd = true;
            return;
        }

        console.log(`Fetched ${data.data.length} shows`);

        // Process shows
        const processedShows = await processShows(data.data);
        console.log('Processed shows:', processedShows);

        // Create a Map to group shows by month
        const showsByMonth = new Map();
        processedShows.forEach(show => {
            const date = new Date(show.created_time);
            const monthYear = formatMonthYear(date);

            if (!showsByMonth.has(monthYear)) {
                showsByMonth.set(monthYear, []);
            }
            showsByMonth.get(monthYear).push({
                ...show,
                latestDate: date
            });
        });

        // Render the shows
        await renderInBatches(showsByMonth, isAdditional);

        // Update offset for next fetch
        currentOffset += data.data.length;

        // Hide loading spinner
        hideLoadingSpinner(loadingSpinner);

    } catch (error) {
        console.error('Error rendering shows:', error);
        isLoadingMore = false;
        const loadingSpinner = document.querySelector('.loading-spinner');
        if (loadingSpinner) {
            hideLoadingSpinner(loadingSpinner);
        }
    }
};

// Helper function to process shows consistently
async function processShows(rawShows) {
    console.log('Processing shows:', rawShows);

    // First, group shows by their name to collect all uploads
    const showGroups = new Map();

    // First pass - group shows by name and collect their uploads
    rawShows.forEach(show => {
        const showName = show.name.split(' hosted by')[0].trim();
        if (!showGroups.has(showName)) {
            showGroups.set(showName, {
                key: show.key,
                name: showName,
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

            // Extract host name from the show name
            const hostName = show.name.match(/hosted by (.+)/i)?.[1] || show.user?.name || 'Unknown Host';

            // Get description and tags from details
            const description = details?.description || 'No description available';
            const tags = details?.tags || [];

            // Sort uploads by date (newest first)
            const sortedUploads = show.uploads.sort((a, b) =>
                new Date(b.created_time) - new Date(a.created_time)
            );

            return {
                ...show,
                ...details,
                hostName,
                description,
                tags,
                uploads: sortedUploads,
                // Use the most recent upload date as the show's date
                created_time: sortedUploads[0].created_time
            };
        })
    );

    console.log('Processed shows:', processedShows);
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
        currentOffset += BATCH_SIZE;

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
            show.uploads.forEach(upload => {
                const month = new Date(upload.created_time).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                if (!showsByMonth.has(month)) {
                    showsByMonth.set(month, new Map());
                }
                const monthShows = showsByMonth.get(month);
                if (!monthShows.has(show.name)) {
                    monthShows.set(show.name, { ...show, uploads: [] });
                }
                monthShows.get(show.name).uploads.push(upload);
            });
        });

        // Process each month
        for (const [month, monthShows] of showsByMonth) {
            let monthContainer = document.querySelector(`.month-container[data-month="${month}"]`);

            if (!monthContainer) {
                const monthHeader = document.createElement('div');
                monthHeader.className = 'month-header';
                monthHeader.textContent = month.toLowerCase();

                monthContainer = document.createElement('div');
                monthContainer.className = 'month-container';
                monthContainer.setAttribute('data-month', month);

                const existingMonths = Array.from(document.querySelectorAll('.month-container'));
                const insertPosition = existingMonths.find(existing =>
                    new Date(existing.getAttribute('data-month')) < new Date(month)
                );

                if (insertPosition) {
                    insertPosition.parentNode.insertBefore(monthHeader, insertPosition);
                    insertPosition.parentNode.insertBefore(monthContainer, insertPosition);
                } else {
                    showContainer.appendChild(monthHeader);
                    showContainer.appendChild(monthContainer);
                }
            }

            // Process shows in this month
            for (const show of monthShows.values()) {
                const existingBox = monthContainer.querySelector(`[data-show-key="${show.name}"]`);
                if (existingBox) {
                    const existingShow = existingBox.__showData;
                    const newUploads = show.uploads.filter(newUpload =>
                        !existingShow.uploads.some(existing =>
                            existing.url === newUpload.url
                        )
                    );

                    if (newUploads.length > 0) {
                        existingShow.uploads.push(...newUploads);
                        existingBox.__showData = existingShow;
                        updatePlayDates(existingBox, existingShow);
                    }
                } else {
                    const newBox = createShowBox(show);
                    newBox.dataset.showKey = show.name;
                    newBox.__showData = show;
                    monthContainer.appendChild(newBox);
                }
            }
        }

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

// Modified to be a global function
window.loadMoreShows = function () {
    if (!isLoadingMore && !reachedEnd) {
        renderShows(true);
    }
};

// Add the missing loading spinner functions
function showLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = '<div class="spinner"></div>';
    spinner.style.position = 'fixed';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.zIndex = '1000';

    document.body.appendChild(spinner);
    activeLoadingSpinners++;

    return spinner;
}

function hideLoadingSpinner(spinner) {
    if (!spinner) return;

    // Keep spinner visible for a short delay to prevent flickering for fast loads
    setTimeout(() => {
        spinner.remove();
        activeLoadingSpinners--;
    }, SPINNER_HIDE_DELAY);

    // Always allow loading more shows after a delay
    setTimeout(() => {
        isLoadingMore = false;
    }, SPINNER_HIDE_DELAY + 100);
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

// Handle scroll events for infinite loading
function handleScroll() {
    if (isLoadingMore || reachedEnd) return;

    const scrollPosition = window.scrollY + window.innerHeight;
    const totalHeight = document.body.offsetHeight;

    if (totalHeight - scrollPosition < SCROLL_THRESHOLD) {
        loadMoreShows();
    }
} 
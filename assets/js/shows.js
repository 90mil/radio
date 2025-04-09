// Constants
const BATCH_SIZE = 20;
const BATCH_DELAY = 50; // Milliseconds between batches
const RANDOM_COLORS = ['#011410', '#003d2f', '#c25d05'];
const SCROLL_THRESHOLD = 500; // px from bottom to trigger next batch
let currentOffset = 0;
let isLoadingMore = false;
let reachedEnd = false;
let activeLoadingSpinners = 0;
const SPINNER_HIDE_DELAY = 300; // ms to keep spinner visible after load

// Update API URL to use Mixcloud directly
const CLOUDCAST_API_URL = `https://api.mixcloud.com/90milradio/cloudcasts/?limit=${BATCH_SIZE}`;

// DOM Elements
const showContainer = document.getElementById('show-list');
const playBarContainer = document.getElementById('bottom-player');
const mixcloudWidget = document.getElementById('player-iframe');

// Helper Functions
function getRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
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

function createShowBox(show, fadeIn = true, existingBox = null) {
    const showBox = existingBox || document.createElement('div');
    showBox.className = 'show-box';

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
    // Add margin based on number of uploads
    const marginBottom = 20 + (show.uploads.length * 40);
    description.style.marginBottom = `${marginBottom}px`;
    showBox.appendChild(description);

    // Container for play dates
    const playDatesContainer = document.createElement('div');
    playDatesContainer.classList.add('play-dates-container');

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

    showBox.appendChild(playDatesContainer);
    return showBox;
}

// Main Functions
function playShow(showKey) {
    const showUrl = `https://player-widget.mixcloud.com/widget/iframe/?feed=${showKey}&autoplay=true`;
    mixcloudWidget.src = showUrl;

    // Create close button if it doesn't exist
    if (!document.querySelector('.close-player')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'close-player';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
            playBarContainer.style.display = 'none';
            mixcloudWidget.src = '';
        };
        document.querySelector('.play-bar').appendChild(closeButton);
    }

    playBarContainer.classList.add('active');
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

// Helper function to process shows consistently
async function processShows(rawShows) {
    const processedShows = await Promise.all(rawShows.map(async show => {
        const details = await fetchShowDetails(show.key);
        const showTitle = show.name.split(' hosted by')[0].trim();
        const hostName = show.name.match(/hosted by (.+)/i)?.[1] || 'Unknown Host';

        const uploads = rawShows
            .filter(s => s.name === show.name)
            .map(s => ({
                key: s.key,
                url: s.url,
                created_time: s.created_time
            }));

        return {
            ...show,
            ...details,
            hostName,
            name: showTitle,
            uploads: uploads
        };
    }));

    return processedShows.filter((show, index) =>
        processedShows.findIndex(s => s.name === show.name) === index
    );
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

// Update renderShows to use the same processing
async function renderShows(shows = null, isAdditional = false) {
    if (!isAdditional) {
        const loadingText = document.createElement('div');
        loadingText.className = 'month-header';
        loadingText.textContent = 'Loading shows...';
        showContainer.innerHTML = '';
        showContainer.appendChild(loadingText);
        showContainer.classList.remove('loaded');
    }

    try {
        const initialShows = shows || (await fetchShows()).data;
        if (initialShows.length === 0) {
            if (!isAdditional) {
                showContainer.innerHTML = 'No shows available at the moment.';
            }
            return;
        }

        const processedShows = await processShows(initialShows);

        if (!isAdditional) {
            showContainer.innerHTML = '';
            showContainer.classList.add('loaded');  // Add loaded class when shows are ready
        }

        let processedCount = 0;
        const mergedShows = new Map(); // Track shows across all batches

        async function processBatch() {
            const batchShows = processedShows.slice(processedCount, processedCount + BATCH_SIZE);
            if (batchShows.length === 0) return;

            const batchPromises = batchShows.map(async (show) => {
                const showTitle = show.name.split(' hosted by')[0].trim();
                const hostName = show.name.match(/hosted by (.+)/i)?.[1] || 'Unknown Host';
                const monthYear = getMonthYear(show.created_time);
                const showKey = `${showTitle}-${monthYear}`;

                // Create or update show entry for this month
                if (!mergedShows.has(showKey)) {
                    mergedShows.set(showKey, {
                        ...show,
                        hostName,
                        name: showTitle,
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

            // Group shows by month/year
            const showsByMonth = new Map();
            Array.from(mergedShows.values()).forEach(show => {
                const monthYear = formatMonthYear(show.latestDate);
                if (!showsByMonth.has(monthYear)) {
                    showsByMonth.set(monthYear, []);
                }
                showsByMonth.get(monthYear).push(show);
            });

            // Sort months by date (newest first)
            const sortedMonths = Array.from(showsByMonth.entries())
                .sort((a, b) => {
                    const dateA = new Date(a[1][0].latestDate);
                    const dateB = new Date(b[1][0].latestDate);
                    return dateB - dateA;
                });

            // Update DOM while maintaining existing structure
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

                    // Find insertion point
                    let insertPoint = null;
                    const existingMonths = document.querySelectorAll('.month-container');
                    for (const existing of existingMonths) {
                        const existingDate = new Date(shows[0].latestDate);
                        const currentDate = new Date(showsByMonth.get(existing.dataset.month)?.[0]?.latestDate);
                        if (existingDate > currentDate) {
                            insertPoint = existing;
                            break;
                        }
                    }

                    if (insertPoint) {
                        showContainer.insertBefore(monthHeader, insertPoint.previousSibling);
                        showContainer.insertBefore(monthContainer, insertPoint);
                    } else {
                        showContainer.appendChild(monthHeader);
                        showContainer.appendChild(monthContainer);
                    }
                }

                // Update shows within month container
                shows.sort((a, b) => b.latestDate - a.latestDate)
                    .forEach(show => {
                        const existingBox = monthContainer.querySelector(`[data-show-key="${show.name}"]`);
                        if (existingBox) {
                            const updatedBox = createShowBox(show, false, existingBox);
                            updatedBox.dataset.showKey = show.name;
                            updatedBox.__showData = show;
                            existingBox.replaceWith(updatedBox);
                        } else {
                            const newBox = createShowBox(show, true);
                            newBox.dataset.showKey = show.name;
                            newBox.__showData = show;
                            monthContainer.appendChild(newBox);
                        }
                    });
            });

            processedCount += BATCH_SIZE;

            if (processedCount < processedShows.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                await processBatch();
            }
        }

        await processBatch();

    } catch (error) {
        console.error('Error rendering shows:', error);
        if (!isAdditional) {
            showContainer.innerHTML = 'Error loading shows. Please try again later.';
        }
    }
}

function createMonthContainer(month) {
    const monthContainer = document.createElement('div');
    monthContainer.className = 'month-container';
    monthContainer.setAttribute('data-month', month);
    return monthContainer;
}

// Initialize
renderShows();
window.addEventListener('scroll', handleScroll); 
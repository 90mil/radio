// Constants
const CLOUDCAST_API_URL = 'https://api.mixcloud.com/90milradio/cloudcasts/?limit=100';
const BATCH_SIZE = 6; // Smaller batch size for smoother loading
const BATCH_DELAY = 50; // Milliseconds between batches
const RANDOM_COLORS = ['#011410', '#003d2f', '#c25d05'];
const SCROLL_THRESHOLD = 100; // px from bottom to trigger next batch
let currentOffset = 0;
let isLoadingMore = false;
let reachedEnd = false;
let activeLoadingSpinners = 0;
const SPINNER_HIDE_DELAY = 300; // ms to keep spinner visible after load

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
    const showBox = document.createElement('div');
    showBox.classList.add('show-box');
    showBox.style.backgroundColor = '#011411';
    showBox.style.opacity = '1';

    // Create image container first
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('image-container');

    // Check if we have an existing loaded image to reuse
    const existingImage = existingBox?.querySelector('.show-image.loaded');
    if (existingImage) {
        imageContainer.appendChild(existingImage.cloneNode(true));
        showBox.appendChild(imageContainer);
    } else {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('show-loading');
        loadingDiv.innerHTML = '<div class="loading-spinner"></div>';
        imageContainer.appendChild(loadingDiv);
        showBox.appendChild(imageContainer);

        const img = document.createElement('img');
        img.classList.add('show-image');
        imageContainer.appendChild(img);

        const imageUrl = show.pictures?.large || show.pictures?.medium || show.pictures?.small || '';

        img.addEventListener('load', function () {
            loadingDiv.classList.add('fade-out');
            img.classList.add('loaded');
            setTimeout(() => loadingDiv.remove(), 300);
        });

        img.addEventListener('error', function () {
            img.src = 'https://picsum.photos/200/200';
            loadingDiv.classList.add('fade-out');
            img.classList.add('loaded');
            setTimeout(() => loadingDiv.remove(), 300);
        });

        img.alt = show.name || 'Show image';
        img.loading = 'lazy';
        img.src = imageUrl;
    }

    // Add rest of show content immediately
    const showName = document.createElement('div');
    showName.classList.add('show-name');
    showName.textContent = decodeHtmlEntities(show.name);
    showBox.appendChild(showName);

    // Host name with decoded HTML entities
    const hostedBy = document.createElement('div');
    hostedBy.classList.add('hosted-by');
    hostedBy.textContent = `Hosted by ${decodeHtmlEntities(show.hostName)}`;
    showBox.appendChild(hostedBy);

    // Genres
    if (show.tags?.length > 0) {
        const genres = document.createElement('div');
        genres.classList.add('genres');
        genres.textContent = `Genres: ${show.tags.map(tag => tag.name).join(', ')}`;
        showBox.appendChild(genres);
    }

    // Description container with dynamic margin based on number of uploads
    const description = document.createElement('div');
    description.classList.add('description');
    description.textContent = show.description || 'No description available.';
    // Add margin based on number of uploads (each date container is ~40px)
    const marginBottom = 20 + (show.uploads.length * 40);
    description.style.marginBottom = `${marginBottom}px`;
    showBox.appendChild(description);

    // Container for all play dates
    const playDatesContainer = document.createElement('div');
    playDatesContainer.classList.add('play-dates-container');

    // Sort uploads by date (newest first) and remove duplicates
    const uniqueUploads = [...new Map(show.uploads.map(upload =>
        [formatDate(upload.created_time), upload]
    )).values()].sort((a, b) =>
        new Date(b.created_time) - new Date(a.created_time)
    );

    // Add each unique upload as a separate play container
    uniqueUploads.forEach(upload => {
        const playContainer = document.createElement('div');
        playContainer.classList.add('play-container');

        playContainer.appendChild(createPlayButton(upload.key));

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
    playBarContainer.classList.add('active');
    playBarContainer.style.display = 'flex';
    playBarContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

// Add function to load more shows
async function loadMoreShows() {
    if (reachedEnd || isLoadingMore) return;

    try {
        isLoadingMore = true;
        currentOffset += 100;

        const { data: newShows } = await fetchWithTimeout(
            `${CLOUDCAST_API_URL}&offset=${currentOffset}`
        );

        if (newShows.length === 0) {
            reachedEnd = true;
            return;
        }

        if (newShows.length > 0) {
            await renderShows(newShows, true);
        }
    } catch (error) {
        console.error('Error loading more shows:', error);
        // On error, reset the offset to try again
        currentOffset -= 100;
    } finally {
        isLoadingMore = false;
    }
}

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
        const showsToRender = shows || (await fetchShows()).data;

        if (showsToRender.length === 0) {
            if (!isAdditional) {
                showContainer.innerHTML = 'No shows available at the moment.';
            }
            return;
        }

        if (!isAdditional) {
            showContainer.innerHTML = '';
            showContainer.classList.add('loaded');  // Add loaded class when shows are ready
        }

        let processedCount = 0;
        const mergedShows = new Map(); // Track shows across all batches

        async function processBatch() {
            const batchShows = showsToRender.slice(processedCount, processedCount + BATCH_SIZE);
            if (batchShows.length === 0) return;

            const batchPromises = batchShows.map(async (show) => {
                const showDetails = await fetchShowDetails(show.key);
                if (!showDetails) return null;

                const showTitle = showDetails.name.split(' hosted by')[0].trim();
                const hostName = showDetails.name.match(/hosted by (.+)/i)?.[1] || 'Unknown Host';
                const monthYear = getMonthYear(showDetails.created_time);
                const showKey = `${showTitle}-${monthYear}`;

                // Create or update show entry for this month
                if (!mergedShows.has(showKey)) {
                    mergedShows.set(showKey, {
                        ...showDetails,
                        hostName,
                        name: showTitle,
                        monthYear,
                        uploads: [showDetails],
                        latestDate: new Date(showDetails.created_time)
                    });
                } else {
                    const existingShow = mergedShows.get(showKey);
                    existingShow.uploads.push(showDetails);
                    const newDate = new Date(showDetails.created_time);
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

            if (processedCount < showsToRender.length) {
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

// Initialize
renderShows();
window.addEventListener('scroll', handleScroll); 
// Schedule script
const scheduleDataUrl = 'https://neunzugmilradio.airtime.pro/api/week-info';

// Add helper function for HTML entities
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Add at the top with other constants
let isDragging = false;
let startX;
let scrollLeft;
let isScrolling;
let activeHoverBox = null;

const CONFIG = {
    MARGIN: 10,
    HOVER_OFFSET: 5,
    DRAG_THRESHOLD: 3,
    HEADER_HEIGHT: -8,
    PIXELS_PER_HOUR: 60,
    MOBILE_BREAKPOINT: 768,
    HOVER_DELAY: 300,
    SCROLL_THRESHOLD: 15
};

// Add this helper function
function getResponsiveMargin() {
    const styles = getComputedStyle(document.documentElement);
    const mediaQuery1024 = window.matchMedia('(max-width: 1024px)');
    const mediaQuery768 = window.matchMedia('(max-width: 768px)');
    const mediaQuery480 = window.matchMedia('(max-width: 480px)');

    if (mediaQuery480.matches) {
        return parseInt(styles.getPropertyValue('--margin-mobile'));
    } else if (mediaQuery768.matches) {
        return parseInt(styles.getPropertyValue('--margin-tablet'));
    } else if (mediaQuery1024.matches) {
        return parseInt(styles.getPropertyValue('--margin-laptop'));
    }
    return parseInt(styles.getPropertyValue('--margin-desktop'));
}

function addDragToScroll(element) {
    let dragState = {
        startX: null,
        scrollLeft: null,
        isDragging: false
    };

    const handlers = {
        mousedown: (e) => {
            dragState = {
                startX: e.pageX,
                scrollLeft: element.scrollLeft,
                isDragging: false
            };
        },

        mousemove: (e) => {
            if (!dragState.startX) return;

            if (!dragState.isDragging && Math.abs(e.pageX - dragState.startX) > CONFIG.DRAG_THRESHOLD) {
                dragState.isDragging = true;
                element.style.cursor = 'grabbing';
                hideHoverBoxDuringScroll();
            }

            if (dragState.isDragging) {
                e.preventDefault();
                const walkX = e.pageX - dragState.startX;
                element.scrollLeft = dragState.scrollLeft - walkX;
            }
        },

        mouseup: () => {
            dragState = { startX: null, scrollLeft: null, isDragging: false };
            element.style.cursor = 'grab';
        }
    };

    // Mouse events only
    element.addEventListener('mousedown', handlers.mousedown, { passive: true });
    element.addEventListener('mousemove', handlers.mousemove, { passive: false });
    element.addEventListener('mouseup', handlers.mouseup, { passive: true });
    element.addEventListener('mouseleave', handlers.mouseup, { passive: true });
}

function formatDateLong(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function isDaylightSavingTime(date) {
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

function formatTimeWithTimezone(date) {
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false, 
        timeZone: 'Europe/Berlin' 
    });
}

function formatTimeRangeWithTimezone(startDate, endDate) {
    const startTime = formatTimeWithTimezone(startDate);
    const endTime = formatTimeWithTimezone(endDate);
    
    // Add CEST/CET based on DST
    const isDST = isDaylightSavingTime(startDate);
    const timezone = isDST ? 'CEST' : 'CET';
    
    return `${startTime} - ${endTime} ${timezone}`;
}

function hideHoverBoxDuringScroll() {
    if (activeHoverBox) {
        activeHoverBox.style.display = 'none';
    }
}

// Add a global initialization function
window.scheduleInit = function () {
    fetch(scheduleDataUrl)
        .then(response => response.json())
        .then(data => {
            const thisWeekContainer = document.getElementById('this-week-container');
            const nextWeekContainer = document.getElementById('next-week-container');
            const now = new Date();
            const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

            // Add drag scrolling to both containers
            addDragToScroll(thisWeekContainer);
            addDragToScroll(nextWeekContainer);

            // Set initial cursor style
            thisWeekContainer.style.cursor = 'grab';
            nextWeekContainer.style.cursor = 'grab';

            // Populate the schedule for both weeks
            for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
                const container = weekOffset === 0 ? thisWeekContainer : nextWeekContainer;
                let firstDayWithContent = null;

                // Calculate earliest and latest times for the week
                let weekEarliestHour = 23;
                let weekLatestHour = 0;

                // First pass: find earliest and latest times across all days
                daysOrder.forEach(day => {
                    const currentDayData = data[weekOffset === 0 ? day : `next${day}`] || [];
                    const non90milShows = currentDayData.filter(show => show.name !== "90mil Radio");

                    non90milShows.forEach(show => {
                        const startHour = new Date(show.start_timestamp).getHours();
                        const endHour = new Date(show.end_timestamp).getHours();
                        weekEarliestHour = Math.min(weekEarliestHour, startHour);
                        weekLatestHour = Math.max(weekLatestHour, endHour);
                    });
                });

                // Second pass: create day blocks with consistent timing
                daysOrder.forEach(day => {
                    const currentDayData = data[weekOffset === 0 ? day : `next${day}`] || [];
                    const non90milShows = currentDayData.filter(show => show.name !== "90mil Radio");

                    const showDay = new Date(now);
                    const dayIndex = daysOrder.indexOf(day);
                    const todayIndex = (now.getDay() + 6) % 7;
                    const dayDifference = (dayIndex - todayIndex) + (weekOffset * 7);
                    showDay.setDate(now.getDate() + dayDifference);

                    const dayBlock = createDayBlock(day, non90milShows, showDay, weekEarliestHour, weekLatestHour);

                    if (non90milShows.length > 0 && !firstDayWithContent) {
                        firstDayWithContent = dayBlock;
                    }

                    container.appendChild(dayBlock);
                });

                // Modify scroll behavior to align with headers
                if (firstDayWithContent) {
                    requestAnimationFrame(() => {
                        const container = weekOffset === 0 ? thisWeekContainer : nextWeekContainer;
                        const containerWidth = container.clientWidth;
                        const margin = getResponsiveMargin();
                        const lastDay = container.lastElementChild;

                        // Calculate content dimensions
                        const firstContentOffset = firstDayWithContent.offsetLeft;
                        const contentWidth = lastDay.offsetLeft + lastDay.offsetWidth - firstContentOffset;

                        let scrollAmount;
                        if (contentWidth <= containerWidth - (margin * 2)) {
                            // If content fits within viewport, align Sunday with right margin
                            scrollAmount = lastDay.offsetLeft - (containerWidth - lastDay.offsetWidth - margin);
                        } else {
                            // If content is too wide, align first day with content to left margin
                            scrollAmount = Math.max(0, firstContentOffset - margin);
                        }

                        container.scrollTo({
                            left: scrollAmount,
                            behavior: 'smooth'
                        });
                    });
                }
            }

            // Add scroll listeners to both week containers
            thisWeekContainer.addEventListener('scroll', hideHoverBoxDuringScroll);
            nextWeekContainer.addEventListener('scroll', hideHoverBoxDuringScroll);
        })
        .catch(error => console.error('Error fetching schedule data:', error));
};

function createDayBlock(day, shows, showDay, weekEarliestHour, weekLatestHour) {
    const dayBlock = document.createElement('div');
    dayBlock.className = `day-block${shows.length === 0 ? ' empty' : ''}`;

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';
    dayBlock.appendChild(dayHeader);

    // Calculate total height needed for this week
    const totalHours = weekLatestHour - weekEarliestHour + 1;
    const showsContainerHeight = totalHours * 60;
    
    // Set minimum height on the day block itself to ensure uniformity
    dayBlock.style.minHeight = `${showsContainerHeight + 60}px`; // +60 for day header

    if (shows.length === 0) {
        dayHeader.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    } else {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        const dateStr = formatDateLong(showDay);
        dayHeader.innerHTML = `<span>${dayName}</span><span>${dateStr}</span>`;

        const showsContainer = document.createElement('div');
        showsContainer.className = 'shows-container';

        // Set height of shows container
        showsContainer.style.height = `${showsContainerHeight}px`;

        shows.forEach(show => {
            const showElement = createShowElement(show, weekEarliestHour);
            showsContainer.appendChild(showElement);
        });

        dayBlock.appendChild(showsContainer);
    }

    return dayBlock;
}

function createShowElement(show, earliestHour) {
    const showStructure = createBasicShowStructure(show, earliestHour);
    const hoverBox = createHoverBox(show, showStructure);
    attachEventHandlers(showStructure.showElement, hoverBox);
    return showStructure.showElement;
}

function createBasicShowStructure(show, earliestHour) {
    const showElement = document.createElement('div');
    showElement.className = 'show';

    const showStart = new Date(show.start_timestamp);
    const showEnd = new Date(show.end_timestamp);

    // Calculate position and height
    const startMinutes = (showStart.getHours() - earliestHour) * 60 + showStart.getMinutes();
    let endMinutes;

    // Special case for shows ending at midnight
    if (showEnd.getHours() === 0 && showEnd.getMinutes() === 0) {
        endMinutes = (24 - earliestHour) * 60;
    } else {
        endMinutes = (showEnd.getHours() - earliestHour) * 60 + showEnd.getMinutes();
    }

    const duration = endMinutes - startMinutes;
    const top = Math.round((startMinutes / 60) * CONFIG.PIXELS_PER_HOUR) + CONFIG.HEADER_HEIGHT;
    const height = Math.max(30, Math.round((duration / 60) * CONFIG.PIXELS_PER_HOUR));

    showElement.style.top = `${top}px`;
    showElement.style.height = `${height}px`;

    // Create time info
    const timeInfo = document.createElement('div');
    timeInfo.className = 'time-info';
    timeInfo.innerHTML = `${formatTimeWithTimezone(showStart)}<br>${formatTimeWithTimezone(showEnd)}`;

    // Create show info
    const showInfo = document.createElement('div');
    showInfo.className = 'show-info';

    // Parse show name
    let titleStr, hostStr = '';
    if (show.name.toLowerCase().includes('hosted by')) {
        const splitName = show.name.split(/(hosted by)/i);
        titleStr = splitName[0].trim();
        hostStr = `${splitName[1]} ${splitName[2].trim()}`;
        showInfo.innerHTML = `
            <b>${decodeHtmlEntities(titleStr)}</b>
            <span class="hosted-by">${decodeHtmlEntities(hostStr)}</span>
        `;
    } else {
        titleStr = show.name;
        showInfo.innerHTML = `<b>${decodeHtmlEntities(titleStr)}</b>`;
    }

    // Check for text overflow
    setTimeout(() => {
        const isOverflowing = showInfo.scrollWidth > showInfo.clientWidth;
        showInfo.setAttribute('data-overflowing', isOverflowing);
    }, 0);

    showElement.appendChild(timeInfo);
    showElement.appendChild(showInfo);

    return { showElement, timeInfo, showInfo, titleStr, hostStr };
}

function createHoverBox(show, { titleStr, hostStr }) {
    const hoverBox = document.createElement('div');
    hoverBox.className = 'hover-box';

    const showStart = new Date(show.start_timestamp);
    const showEnd = new Date(show.end_timestamp);
    const timeStr = `${formatTimeRangeWithTimezone(showStart, showEnd)} · ${formatDateLong(showStart)}`;

    const fullShowInfo = document.createElement('div');
    fullShowInfo.className = 'full-show-info';
    fullShowInfo.innerHTML = `
        <div class="hover-title">${decodeHtmlEntities(titleStr)}</div>
        ${hostStr ? `<div class="hover-host">${decodeHtmlEntities(hostStr)}</div>` : ''}
        <div class="hover-time">${timeStr}</div>
        <div class="hover-description">${decodeHtmlEntities(show.description || 'No description available')}</div>
    `;

    hoverBox.appendChild(fullShowInfo);
    document.querySelector('.main-container').appendChild(hoverBox);

    return hoverBox;
}

function attachEventHandlers(showElement, hoverBox) {
    const isMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
    let hoverTimeout = null;
    let isHoverBoxVisible = false;
    let touchStartY = 0;
    let touchStartX = 0;
    let isScrolling = false;

    function positionHoverBox(showElement, hoverBox, offset = CONFIG.HOVER_OFFSET) {
        const showRect = showElement.getBoundingClientRect();
        const hoverRect = hoverBox.getBoundingClientRect();

        let top = showRect.top + offset;
        let left = showRect.left + offset;

        if (top + hoverRect.height > window.innerHeight) {
            top = showRect.bottom - hoverRect.height - offset;
            top = Math.max(10, top);
        }

        left = Math.max(10, Math.min(left, window.innerWidth - hoverRect.width - 10));
        return { top, left };
    }

    function showHoverBox(e) {
        activeHoverBox = hoverBox;
        hoverBox.style.position = 'fixed';
        hoverBox.style.display = 'block';
        hoverBox.style.width = '';

        const { top, left } = positionHoverBox(showElement, hoverBox);
        hoverBox.style.top = `${top}px`;
        hoverBox.style.left = `${left}px`;
        hoverBox.classList.add('active');
        isHoverBoxVisible = true;
    }

    function hideHoverBox() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        if (activeHoverBox === hoverBox) {
            activeHoverBox = null;
            hoverBox.style.display = 'none';
            hoverBox.classList.remove('active');
        }
        isHoverBoxVisible = false;
    }

    function showHoverWithDelay(e) {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        hoverTimeout = setTimeout(() => showHoverBox(e), CONFIG.HOVER_DELAY);
    }

    // Add scroll handler to hide hover box
    const weekContainer = showElement.closest('.week-section');
    if (weekContainer) {
        weekContainer.addEventListener('scroll', () => {
            if (isHoverBoxVisible) {
                hideHoverBox();
            }
        }, { passive: true });
    }

    // Touch handlers - allow scrolling
    showElement.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].pageX;
        isScrolling = false;
    });

    showElement.addEventListener('touchmove', (e) => {
        if (!isScrolling) {
            const touchCurrentY = e.touches[0].clientY;
            const touchCurrentX = e.touches[0].pageX;
            const scrollDistanceY = Math.abs(touchCurrentY - touchStartY);
            const scrollDistanceX = Math.abs(touchCurrentX - touchStartX);

            if (scrollDistanceY > CONFIG.SCROLL_THRESHOLD || scrollDistanceX > CONFIG.SCROLL_THRESHOLD) {
                isScrolling = true;
                hideHoverBox();
            }
        }
    }, { passive: true });

    showElement.addEventListener('touchend', (e) => {
        if (!isScrolling) {
            // Only toggle hover box if we weren't scrolling
            if (isHoverBoxVisible && activeHoverBox === hoverBox) {
                hideHoverBox();
            } else {
                if (activeHoverBox) {
                    activeHoverBox.style.display = 'none';
                    activeHoverBox.classList.remove('active');
                }
                showHoverBox(e);
            }
        }
        isScrolling = false;
    });

    // Mouse handlers - with delay
    showElement.addEventListener('mouseenter', (e) => {
        if (!isMobile) { // Only handle mouse events on desktop
            showHoverWithDelay(e);
        }
    });

    showElement.addEventListener('mouseleave', () => {
        if (!isMobile) {
            hideHoverBox();
        }
    });

    showElement.addEventListener('mousedown', () => {
        if (!isMobile) {
            hoverBox.classList.add('active');
        }
    });

    showElement.addEventListener('mouseup', () => {
        if (!isMobile) {
            hoverBox.classList.remove('active');
        }
    });

    // Add global scroll handler for vertical scrolling
    document.addEventListener('scroll', () => {
        if (isHoverBoxVisible) {
            hideHoverBox();
        }
    }, { passive: true });
} 
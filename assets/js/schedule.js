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
    HEADER_HEIGHT: 52,
    PIXELS_PER_HOUR: 60,
    MOBILE_BREAKPOINT: 768
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
                const walk = e.pageX - dragState.startX;
                element.scrollLeft = dragState.scrollLeft - walk;
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

    if (shows.length === 0) {
        dayHeader.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    } else {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        const dateStr = formatDateLong(showDay);
        dayHeader.innerHTML = `<span>${dayName}</span><span>${dateStr}</span>`;

        const showsContainer = document.createElement('div');
        showsContainer.className = 'shows-container';

        // Set height of shows container only
        const totalHours = weekLatestHour - weekEarliestHour + 1;
        const containerHeight = totalHours * 60;
        showsContainer.style.height = `${containerHeight}px`;

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
    timeInfo.innerHTML = `${showStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}<br>${showEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;

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
    const timeStr = `${showStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${showEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · ${formatDateLong(showStart)}`;

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
    const isMobile = window.innerWidth <= 768;

    function positionHoverBox(showElement, hoverBox, offset = 5) {
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

    if (isMobile) {
        let touchStartTime;
        let hasMoved = false;

        showElement.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            hasMoved = false;

            // Show hover box immediately
            activeHoverBox = hoverBox;
            hoverBox.style.position = 'fixed';
            hoverBox.style.display = 'block';
            hoverBox.style.width = '';

            const { top, left } = positionHoverBox(showElement, hoverBox);
            hoverBox.style.top = `${top}px`;
            hoverBox.style.left = `${left}px`;
        }, { passive: true });

        showElement.addEventListener('touchmove', () => {
            hasMoved = true;
            // Keep hover box visible while scrolling
        }, { passive: true });

        showElement.addEventListener('touchend', () => {
            // Hide hover box on touch release
            if (activeHoverBox === hoverBox) {
                activeHoverBox = null;
                hoverBox.style.display = 'none';
            }
        }, { passive: true });

        showElement.addEventListener('touchcancel', () => {
            if (activeHoverBox === hoverBox) {
                activeHoverBox = null;
                hoverBox.style.display = 'none';
            }
        }, { passive: true });
    } else {
        showElement.addEventListener('mouseenter', () => {
            activeHoverBox = hoverBox;
            hoverBox.style.position = 'fixed';
            hoverBox.style.display = 'block';
            hoverBox.style.width = '';

            const { top, left } = positionHoverBox(showElement, hoverBox);
            hoverBox.style.top = `${top}px`;
            hoverBox.style.left = `${left}px`;
        });

        showElement.addEventListener('mouseleave', () => {
            if (activeHoverBox === hoverBox) {
                activeHoverBox = null;
            }
            hoverBox.style.display = 'none';
        });

        showElement.addEventListener('mousedown', () => {
            hoverBox.classList.add('active');
        });

        showElement.addEventListener('mouseup', () => {
            hoverBox.classList.remove('active');
        });
    }
} 
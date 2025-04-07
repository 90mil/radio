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

function addDragToScroll(element) {
    let dragStartX;

    element.addEventListener('mousedown', (e) => {
        dragStartX = e.pageX;
        startX = e.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
    });

    element.addEventListener('mousemove', (e) => {
        if (!dragStartX) return;

        // Only start dragging if mouse has moved more than 3px
        if (!isDragging && Math.abs(e.pageX - dragStartX) > 3) {
            isDragging = true;
            element.style.cursor = 'grabbing';
            hideHoverBoxDuringScroll();
        }

        if (isDragging) {
            e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walk = x - startX;
            element.scrollLeft = scrollLeft - walk;
        }
    });

    element.addEventListener('mouseup', () => {
        isDragging = false;
        dragStartX = null;
        element.style.cursor = 'grab';
    });

    element.addEventListener('mouseleave', () => {
        isDragging = false;
        dragStartX = null;
        element.style.cursor = 'grab';
        hideHoverBoxDuringScroll();
    });
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
                    const headerMarginPercent = 0.05;
                    const headerMarginWidth = containerWidth * headerMarginPercent;

                    // Calculate both possible alignments
                    const lastDay = container.lastElementChild;

                    // Calculate actual content width from first content to last day
                    const contentWidth = lastDay.offsetLeft + lastDay.offsetWidth - firstDayWithContent.offsetLeft;

                    const lastDayAlignment = lastDay.offsetLeft - (containerWidth - lastDay.offsetWidth - headerMarginWidth);
                    const firstContentAlignment = firstDayWithContent.offsetLeft - headerMarginWidth;

                    let scrollAmount;
                    if (contentWidth <= containerWidth) {
                        scrollAmount = lastDayAlignment;
                    } else {
                        scrollAmount = firstContentAlignment;
                    }

                    container.scrollTo({
                        left: Math.max(0, scrollAmount),
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

function createDayBlock(day, shows, showDay, weekEarliestHour, weekLatestHour) {
    const dayBlock = document.createElement('div');
    dayBlock.className = `day-block${shows.length === 0 ? ' empty' : ''}`;

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';

    if (shows.length === 0) {
        dayHeader.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    } else {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        const dateStr = formatDateLong(showDay);
        dayHeader.innerHTML = `<span>${dayName}</span><span>${dateStr}</span>`;

        const totalHours = weekLatestHour - weekEarliestHour + 1;
        const containerHeight = (totalHours * 60) + 40; // 60px per hour + header
        dayBlock.style.height = `${containerHeight}px`;

        shows.forEach(show => {
            const showElement = createShowElement(show, weekEarliestHour);
            dayBlock.appendChild(showElement);
        });
    }

    dayBlock.appendChild(dayHeader);
    return dayBlock;
}

function createShowElement(show, earliestHour) {
    const showStart = new Date(show.start_timestamp);
    const showEnd = new Date(show.end_timestamp);
    const showElement = document.createElement('div');
    showElement.className = 'show';

    // Calculate position and height
    const startMinutes = (showStart.getHours() - earliestHour) * 60 + showStart.getMinutes();
    const endMinutes = (showEnd.getHours() - earliestHour) * 60 + showEnd.getMinutes();
    const duration = endMinutes - startMinutes;

    const PIXELS_PER_HOUR = 60; // 1 hour = 60px height
    const HEADER_HEIGHT = 40;
    
    const top = Math.round((startMinutes / 60) * PIXELS_PER_HOUR) + HEADER_HEIGHT;
    const height = Math.max(30, Math.round((duration / 60) * PIXELS_PER_HOUR));

    showElement.style.top = `${top}px`;
    showElement.style.height = `${height}px`;

    const timeInfo = document.createElement('div');
    timeInfo.className = 'time-info';
    timeInfo.innerHTML = `${showStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}<br>${showEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;

    const showInfo = document.createElement('div');
    showInfo.className = 'show-info';

    // Create full show info for hover box
    const timeStr = `${showStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${showEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · ${formatDateLong(showStart)}`;

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

    // Check if content is overflowing
    setTimeout(() => {
        const isOverflowing = showInfo.scrollWidth > showInfo.clientWidth;
        showInfo.setAttribute('data-overflowing', isOverflowing);
    }, 0);

    const hoverBox = document.createElement('div');
    hoverBox.className = 'hover-box';

    const fullShowInfo = document.createElement('div');
    fullShowInfo.className = 'full-show-info';
    fullShowInfo.innerHTML = `
        <div class="hover-title">${decodeHtmlEntities(titleStr)}</div>
        ${hostStr ? `<div class="hover-host">${decodeHtmlEntities(hostStr)}</div>` : ''}
        <div class="hover-time">${timeStr}</div>
        <div class="hover-description">${decodeHtmlEntities(show.description || 'No description available')}</div>
    `;
    hoverBox.appendChild(fullShowInfo);

    // Add hover box to the main container
    document.querySelector('.main-container').appendChild(hoverBox);

    showElement.appendChild(timeInfo);
    showElement.appendChild(showInfo);

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        showElement.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling while touching
            const showRect = showElement.getBoundingClientRect();

            activeHoverBox = hoverBox;
            hoverBox.style.position = 'fixed';
            hoverBox.style.display = 'block';

            // First set width to calculate proper dimensions
            hoverBox.style.width = `${showRect.width}px`;

            // Initial position - 5px below top of show
            let top = showRect.top + 5;
            let left = showRect.left;

            // Get hover box dimensions
            const hoverRect = hoverBox.getBoundingClientRect();

            // Adjust vertical position if would go off bottom
            if (top + hoverRect.height > window.innerHeight) {
                // If would go off bottom, position above the show
                top = showRect.top - hoverRect.height - 5;
            }

            // Adjust horizontal position
            if (left + hoverRect.width > window.innerWidth) {
                // If would go off right edge, align with right edge of screen
                left = window.innerWidth - hoverRect.width - 10;
            } else if (left < 0) {
                // If would go off left edge, align with left edge of screen
                left = 10;
            }

            // Apply final position
            hoverBox.style.top = `${top}px`;
            hoverBox.style.left = `${left}px`;
        });

        showElement.addEventListener('touchend', () => {
            if (activeHoverBox === hoverBox) {
                activeHoverBox = null;
            }
            hoverBox.style.display = 'none';
        });
    } else {
        // Mouse events for desktop
        showElement.addEventListener('mouseenter', () => {
            const showRect = showElement.getBoundingClientRect();

            activeHoverBox = hoverBox;
            hoverBox.style.position = 'fixed';
            hoverBox.style.display = 'block';
            hoverBox.style.width = '250px';

            // Initial position - 5px offset from show
            let top = showRect.top + 5;
            let left = showRect.left + 5;

            // Get hover box dimensions
            const hoverRect = hoverBox.getBoundingClientRect();

            // Adjust vertical position if would go off bottom
            if (top + hoverRect.height > window.innerHeight) {
                top = window.innerHeight - hoverRect.height - 10;
            }

            // Adjust horizontal position
            if (left + hoverRect.width > window.innerWidth) {
                left = window.innerWidth - hoverRect.width - 10;
            } else if (left < 0) {
                left = 10;
            }

            // Apply final position
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

    return showElement;
} 
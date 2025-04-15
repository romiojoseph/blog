// js/renderer.js
import { formatISODateToCustomString, sanitize } from './utils.js';
import {
    POST_LIST_ID, LOAD_MORE_BTN_ID, POST_ARTICLE_CLASS,
    LIST_CONTROLS_ID, SEARCH_INPUT_ID, SORT_SELECT_ID, CATEGORY_FILTER_ID
} from './config.js';
import { fetchAndDisplayPosts } from './main.js'; // Import main function for button click

/**
 * Renders the search, category filter, and sort controls in the specified order.
 * @param {Array<string>} categories - A unique list of category names.
 * @param {string} currentSearchTerm - The current value for the search input.
 * @param {string} currentSortValue - The currently selected sort value ('newest' or 'oldest').
 * @param {string} currentCategoryFilter - The currently selected category filter value.
 * @returns {HTMLDivElement} The controls container element.
 */
export function renderListControls(categories = [], currentSearchTerm = '', currentSortValue = 'newest', currentCategoryFilter = '') {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = LIST_CONTROLS_ID;
    controlsContainer.className = 'atproto-list-controls';

    // 1. Search Input
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = SEARCH_INPUT_ID;
    searchInput.placeholder = 'Search posts';
    searchInput.value = currentSearchTerm;
    searchInput.title = "Search posts by title, description, content, or category"; // Add title

    // 2. Category Filter Select
    const categorySelect = document.createElement('select');
    categorySelect.id = CATEGORY_FILTER_ID;
    categorySelect.title = "Filter posts by category"; // Add title

    // Add "All Categories" option
    const allCatsOption = document.createElement('option');
    allCatsOption.value = '';
    allCatsOption.textContent = 'All Categories';
    allCatsOption.selected = currentCategoryFilter === '';
    allCatsOption.title = "Show posts from all categories";
    categorySelect.appendChild(allCatsOption);

    // Add options for each unique category
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        const safeCat = sanitize(cat); // Sanitize category name for display and value
        option.value = safeCat;
        option.textContent = safeCat;
        option.selected = currentCategoryFilter === safeCat;
        option.title = `Show posts in category: ${safeCat}`; // Add title to option
        categorySelect.appendChild(option);
    });

    // 3. Sort Select
    const sortSelect = document.createElement('select');
    sortSelect.id = SORT_SELECT_ID;
    sortSelect.title = "Sort posts by date"; // Add title

    const newestOption = document.createElement('option');
    newestOption.value = 'newest';
    newestOption.textContent = 'Newest';
    newestOption.selected = currentSortValue === 'newest';
    newestOption.title = "Show newest posts first";
    sortSelect.appendChild(newestOption);

    const oldestOption = document.createElement('option');
    oldestOption.value = 'oldest';
    oldestOption.textContent = 'Oldest';
    oldestOption.selected = currentSortValue === 'oldest';
    oldestOption.title = "Show oldest posts first";
    sortSelect.appendChild(oldestOption);


    // Append controls in the desired order: Search, Category, Sort
    controlsContainer.appendChild(searchInput);
    controlsContainer.appendChild(categorySelect);
    controlsContainer.appendChild(sortSelect);

    return controlsContainer;
}


/**
 * Renders a list of post summaries. Includes data attributes and clickable category links.
 * @param {Array<object>} records - Array of post record objects from the API.
 * @returns {DocumentFragment} A fragment containing the rendered post elements.
 */
export function renderPostList(records) {
    const fragment = document.createDocumentFragment();
    records.forEach(record => {
        try {
            if (!record?.value) return;
            const postValue = record.value;
            const title = sanitize(postValue.title) || 'Untitled Post';
            const slug = postValue.slug;
            const safeSlug = slug ? encodeURIComponent(slug) : null;
            const shortDescription = sanitize(postValue.shortDescription) || '';
            const category = postValue.category || '';
            const safeCategory = category ? sanitize(category) : '';
            const content = postValue.content || ''; // Keep content as is for dataset
            const publishedAt = postValue.publishedAt;
            const coverImage = postValue.coverImage;
            const recommended = postValue.recommended === true;

            const postDate = formatISODateToCustomString(publishedAt);
            const postLink = safeSlug ? `?view-post=${safeSlug}` : '#';
            const categoryLink = safeCategory ? `?category=${encodeURIComponent(safeCategory)}` : null;

            const postElement = document.createElement('article');
            postElement.className = `${POST_ARTICLE_CLASS} atproto-post-summary`;

            // Add data attributes for potential filtering/sorting (lowercase for consistency)
            postElement.dataset.title = title.toLowerCase();
            postElement.dataset.shortDescription = shortDescription.toLowerCase();
            postElement.dataset.category = safeCategory.toLowerCase();
            postElement.dataset.content = content.toLowerCase(); // Store original content lowercase for search
            postElement.dataset.publishedAt = publishedAt || '';
            postElement.dataset.recommended = recommended;

            let categoryHtml = '';
            if (safeCategory && categoryLink) {
                categoryHtml = ` | <a href="${categoryLink}" title="View posts in category: ${safeCategory}">${safeCategory}</a>`; // Add title
            } else if (safeCategory) {
                categoryHtml = ` | ${safeCategory}`;
            }

            postElement.innerHTML = `
            <a href="${postLink}" class="atproto-read-more" title="Read post: ${title}">
                ${coverImage ? `<img src="${sanitize(coverImage)}" alt="${title}" class="atproto-post-summary-image" loading="lazy" />` : ''}
                <h2>${title}</h2>
                ${shortDescription ? `<p class="atproto-short-description">${shortDescription}</p>` : ''}
            </a>
            <p class="atproto-post-info">${postDate}${categoryHtml}</p>
        `;
            fragment.appendChild(postElement);
        } catch (error) {
            console.error("Error rendering a post summary:", error, "Record:", record);
            // Optionally add a placeholder or skip the post
        }
    });
    return fragment;
}

/**
 * Renders ONLY the HTML for the <article> part of a single blog post.
 * Uses marked.js to parse Markdown content. It assumes marked.js allows HTML tags
 * like blockquote by default or is configured globally to do so.
 * Includes clickable category link and clickable tag bubbles linking to Bluesky search.
 * **Includes the "Copy Link" button.**
 * @param {object} record - The full post record object.
 * @returns {string} HTML string for the single post <article>.
 * @throws {Error} If the record is invalid or marked.js is unavailable.
 */
export function renderSinglePostArticle(record) {
    if (!record?.value) {
        console.error("renderSinglePostArticle called with invalid record.");
        throw new Error("Post data is missing or invalid.");
    }
    if (typeof marked === 'undefined') {
        console.error("marked.js library is not loaded.");
        throw new Error("Markdown parser (marked.js) not available.");
    }

    try {
        const postValue = record.value;
        const title = sanitize(postValue.title) || 'Untitled Post';
        const shortDescription = sanitize(postValue.shortDescription) || '';
        const authorDid = postValue.authorDid; // Assume present, handle if needed
        const authorHandle = postValue.authorHandle || 'unknown.bsky.social';
        const authorDisplayName = sanitize(postValue.authorDisplayName || authorHandle);
        const category = postValue.category || '';
        const safeCategory = category ? sanitize(category) : '';
        const content = postValue.content || ''; // Raw Markdown content
        const coverImage = postValue.coverImage;
        const tags = Array.isArray(postValue.tags) ? postValue.tags : [];
        const publishedAt = postValue.publishedAt;
        const updatedAt = postValue.updatedAt;

        const publishedDateStr = formatISODateToCustomString(publishedAt);
        const updatedDateStr = updatedAt ? formatISODateToCustomString(updatedAt) : null;
        const profileLink = `https://bsky.app/profile/${authorDid || authorHandle}`;
        const categoryLink = safeCategory ? `?category=${encodeURIComponent(safeCategory)}` : null;

        // --- Generate Clickable Tag Bubbles ---
        let tagsHtml = '';
        if (tags.length > 0) {
            const tagBubbles = tags.map(tag => {
                const safeTag = sanitize(tag);
                if (!safeTag) return ''; // Skip empty tags
                const encodedTag = encodeURIComponent(safeTag);
                const searchUrl = `https://bsky.app/search?q=${encodedTag}`;
                const titleAttr = `Search for "${safeTag}" on Bluesky`;
                return `<a href="${searchUrl}" target="_blank" rel="noopener" class="atproto-tag-bubble" title="${titleAttr}">${safeTag}</a>`;
            }).filter(Boolean).join('');
            if (tagBubbles) {
                tagsHtml = `<div class="atproto-tags-container"><div class="atproto-tags-label">${tagBubbles}</div></div>`; // Updated class
            }
        }
        // --- End Tag Bubble Generation ---

        const parsedContent = marked.parse(content, { breaks: true });

        // --- Category & Copy Link Section ---
        let categoryAndCopyLinkHtml = '';
        const categoryTextHtml = safeCategory ?
            (categoryLink ? `View more in: <a href="${categoryLink}" title="View posts in category: ${safeCategory}">${safeCategory}</a>` : `Category: ${safeCategory}`)
            : '';
        // ** ADDED Copy Button HTML **
        const copyButtonHtml = `<button class="copy-link-button" title="Copy link to this post">Copy Link</button>`;
        // Combine category text and copy button in the div
        categoryAndCopyLinkHtml = `<div class="atproto-post-category">
                                       <span>${categoryTextHtml || ' '}</span>
                                       ${copyButtonHtml}
                                   </div>`;
        // --- End Category & Copy Link Section ---


        const articleHtml = `
            <article class="atproto-post-full">
                 <a href="index.html" title="Back to all posts" class="atproto-back-button">Back</a>
                <h1>${title}</h1>
                 ${shortDescription ? `<p class="atproto-short-description">${shortDescription}</p>` : ''}
                <p class="atproto-post-meta">
                    By <a href="${profileLink}" target="_blank" rel="noopener" title="View ${authorDisplayName}'s Bluesky profile">${authorDisplayName}</a>
                 </p>
                 <div class="atproto-post-timestamps">
                    Published on ${publishedDateStr}${updatedDateStr ? ` • Last updated ${updatedDateStr}` : ''}
                 </div>
                ${categoryAndCopyLinkHtml}
                ${coverImage ? `<img src="${sanitize(coverImage)}" alt="${title}" class="atproto-post-full-image" />` : ''}
                <div class="atproto-post-content">${parsedContent}</div>
                ${tagsHtml}
            </article>`;

        return articleHtml;

    } catch (error) {
        console.error("FATAL ERROR rendering single post article:", error, "Record:", record);
        return `<article class="atproto-post-full atproto-error-container">
                    <a href="index.html" title="Back to all posts" class="atproto-back-button">Back</a>
                    <h1>Error Displaying Post</h1>
                    <p class="atproto-error">An error occurred while displaying this post article. Please check the console for details.</p>
                </article>`;
    }
}

// --- Unchanged Functions Below ---

/**
 * Renders the "Load More" button. (Currently unused as all posts are loaded initially)
 * @returns {HTMLButtonElement} The button element.
 */
export function renderLoadMoreButton() {
    const button = document.createElement('button');
    button.id = LOAD_MORE_BTN_ID;
    button.className = 'atproto-load-more-btn';
    button.textContent = 'Load More Posts';
    return button;
}

/**
 * Appends new post elements to the list container. (Currently unused)
 * @param {Array<object>} records - Array of new post records.
 * @param {string} listContainerId - The ID of the post list container.
 */
export function appendPosts(records, listContainerId) {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) {
        console.error(`Post list container #${listContainerId} not found for appending.`);
        return;
    }
    if (records.length > 0) {
        try {
            const newPostsFragment = renderPostList(records);
            listContainer.appendChild(newPostsFragment);
        } catch (appendError) {
            console.error("Error appending posts:", appendError);
        }
    }
}

/**
 * Updates or removes the "Load More" button based on pagination state.
 * Currently removes the button as all posts are loaded initially.
 * @param {string | null} nextCursor - The cursor for the next page, or null if no more pages.
 * @param {number} totalFetched - Total number of records fetched so far.
 * @param {number} pageSize - The number of records requested per page (config setting).
 * @param {string} appContainerId - The ID of the main app container where the button might be.
 */
export function updateLoadMoreButtonState(nextCursor, totalFetched, pageSize, appContainerId) {
    const appContainer = document.getElementById(appContainerId);
    if (!appContainer) return;

    const existingButton = document.getElementById(LOAD_MORE_BTN_ID);
    if (existingButton) {
        existingButton.remove();
    }
}


/**
 * Renders an error message directly into a container.
 * @param {string} message - The error message to display.
 * @param {string} containerId - The ID of the container element.
 * @param {boolean} includeBackLink - Whether to include a 'back to list' link.
 */
export function renderError(message, containerId, includeBackLink = false) {
    const container = document.getElementById(containerId);
    if (container) {
        let backButtonHtml = includeBackLink ? `<p><a href="index.html" class="atproto-back-button" title="Go back to the list of posts">Back</a></p>` : '';
        container.innerHTML = `<p class="atproto-error">${sanitize(message)}</p>${backButtonHtml}`;
    } else {
        console.error(`Container #${containerId} not found for rendering error.`);
    }
}
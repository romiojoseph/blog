// js/main.js
import {
    USER_DID, BLOG_POST_NSID, POSTS_PER_PAGE, APP_CONTAINER_ID, LOADER_ID,
    LOADING_OVERLAY_ID, LOADING_TEXT_ID, POST_LIST_ID, DEFAULT_BLOG_TITLE,
    DEFAULT_BLOG_DESCRIPTION, POST_ARTICLE_CLASS, RECOMMENDED_LINK_ID,
    COMMENTS_WRAPPER_TARGET_ID,
    BSKY_WIDGET_TARGET_ID,
    MAX_PAGES_FOR_INITIAL_LOAD,
    LIST_CONTROLS_ID, SEARCH_INPUT_ID, SORT_SELECT_ID, CATEGORY_FILTER_ID,
    SEARCH_DEBOUNCE_DELAY
} from './config.js';
import { fetchRecords, findRecordBySlug } from './api.js';
import { updateMeta, updateOgMeta, showLoaderOverlay, sanitize, triggerBlueskyEmbeds } from './utils.js';
import {
    renderPostList, renderSinglePostArticle, appendPosts, updateLoadMoreButtonState,
    renderError,
    renderListControls
} from './renderer.js';

// --- State ---
let isLoading = false;
let hasRecommendedPosts = false;
let isRecommendedView = false;
let allFetchedPosts = [];
let uniqueCategories = new Set();
let currentSearchTerm = '';
let currentSort = 'newest';
let currentCategoryFilter = '';
let searchDebounceTimer = null;

// --- Helper: Update Header Link Active State ---
function updateHeaderLinks(activeTarget) {
    document.querySelectorAll('.header-nav .header-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-nav-target') === activeTarget) {
            link.classList.add('active');
        }
    });
    const recommendedLink = document.getElementById(RECOMMENDED_LINK_ID);
    if (recommendedLink) {
        recommendedLink.style.display = hasRecommendedPosts ? 'inline-block' : 'none';
    }
}

// --- Filtering, Sorting, and Rendering Logic ---

function applyFiltersSortAndRender(postsToProcess) {
    const postListContainer = document.getElementById(POST_LIST_ID);
    if (!postListContainer) {
        console.error("Post list container not found for rendering.");
        return;
    }

    const lowerSearchTerm = currentSearchTerm.toLowerCase();

    const filteredPosts = postsToProcess.filter(record => {
        const value = record?.value;
        if (!value) return false;

        const title = (value.title || '').toLowerCase();
        const description = (value.shortDescription || '').toLowerCase();
        const category = (value.category || '').toLowerCase();
        const content = (value.content || '').toLowerCase();

        if (currentCategoryFilter && category !== currentCategoryFilter.toLowerCase()) {
            return false;
        }

        if (!lowerSearchTerm) return true;

        return title.includes(lowerSearchTerm) ||
            description.includes(lowerSearchTerm) ||
            category.includes(lowerSearchTerm) ||
            content.includes(lowerSearchTerm);
    });

    const sortedPosts = [...filteredPosts].sort((a, b) => {
        const dateA = new Date(a?.value?.publishedAt || 0);
        const dateB = new Date(b?.value?.publishedAt || 0);
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return currentSort === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    postListContainer.innerHTML = '';
    if (sortedPosts.length > 0) {
        const postsFragment = renderPostList(sortedPosts);
        postListContainer.appendChild(postsFragment);
    } else {
        let noResultsMsg = postListContainer.querySelector('.atproto-no-results');
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('p');
            noResultsMsg.className = 'atproto-no-results atproto-no-filter-results'; // Add common class
            postListContainer.appendChild(noResultsMsg);
        }
        if (currentSearchTerm && currentCategoryFilter) {
            noResultsMsg.textContent = `No posts found in category "${sanitize(currentCategoryFilter)}" matching your search.`;
        } else if (currentSearchTerm) {
            noResultsMsg.textContent = 'No posts match your search term.';
        } else if (currentCategoryFilter) {
            noResultsMsg.textContent = `No posts found in category "${sanitize(currentCategoryFilter)}".`;
        }
        else {
            noResultsMsg.textContent = 'No posts to display.';
        }
        noResultsMsg.style.display = 'block';
    }
}

// --- Data Fetching and Display Logic ---

async function fetchAllRecordsInfo(did, collection, accumulatedCategories, maxPages = MAX_PAGES_FOR_INITIAL_LOAD, cursor = null) {
    let allRecords = [];
    let foundRecommended = false;
    let pagesFetched = 0;
    let currentCursor = cursor;
    accumulatedCategories.clear();

    try {
        do {
            pagesFetched++;
            const { records: batchRecords, cursor: nextCursor } = await fetchRecords(
                did,
                collection,
                100,
                currentCursor
            );

            allRecords = allRecords.concat(batchRecords);

            for (const record of batchRecords) {
                if (record?.value?.category) {
                    accumulatedCategories.add(sanitize(record.value.category));
                }
                if (!foundRecommended && record?.value?.recommended === true) {
                    foundRecommended = true;
                }
            }

            currentCursor = nextCursor;

            if (!currentCursor) {
                break;
            }
            if (pagesFetched >= maxPages) {
                console.warn(`Stopped fetching all records info after ${maxPages} pages (limit reached).`);
                break;
            }

        } while (currentCursor);

        return { allRecords, foundRecommended };

    } catch (error) {
        console.error('Error during recursive fetch:', error);
        // Return current state on error
        return { allRecords, foundRecommended };
    }
}


export async function fetchAndDisplayPosts(showRecommendedOnly = false) {
    if (isLoading) return;
    isLoading = true;
    isRecommendedView = showRecommendedOnly;
    showLoaderOverlay(true, `Loading ${showRecommendedOnly ? 'recommended' : 'all'} posts...`);

    const appContainer = document.getElementById(APP_CONTAINER_ID);
    if (!appContainer) {
        console.error(`App container #${APP_CONTAINER_ID} not found.`);
        showLoaderOverlay(false); isLoading = false; return;
    }

    const commentsWrapperTarget = document.getElementById(COMMENTS_WRAPPER_TARGET_ID);
    if (commentsWrapperTarget) commentsWrapperTarget.innerHTML = '';
    appContainer.innerHTML = '';

    try {
        // Fetch all info needed for controls and initial display
        const { allRecords: fetchedRecords, foundRecommended } = await fetchAllRecordsInfo(
            USER_DID,
            BLOG_POST_NSID,
            uniqueCategories
        );

        hasRecommendedPosts = foundRecommended;
        // Update header links *after* checking for recommended posts
        updateHeaderLinks(showRecommendedOnly ? '?recommended=true' : 'index.html');

        // Filter fetched records based on view (recommended or all)
        allFetchedPosts = showRecommendedOnly
            ? fetchedRecords.filter(record => record?.value?.recommended === true)
            : fetchedRecords;

        // Render controls based on *all* fetched categories, but current filter state
        const controls = renderListControls(
            Array.from(uniqueCategories),
            currentSearchTerm,
            currentSort,
            currentCategoryFilter // Pass the current category filter value
        );
        appContainer.appendChild(controls);

        // Create container for post list
        const postListContainer = document.createElement('div');
        postListContainer.id = POST_LIST_ID;
        postListContainer.className = 'atproto-post-list';
        appContainer.appendChild(postListContainer);

        // Apply initial filters/sort and render the list
        applyFiltersSortAndRender(allFetchedPosts);

        // Add event listeners to controls
        const searchInput = document.getElementById(SEARCH_INPUT_ID);
        const sortSelect = document.getElementById(SORT_SELECT_ID);
        const categorySelect = document.getElementById(CATEGORY_FILTER_ID);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounceTimer);
                const searchTerm = e.target.value;
                searchDebounceTimer = setTimeout(() => {
                    currentSearchTerm = searchTerm;
                    applyFiltersSortAndRender(allFetchedPosts); // Apply filters/sort to the *already fetched* posts
                }, SEARCH_DEBOUNCE_DELAY);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                applyFiltersSortAndRender(allFetchedPosts); // Apply sort to the *already fetched* posts
            });
        }

        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                currentCategoryFilter = e.target.value;
                applyFiltersSortAndRender(allFetchedPosts); // Apply category filter to the *already fetched* posts
            });
            // Ensure the select reflects the current filter (e.g., if loaded via URL param)
            categorySelect.value = currentCategoryFilter;
        }

        // Update page metadata
        const pageTitle = showRecommendedOnly ? 'Recommended Posts' : DEFAULT_BLOG_TITLE;
        updateMeta(pageTitle, DEFAULT_BLOG_DESCRIPTION);
        updateOgMeta(pageTitle, 'website', DEFAULT_BLOG_DESCRIPTION, null);

        // Update Load More button (currently removes it as all are fetched)
        updateLoadMoreButtonState(null, allFetchedPosts.length, POSTS_PER_PAGE, APP_CONTAINER_ID);

    } catch (error) {
        console.error('Error fetching or displaying posts:', error);
        appContainer.innerHTML = ''; // Clear potentially broken content
        renderError(`Failed to load posts. ${error.message}`, APP_CONTAINER_ID);
        updateMeta('Error', 'Failed to load posts.');
        updateOgMeta('Error', 'website', 'Failed to load posts.', null);
        updateLoadMoreButtonState(null, 0, POSTS_PER_PAGE, APP_CONTAINER_ID); // Ensure button is removed on error
    } finally {
        isLoading = false;
        showLoaderOverlay(false);
    }
}

// ** ADDED Fallback function for copying text **
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0"; // Hide element

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let successful = false;
    try {
        successful = document.execCommand('copy');
        const msg = successful ? 'successful' : 'unsuccessful';
        // console.log('Fallback: Copying text command was ' + msg); // Optional log
        if (successful) {
            button.textContent = 'Copied!';
            button.disabled = true;
            setTimeout(() => { button.textContent = 'Copy Link'; button.disabled = false; }, 1500);
        } else {
            throw new Error('Fallback copy command failed');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        button.textContent = 'Error';
        button.disabled = true;
        setTimeout(() => { button.textContent = 'Copy Link'; button.disabled = false; }, 1500);
    }

    document.body.removeChild(textArea);
    return successful;
}


async function fetchAndDisplaySinglePost(slug) {
    if (isLoading) return;
    isLoading = true;
    isRecommendedView = false;
    showLoaderOverlay(true, "Loading post...");

    // Reset list view state variables
    currentSearchTerm = '';
    currentSort = 'newest';
    currentCategoryFilter = '';
    allFetchedPosts = []; // Clear list cache

    const appContainer = document.getElementById(APP_CONTAINER_ID);
    const commentsWrapperTarget = document.getElementById(COMMENTS_WRAPPER_TARGET_ID);

    if (appContainer) appContainer.innerHTML = ''; // Clear main content area
    if (commentsWrapperTarget) commentsWrapperTarget.innerHTML = ''; // Clear comments area

    if (!appContainer || !commentsWrapperTarget) {
        console.error("Required containers not found for single post view.");
        showLoaderOverlay(false); isLoading = false; return;
    }

    // Ensure header state is correct (fetch recommended status if not already known)
    if (uniqueCategories.size === 0 && !hasRecommendedPosts) {
        const { foundRecommended } = await fetchAllRecordsInfo(USER_DID, BLOG_POST_NSID, uniqueCategories, 1);
        hasRecommendedPosts = foundRecommended;
    }
    updateHeaderLinks(null); // Set header link to inactive for single post view

    try {
        const record = await findRecordBySlug(USER_DID, BLOG_POST_NSID, slug);

        if (record) {
            const articleHTML = renderSinglePostArticle(record);
            appContainer.innerHTML = articleHTML;

            // --- Add Copy Link Button Listener ---
            const copyButton = appContainer.querySelector('.copy-link-button');
            if (copyButton) {
                copyButton.addEventListener('click', () => {
                    const url = window.location.href;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(() => {
                            copyButton.textContent = 'Copied!';
                            copyButton.disabled = true;
                            setTimeout(() => { copyButton.textContent = 'Copy Link'; copyButton.disabled = false; }, 1500);
                        }).catch(err => {
                            console.error('Clipboard API failed, trying fallback: ', err);
                            fallbackCopyTextToClipboard(url, copyButton); // Use fallback
                        });
                    } else {
                        fallbackCopyTextToClipboard(url, copyButton); // Use fallback if API unavailable
                    }
                });
            }
            // --- End Copy Link Button Listener ---

            triggerBlueskyEmbeds(); // Trigger embeds *after* HTML is in DOM

            const postValue = record.value;
            const title = sanitize(postValue.title) || 'Untitled Post';
            const shortDesc = sanitize(postValue.shortDescription) || '';
            const contentSnippet = sanitize(postValue.content || '').substring(0, 160) + '...';
            const coverImage = postValue.coverImage;
            updateMeta(title, shortDesc || contentSnippet);
            updateOgMeta(title, 'article', shortDesc || contentSnippet, coverImage);

            // Comments Widget Handling
            const commentUriFromRecord = record.value?.bskyCommentsPostUri;
            const commentsSectionHTML = `
                <div class="widget-wrapper">
                    <hr>
                    <div id="${BSKY_WIDGET_TARGET_ID}">
                       ${!commentUriFromRecord ? '<p class="atproto-comment-alert">Comments are not available for this post.</p>' : '<p class="atproto-comment-alert">Loading comments...</p>'}
                    </div>
                </div>`;
            commentsWrapperTarget.innerHTML = commentsSectionHTML;

            const widgetTargetElement = document.getElementById(BSKY_WIDGET_TARGET_ID);
            if (commentUriFromRecord) {
                if (widgetTargetElement && typeof loadAndRenderComments === 'function') {
                    loadAndRenderComments(BSKY_WIDGET_TARGET_ID, commentUriFromRecord);
                } else {
                    console.error("Comments widget target or load function (loadAndRenderComments) not found.");
                    if (widgetTargetElement) widgetTargetElement.innerHTML = '<p class="atproto-error">Error initializing comments.</p>';
                }
            } else {
                console.warn("No bskyCommentsPostUri found in record.");
            }

        } else {
            const safeSlug = sanitize(slug);
            renderError(`Post with slug "${safeSlug}" not found.`, APP_CONTAINER_ID, true);
            updateMeta('Post Not Found', `Post "${safeSlug}" not found.`);
            updateOgMeta('Post Not Found', 'website', `Post "${safeSlug}" not found.`, null);
        }

    } catch (error) {
        const safeSlug = sanitize(slug);
        renderError(`Failed to load post "${safeSlug}". ${error.message}`, APP_CONTAINER_ID, true);
        updateMeta('Error', 'Failed to load post.');
        updateOgMeta('Error', 'website', 'Failed to load post.', null);
        if (commentsWrapperTarget) commentsWrapperTarget.innerHTML = ''; // Clear comments on error too
    } finally {
        isLoading = false;
        showLoaderOverlay(false);
    }
}

function handleRouteChange() {
    try {
        const params = new URLSearchParams(window.location.search);
        const viewPostSlug = params.get('view-post');
        const recommendedParam = params.get('recommended');
        const categoryParam = params.get('category'); // Get category param

        isLoading = false; // Reset loading flag

        // Reset filters/sort for list view, they are reapplied if navigating to list
        currentSearchTerm = '';
        currentSort = 'newest';
        // Set category filter based on URL param if present for list view
        currentCategoryFilter = categoryParam ? sanitize(decodeURIComponent(categoryParam)) : '';

        if (viewPostSlug) {
            fetchAndDisplaySinglePost(decodeURIComponent(viewPostSlug));
        } else {
            const showRecommended = recommendedParam === 'true';
            fetchAndDisplayPosts(showRecommended);
        }
    } catch (routeError) {
        console.error("Error during route handling:", routeError);
        renderError(`An error occurred loading the page content: ${routeError.message}`, APP_CONTAINER_ID);
        const commentsWrapperTarget = document.getElementById(COMMENTS_WRAPPER_TARGET_ID);
        if (commentsWrapperTarget) commentsWrapperTarget.innerHTML = '';
        showLoaderOverlay(false); // Ensure loader is hidden on error
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', handleRouteChange);
window.addEventListener('popstate', handleRouteChange);
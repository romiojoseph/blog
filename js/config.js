// js/config.js

// --- Configuration ---
export const USER_DID = 'did:plc:xglrcj6gmrpktysohindaqhj'; // <<< YOUR DID (Used to find YOUR posts) >>>
export const BLOG_POST_NSID = 'app.blog.post';
export const POSTS_PER_PAGE = 10; // Used if pagination is re-enabled, currently fetches all.
export const MAX_LIST_LIMIT = 100; // Max records per API request

// --- API ---
export const LIST_RECORDS_BASE_URL = 'https://bsky.social/xrpc/com.atproto.repo.listRecords';

// --- DOM IDs and Classes (Using 'atproto-' prefix for BLOG elements) ---
export const APP_CONTAINER_ID = 'atproto-app-container';
export const LOADER_ID = 'atproto-loader'; // Old text loader ID (can be kept or removed)
export const LOADING_OVERLAY_ID = 'atproto-loading-overlay'; // New overlay ID
export const LOADING_TEXT_ID = 'atproto-loading-text'; // ID for text inside overlay
export const POST_LIST_ID = 'atproto-post-list';
export const LOAD_MORE_BTN_ID = 'atproto-load-more-btn';
export const RECOMMENDED_LINK_ID = 'recommended-link'; // ID for the "Recommended" header link
export const POST_ARTICLE_CLASS = 'atproto-post-article'; // Class for individual post articles in the list
export const POST_CONTAINER_CLASS = 'atproto-post-container'; // Class for single post view ARTICLE container (inside main)
// --- IDs for Controls ---
export const LIST_CONTROLS_ID = 'atproto-list-controls';
export const SEARCH_INPUT_ID = 'atproto-search-input';
export const SORT_SELECT_ID = 'atproto-sort-select';
export const CATEGORY_FILTER_ID = 'atproto-category-filter'; // Added ID for category dropdown


// --- Standalone Widget Integration ---
// ID of the div OUTSIDE <main> where the comments wrapper will be placed
export const COMMENTS_WRAPPER_TARGET_ID = 'atproto-comments-wrapper-target';
// ID of the div INSIDE .widget-wrapper that the standalone widget JS targets
export const BSKY_WIDGET_TARGET_ID = 'bluesky-comment-widget'; // Use the ID expected by the widget's JS

// --- Other ---
export const DEFAULT_BLOG_TITLE = 'Romio Joseph';
export const DEFAULT_BLOG_DESCRIPTION = 'I write based on my interest, sometimes using just a few words. I am also bullish on decentralized platforms.';
export const MAX_PAGES_FOR_INITIAL_LOAD = 30;
export const SEARCH_DEBOUNCE_DELAY = 300; // Milliseconds to wait after typing before searching
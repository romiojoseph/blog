// js/utils.js
import { LOADING_OVERLAY_ID, LOADING_TEXT_ID } from './config.js';

/**
 * Formats an ISO date string (or Date object) into a custom, readable format.
 * Example: "20 Mar 2025, 04:36 PM"
 * @param {string | Date | null | undefined} isoDateInput - The ISO date string or Date object.
 * @returns {string} Formatted date string or 'N/A'/'Invalid Date'/'Date Error'.
 */
export function formatISODateToCustomString(isoDateInput) {
    if (!isoDateInput) return 'N/A';
    try {
        const date = typeof isoDateInput === 'string' ? new Date(isoDateInput) : isoDateInput;
        if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        let hour = date.getHours();
        const minute = String(date.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12; hour = hour ? hour : 12; // Adjust hours to 12-hour format
        const hourStr = String(hour).padStart(2, '0'); // Pad hour with leading zero if needed
        return `${day} ${month} ${year}, ${hourStr}:${minute} ${ampm}`;
    } catch (e) {
        console.error("Date formatting error:", e);
        return 'Date Error';
    }
}

/**
 * Basic HTML sanitization using textContent to prevent XSS.
 * NOTE: This is very basic. For content rendered directly as HTML (like from Markdown),
 * consider a more robust library like DOMPurify if the source isn't fully trusted.
 * Since the Markdown content here comes from the user's own DID, using marked.js's
 * default behavior or disabling its sanitizer for this specific content might be acceptable.
 * This function remains useful for sanitizing simple strings used in attributes or text nodes.
 * @param {string | null | undefined} str - The string to sanitize.
 * @returns {string} Sanitized string (HTML entities encoded).
 */
export function sanitize(str) {
    if (str === null || typeof str === 'undefined') return '';
    const temp = document.createElement('div');
    temp.textContent = String(str); // Ensure it's a string
    return temp.innerHTML;
}


/**
 * Updates the document title and meta description.
 * @param {string} title - The new title for the page.
 * @param {string} description - The new meta description.
 */
export function updateMeta(title, description) {
    try {
        // Use a default title suffix from config if available, otherwise hardcode
        const titleSuffix = "Blog • Built on Bluesky and ATProto"; // Or import from config if defined there
        document.title = `${sanitize(title)} | ${titleSuffix}`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', sanitize(description));
    } catch (e) {
        console.error("Error updating meta tags:", e);
    }
}

/** Helper function to set or update a specific meta tag */
function setMetaTag(attrName, content, useProperty = false) {
    try {
        const selector = useProperty ? `meta[property="${attrName}"]` : `meta[name="${attrName}"]`;
        let metaTag = document.querySelector(selector);
        if (!metaTag) {
            metaTag = document.createElement('meta');
            if (useProperty) metaTag.setAttribute('property', attrName);
            else metaTag.setAttribute('name', attrName);
            // Prepend to head for slightly better discovery? Or append, doesn't matter much.
            document.head.prepend(metaTag);
        }
        metaTag.setAttribute('content', content);
    } catch (e) {
        console.error("Error setting meta tag:", attrName, e);
    }
}

/** Helper function to remove a specific meta tag */
function removeMetaTag(attrName, useProperty = false) {
    try {
        const selector = useProperty ? `meta[property="${attrName}"]` : `meta[name="${attrName}"]`;
        const metaTag = document.querySelector(selector);
        if (metaTag) metaTag.remove();
    } catch (e) {
        console.error("Error removing meta tag:", attrName, e);
    }
}

/**
 * Updates Open Graph (OG) meta tags.
 * @param {string} title - The title for social sharing.
 * @param {'website' | 'article'} type - The OG type.
 * @param {string} description - The description for social sharing.
 * @param {string | null | undefined} imageUrl - Optional URL for the social sharing image.
 */
export function updateOgMeta(title, type = 'article', description, imageUrl) {
    try {
        const safeTitle = sanitize(title);
        const safeDescription = sanitize(description);
        const metas = {
            'og:title': safeTitle,
            'og:type': type,
            'og:description': safeDescription,
            'og:url': window.location.href,
            // Add site name for context
            'og:site_name': "Romio Joseph", // Or pull from config/title
        };

        // Handle image tag specifically
        if (imageUrl) {
            const safeImageUrl = sanitize(imageUrl);
            // Ensure URL is absolute for OG tags
            const absoluteImageUrl = new URL(safeImageUrl, window.location.origin).href;
            metas['og:image'] = absoluteImageUrl;
            // Optionally add secure URL if applicable
            if (absoluteImageUrl.startsWith('https://')) {
                metas['og:image:secure_url'] = absoluteImageUrl;
            }
            // You might want to add image dimensions if known:
            // metas['og:image:width'] = '1200';
            // metas['og:image:height'] = '630';
        } else {
            removeMetaTag('og:image', true); // property="og:image"
            removeMetaTag('og:image:secure_url', true);
            // removeMetaTag('og:image:width', true);
            // removeMetaTag('og:image:height', true);
        }

        for (const [key, content] of Object.entries(metas)) {
            setMetaTag(key, content, true); // OG tags use 'property'
        }
    } catch (e) {
        console.error("Error updating OG meta tags:", e);
    }
}

/**
 * Shows or hides the full-screen loading overlay.
 * @param {boolean} show - True to show the loader, false to hide.
 * @param {string} [text='Loading...'] - Optional text to display.
 */
export function showLoaderOverlay(show = true, text = 'Loading...') {
    const overlay = document.getElementById(LOADING_OVERLAY_ID);
    const loadingText = document.getElementById(LOADING_TEXT_ID);
    if (overlay) {
        try {
            if (loadingText) {
                loadingText.textContent = sanitize(text);
            }
            if (show) {
                overlay.style.display = 'flex'; // Make it visible before adding class
                // Delay adding class slightly to ensure transition works
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { // Double requestAnimationFrame for broader compatibility
                        overlay.classList.add('visible');
                    });
                });
            } else {
                overlay.classList.remove('visible');
                // Wait for transition to finish before setting display: none
                overlay.addEventListener('transitionend', () => {
                    if (!overlay.classList.contains('visible')) { // Check visibility state again in case it was shown quickly
                        overlay.style.display = 'none';
                    }
                }, { once: true }); // Ensure listener only runs once
                // Fallback timeout in case transitionend doesn't fire (e.g., element removed)
                setTimeout(() => {
                    if (!overlay.classList.contains('visible')) {
                        overlay.style.display = 'none';
                    }
                }, 350); // Slightly longer than transition duration
            }
        } catch (e) {
            console.error("Error updating loader overlay:", e);
            // Fallback to direct style manipulation if class manipulation fails
            overlay.style.display = show ? 'flex' : 'none';
            overlay.style.opacity = show ? '1' : '0';
        }
    } else {
        console.warn(`Loading overlay element with ID '${LOADING_OVERLAY_ID}' not found.`);
    }
}


/**
 * Attempts to trigger the rendering of Bluesky embeds
 * by dynamically adding the official embed script again.
 * This should be called *after* new embed blockquotes have been added to the DOM.
 */
export function triggerBlueskyEmbeds() {
    // Use a timeout to ensure the DOM update (innerHTML assignment) is likely complete
    setTimeout(() => {
        try {
            // Optional: Check if the script might already exist or be executing
            // This is a simple check; more robust checks might be needed if issues persist.
            const existingScript = document.querySelector('script[src="https://embed.bsky.app/static/embed.js"]');
            if (existingScript && document.body.contains(existingScript)) {
                // Attempt to remove and re-add if just appending doesn't work
                // console.log("Removing existing embed script before re-adding."); // Removed log
                existingScript.remove();
            }

            // Create a new script element
            const script = document.createElement('script');
            script.src = 'https://embed.bsky.app/static/embed.js';
            script.async = true;
            script.charset = 'utf-8';
            // Add an ID for potential future reference/removal
            script.id = `bluesky-embed-script-${Date.now()}`; // Unique ID

            // Append the new script to the body to trigger execution
            document.body.appendChild(script);
            // console.log('Dynamically appended Bluesky embed script to trigger rendering.'); // Removed log

            // Clean up the script tag after a reasonable delay to avoid accumulation
            // This assumes the script does its work synchronously or shortly after load
            script.onload = () => {
                setTimeout(() => {
                    // console.log(`Cleaning up dynamically added script: ${script.id}`); // Removed log
                    script.remove();
                }, 2000); // Remove after 2 seconds (adjust if needed)
            };
            script.onerror = () => {
                console.error(`Failed to load dynamically added script: ${script.id}`);
                script.remove(); // Clean up on error too
            }

        } catch (error) {
            console.error("Error trying to trigger Bluesky embeds:", error);
        }
    }, 100); // Small delay (100ms) - adjust if embeds still don't render reliably
}
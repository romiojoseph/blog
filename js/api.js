// js/api.js
import { LIST_RECORDS_BASE_URL, MAX_LIST_LIMIT } from './config.js';
import { sanitize } from './utils.js';

/**
 * Generates the URL for the com.atproto.repo.listRecords XRPC method.
 * @param {string} did - The DID of the repository owner.
 * @param {string} collection - The NSID of the collection.
 * @param {number} limit - The desired number of records (will be capped by MAX_LIST_LIMIT).
 * @param {string | null | undefined} cursor - The pagination cursor.
 * @returns {string} The constructed API URL.
 */
export function getListRecordsURL(did, collection, limit, cursor) {
    const actualLimit = Math.min(limit, MAX_LIST_LIMIT);
    let url = `${LIST_RECORDS_BASE_URL}?repo=${did}&collection=${collection}&limit=${actualLimit}&reverse=true`;
    if (cursor) {
        url += `&cursor=${cursor}`;
    }
    return url;
}

/**
 * Fetches records using listRecords with pagination support.
 * @param {string} did - The repository DID.
 * @param {string} collection - The collection NSID.
 * @param {number} limit - The number of records per page.
 * @param {string | null} cursor - The pagination cursor.
 * @returns {Promise<{records: Array<any>, cursor: string | null}>} Object containing records and the next cursor.
 * @throws {Error} If the fetch request fails or the API returns an error.
 */
export async function fetchRecords(did, collection, limit, cursor) {
    const url = getListRecordsURL(did, collection, limit, cursor);
    // console.log("Fetching records:", url); // Removed log
    try {
        // Use 'omit' for credentials as we're hitting a public endpoint usually
        // Adjust if authentication becomes necessary for listRecords in the future
        const response = await fetch(url, { credentials: 'omit' });

        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.message || 'No specific error message.'}`;
            } catch (e) {
                // Ignore if response body is not JSON or empty
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const records = data?.records ?? [];
        const nextCursor = data?.cursor ?? null; // Use null if cursor is missing/undefined
        // console.log(`Fetched ${records.length} records. Next cursor: ${nextCursor}`); // Removed log
        return { records, cursor: nextCursor };

    } catch (error) {
        console.error('Error fetching records:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


/**
 * Fetches all records for a specific slug by paginating through listRecords.
 * Stops after a reasonable number of pages to prevent infinite loops.
 * @param {string} did - The repository DID.
 * @param {string} collection - The collection NSID.
 * @param {string} slug - The slug to search for.
 * @param {number} [maxPagesToCheck=20] - Max number of pages to fetch.
 * @returns {Promise<object | null>} The found record object or null if not found/error.
 */
export async function findRecordBySlug(did, collection, slug, maxPagesToCheck = 20) {
    let currentCursor = null;
    let pagesFetched = 0;
    // console.log(`Searching for post with slug: ${slug}`); // Removed log

    try {
        do {
            pagesFetched++;
            const { records, cursor: nextCursor } = await fetchRecords(did, collection, MAX_LIST_LIMIT, currentCursor);
            // console.log(`Fetched page ${pagesFetched}/${maxPagesToCheck}, checking ${records.length} records for slug '${slug}'...`); // Removed log

            const foundRecord = records.find(p => p?.value?.slug === slug);

            if (foundRecord) {
                // console.log("Found record matching slug:", foundRecord.uri); // Removed log
                return foundRecord; // Return the full record object
            }

            currentCursor = nextCursor;

            if (!currentCursor) {
                // console.log(`Reached end of list after ${pagesFetched} pages. Slug '${slug}' not found.`); // Removed log
                return null; // Reached the end without finding
            }
            if (pagesFetched >= maxPagesToCheck) {
                console.warn(`Stopped searching for slug '${slug}' after ${maxPagesToCheck} pages.`);
                return null; // Limit reached
            }

        } while (currentCursor); // Continue as long as there's a cursor

        // Should not be reached if logic is correct, but as a safeguard:
        // console.log(`Search for slug '${slug}' completed without finding.`); // Removed log
        return null;

    } catch (error) {
        console.error(`Error while searching for slug '${slug}':`, error);
        // Optionally return null or re-throw depending on desired handling
        return null;
    }
}
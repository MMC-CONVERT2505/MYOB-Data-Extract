// import { myobRequest } from "./myobService.js";
// import { runWithPool } from "./requestPool.js";
// import env from "../config/env.js";

// const DEFAULT_PAGE_SIZE = 1000;

// const ENDPOINT_PAGE_SIZE = {
//     "/Purchase/Bill/Item": 500,
//     "/Purchase/Bill/Service": 500,
//     "/Purchase/Bill/Professional": 500,
//     "/Purchase/Bill/Miscellaneous": 500,

//     "/Sale/Invoice/Item": 500,
//     "/Sale/Invoice/Service": 500,
//     "/Sale/Invoice/Professional": 500,
//     "/Sale/Invoice/Miscellaneous": 500,

//     "/Purchase/Order": 500,
//     "/Sale/Order": 500,
// };
// const DEFAULT_POOL_SIZE = env.MYOB_REQUEST_POOL_SIZE;

// function withPaging(baseEndpoint, top, skip) {
//     const [path, query = ""] = baseEndpoint.split("?");
//     const params = new URLSearchParams(query);
//     params.delete("$top");
//     params.delete("$skip");
//     params.set("$top", top);
//     params.set("$skip", skip);
//     const search = params.toString().replace(/%24/g, "$");
//     return `${path}?${search}`;
// }

// export async function fetchAllPages(dbUser, userId, baseEndpoint, options = {}) {
//     const {
//         onBatch = null,
//         estimatedTotal = null,
//     } = options;

//     const label = baseEndpoint.split("?")[0];
//     const collected = onBatch ? null : [];
//     let fetchedCount = 0;
//     let skip = 0;
//     let reachedEnd = false;
//     let myobTotalCount = 0;
//     const endpointPath = baseEndpoint.split("?")[0];

//     const HEAVY_ENDPOINTS = new Set([
//         "/Purchase/Bill/Item",
//         "/Purchase/Bill/Service",
//         "/Purchase/Bill/Professional",
//         "/Purchase/Bill/Miscellaneous",
//         "/Sale/Invoice/Item",
//         "/Sale/Invoice/Service",
//         "/Sale/Invoice/Professional",
//         "/Sale/Invoice/Miscellaneous",
//     ]);

//     let poolSize = Math.max(
//         1,
//         options.poolSize ??
//         (HEAVY_ENDPOINTS.has(endpointPath) ? 1 : DEFAULT_POOL_SIZE)
//     );

//     let pageSize =
//         options.pageSize ??
//         ENDPOINT_PAGE_SIZE[endpointPath] ??
//         DEFAULT_PAGE_SIZE;

//     while (!reachedEnd) {
//         const batchSkips = Array.from({ length: poolSize }, (_, i) => skip + i * pageSize);

//         let pages;
//         try {
//             pages = await runWithPool(
//                 batchSkips.map((s) => () => fetchOnePage(dbUser, userId, baseEndpoint, pageSize, s)),
//                 poolSize
//             );
//         } catch (batchErr) {
//             if (poolSize > 1) {
//                 const nextPoolSize = Math.max(1, Math.floor(poolSize / 2));
//                 console.warn(
//                     `⚠️ ${label}: batch failed at concurrency ${poolSize} (${batchErr.message}); ` +
//                     `stepping down to concurrency ${nextPoolSize} and retrying from offset ${skip}`
//                 );
//                 poolSize = nextPoolSize;
//                 continue;
//             }

//             if (pageSize > 100) {
//                 const nextPageSize = Math.max(100, Math.floor(pageSize / 2));
//                 console.warn(
//                     `⚠️ ${label}: still failing sequentially (${batchErr.message}); ` +
//                     `shrinking page size ${pageSize} → ${nextPageSize} and retrying from offset ${skip}`
//                 );
//                 pageSize = nextPageSize;
//                 continue;
//             }

//             throw batchErr;
//         }

//         for (const pageResult of pages) {
//             if (pageResult === null) {
//                 reachedEnd = true;
//                 break;
//             }

//             // fetchOnePage returns { items, count } — always extract items
//             const pageItems = pageResult?.items ?? (Array.isArray(pageResult) ? pageResult : []);
//             const pageCount = pageResult?.count ?? 0;

//             if (pageItems === null || pageItems.length === 0) {
//                 reachedEnd = true;
//                 break;
//             }

//             // Capture the MYOB total count from the first page.
//             if (myobTotalCount === 0 && pageCount > 0) {
//                 myobTotalCount = pageCount;
//             }

//             fetchedCount += pageItems.length;

//             if (onBatch) {
//                 await onBatch(pageItems, { total: myobTotalCount });
//             } else {
//                 collected.push(...pageItems);
//             }

//             const totalLabel = (estimatedTotal || myobTotalCount)
//                 ? `/${estimatedTotal || myobTotalCount}`
//                 : "";
//             console.log(`Fetched: ${fetchedCount}${totalLabel} (${label})`);

//             if (pageItems.length < pageSize - 10) {
//                 reachedEnd = true;
//             }
//         }

//         skip += poolSize * pageSize;
//     }

//     return collected || [];
// }

// async function fetchOnePage(dbUser, userId, baseEndpoint, pageSize, skip) {
//     console.log(`Fetching ${baseEndpoint} | top=${pageSize} | skip=${skip}`);
//     const url = withPaging(baseEndpoint, pageSize, skip);
//     const data = await myobRequest(dbUser, userId, "GET", url, null, {
//         retries: 1,
//         baseDelayMs: 300,
//         label: `MYOB GET ${baseEndpoint} (skip=${skip})`,
//     });
//     const items = data?.Items || [];
//     if (items.length === 0) return null;
//     return { items, count: data?.Count ?? 0 };
// }




import { myobRequest } from "./myobService.js";
import { runWithPool } from "./requestPool.js";
import env from "../config/env.js";

const DEFAULT_PAGE_SIZE = 1000;

const ENDPOINT_PAGE_SIZE = {
    "/Purchase/Bill/Item": 500,
    "/Purchase/Bill/Service": 500,
    "/Purchase/Bill/Professional": 500,
    "/Purchase/Bill/Miscellaneous": 500,

    "/Sale/Invoice/Item": 500,
    "/Sale/Invoice/Service": 500,
    "/Sale/Invoice/Professional": 500,
    "/Sale/Invoice/Miscellaneous": 500,

    "/Purchase/Order": 500,
    "/Sale/Order": 500,
};
const DEFAULT_POOL_SIZE = env.MYOB_REQUEST_POOL_SIZE;

function withPaging(baseEndpoint, top, skip) {
    const [path, query = ""] = baseEndpoint.split("?");
    const params = new URLSearchParams(query);
    params.delete("$top");
    params.delete("$skip");
    params.set("$top", top);
    params.set("$skip", skip);
    const search = params.toString().replace(/%24/g, "$");
    return `${path}?${search}`;
}

export async function fetchAllPages(dbUser, userId, baseEndpoint, options = {}) {
    const {
        onBatch = null,
        estimatedTotal = null,
    } = options;

    const label = baseEndpoint.split("?")[0];
    const collected = onBatch ? null : [];
    let fetchedCount = 0;
    let skip = 0;
    let reachedEnd = false;
    let myobTotalCount = 0;
    const endpointPath = baseEndpoint.split("?")[0];

    const HEAVY_ENDPOINTS = new Set([
        "/Purchase/Bill/Item",
        "/Purchase/Bill/Service",
        "/Purchase/Bill/Professional",
        "/Purchase/Bill/Miscellaneous",
        "/Sale/Invoice/Item",
        "/Sale/Invoice/Service",
        "/Sale/Invoice/Professional",
        "/Sale/Invoice/Miscellaneous",
    ]);

    let poolSize = Math.max(
        1,
        options.poolSize ??
        (HEAVY_ENDPOINTS.has(endpointPath) ? 1 : DEFAULT_POOL_SIZE)
    );

    let pageSize =
        options.pageSize ??
        ENDPOINT_PAGE_SIZE[endpointPath] ??
        DEFAULT_PAGE_SIZE;

    while (!reachedEnd) {
        const batchSkips = Array.from({ length: poolSize }, (_, i) => skip + i * pageSize);

        let pages;
        try {
            pages = await runWithPool(
                batchSkips.map((s) => () => fetchOnePage(dbUser, userId, baseEndpoint, pageSize, s)),
                poolSize
            );
        } catch (batchErr) {
            if (poolSize > 1) {
                const nextPoolSize = Math.max(1, Math.floor(poolSize / 2));
                console.warn(
                    `⚠️ ${label}: batch failed at concurrency ${poolSize} (${batchErr.message}); ` +
                    `stepping down to concurrency ${nextPoolSize} and retrying from offset ${skip}`
                );
                poolSize = nextPoolSize;
                continue;
            }

            if (pageSize > 100) {
                const nextPageSize = Math.max(100, Math.floor(pageSize / 2));
                console.warn(
                    `⚠️ ${label}: still failing sequentially (${batchErr.message}); ` +
                    `shrinking page size ${pageSize} → ${nextPageSize} and retrying from offset ${skip}`
                );
                pageSize = nextPageSize;
                continue;
            }

            throw batchErr;
        }

        for (const pageResult of pages) {
            if (pageResult === null) {
                reachedEnd = true;
                break;
            }

            // fetchOnePage returns { items, count } — always extract items
            const pageItems = pageResult?.items ?? (Array.isArray(pageResult) ? pageResult : []);
            const pageCount = pageResult?.count ?? 0;

            if (pageItems === null || pageItems.length === 0) {
                reachedEnd = true;
                break;
            }

            // Capture the MYOB total count from the first page.
            if (myobTotalCount === 0 && pageCount > 0) {
                myobTotalCount = pageCount;
            }

            fetchedCount += pageItems.length;

            if (onBatch) {
                await onBatch(pageItems, { total: myobTotalCount });
            } else {
                collected.push(...pageItems);
            }

            const totalLabel = (estimatedTotal || myobTotalCount)
                ? `/${estimatedTotal || myobTotalCount}`
                : "";
            console.log(`Fetched: ${fetchedCount}${totalLabel} (${label})`);

            if (pageItems.length < pageSize - 10) {
                reachedEnd = true;
            }
        }

        skip += poolSize * pageSize;
    }

    return collected || [];
}

async function fetchOnePage(dbUser, userId, baseEndpoint, pageSize, skip) {
    console.log(`Fetching ${baseEndpoint} | top=${pageSize} | skip=${skip}`);
    const url = withPaging(baseEndpoint, pageSize, skip);
    const data = await myobRequest(dbUser, userId, "GET", url, null, {
        retries: 1,
        baseDelayMs: 300,
        label: `MYOB GET ${baseEndpoint} (skip=${skip})`,
    });
    const items = data?.Items || [];
    if (items.length === 0) return null;
    return { items, count: data?.Count ?? 0 };
}

// ── Date-range chunking for heavy deep-join endpoints ──────────
//
// Some AccountRight endpoints - specifically the "/Item" invoice/bill
// layouts, which deep-join every LineItem to Item/Account/Location -
// have been observed to return a genuine server-side 500 (confirmed via
// a direct Postman call, no app/retry logic involved, ~29s before
// failing) when asked to filter+sort+paginate a large date range in one
// request. This isn't something client-side retries or concurrency
// tuning can fix - MYOB's server is the one failing. The most likely
// trigger is total record volume in the requested range crossing some
// complexity ceiling for this endpoint (consistent with "this worked
// before" if the range's end date defaults to "today" and has simply
// grown over time).
//
// splitDateRange breaks [start, end] into consecutive chunks (default 2
// months each) so no single request has to cover more than a bounded
// window, regardless of how wide the overall requested range is.
export function splitDateRange(start, end, chunkMonths = 2) {
    const chunks = [];
    let chunkStart = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);

    while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setUTCMonth(chunkEnd.getUTCMonth() + chunkMonths);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() - 1); // inclusive end
        const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;

        chunks.push([
            chunkStart.toISOString().substring(0, 10),
            actualEnd.toISOString().substring(0, 10),
        ]);

        chunkStart = new Date(actualEnd);
        chunkStart.setUTCDate(chunkStart.getUTCDate() + 1);
    }

    return chunks;
}

/**
 * Like fetchAllPages, but for endpoints that can't reliably handle a
 * wide date range filtered in one request - fetches chunkMonths-sized
 * windows one at a time (not in parallel with each other, to avoid
 * piling more load onto an endpoint that's already shown it struggles),
 * concatenating results (when no onBatch is given) or streaming them
 * through onBatch per chunk (when one is given, e.g. the async job
 * pipeline, so a huge extraction never has to sit fully in memory).
 * Each chunk still uses fetchAllPages' normal pooled pagination/retry/
 * page-size-stepdown behavior internally for its own pages.
 *
 * @param {(chunkStart: string, chunkEnd: string) => string} buildEndpoint
 *   Given one chunk's [start, end], returns the full endpoint+querystring
 *   (including its own $filter) to fetch for that chunk.
 */
export async function fetchAllPagesChunked(dbUser, userId, start, end, buildEndpoint, options = {}) {
    const { chunkMonths = 2, ...fetchOptions } = options;
    const chunks = splitDateRange(start, end, chunkMonths);
    let all = [];
    let label = null;

    for (const [chunkStart, chunkEnd] of chunks) {
        const endpoint = buildEndpoint(chunkStart, chunkEnd);
        if (!label) label = endpoint.split("?")[0];
        console.log(`📦 Fetching chunk ${chunkStart} → ${chunkEnd} (${chunks.length} chunk(s) total)`);
        const items = await fetchAllPages(dbUser, userId, endpoint, fetchOptions);
        if (items && items.length) {
            all = all.concat(items);
        }
        console.log(`[MYOB] module=${label} chunk=${chunkStart}→${chunkEnd} items=${items ? items.length : 0} runningTotal=${all.length}`);
    }

    console.log(`[MYOB] module=${label} extraction complete total=${all.length}`);
    return all;
}
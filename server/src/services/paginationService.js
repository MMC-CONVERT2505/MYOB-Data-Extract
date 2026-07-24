import { myobRequest } from "./myobService.js";
import { runWithPool } from "./requestPool.js";
import env from "../config/env.js";

const DEFAULT_PAGE_SIZE = 1000;

const ENDPOINT_PAGE_SIZE = {
    "/Purchase/Bill/Item": 200,
    "/Purchase/Bill/Service": 200,
    "/Purchase/Bill/Professional": 200,
    "/Purchase/Bill/Miscellaneous": 200,

    "/Sale/Invoice/Item": 300,
    "/Sale/Invoice/Service": 300,
    "/Sale/Invoice/Professional": 300,
    "/Sale/Invoice/Miscellaneous": 300,

    "/Purchase/Order": 300,
    "/Sale/Order": 300,
};
const DEFAULT_POOL_SIZE = env.MYOB_REQUEST_POOL_SIZE; // configurable, default 5

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
    const endpointPath = baseEndpoint.split("?")[0];

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

            // Already fully sequential (poolSize=1) and STILL failing — this
            // means MYOB itself is timing out on the query, not on concurrency
            // (common for heavy joined endpoints like /Purchase/Bill/Item at
            // deep offsets). Shrink the page size so MYOB has less work to do
            // per request, instead of failing the whole extraction.
            if (pageSize > 100) {
                const nextPageSize = Math.max(100, Math.floor(pageSize / 2));
                console.warn(
                    `⚠️ ${label}: still failing sequentially (${batchErr.message}); ` +
                    `shrinking page size ${pageSize} → ${nextPageSize} and retrying from offset ${skip}`
                );
                pageSize = nextPageSize;
                continue;
            }

            throw batchErr; // even a 100-row page fails — real/unrecoverable error
        }

        for (const pageItems of pages) {
            if (pageItems === null) {
                reachedEnd = true;
                break;
            }

            fetchedCount += pageItems.length;

            if (onBatch) {
                await onBatch(pageItems);
            } else {
                collected.push(...pageItems);
            }

            const totalLabel = estimatedTotal ? `/${estimatedTotal}` : "";
            console.log(`Fetched: ${fetchedCount}${totalLabel} (${label})`);

            if (pageItems.length < pageSize) {
                reachedEnd = true;
            }
        }

        skip += poolSize * pageSize;
    }

    return collected || [];
}

async function fetchOnePage(dbUser, userId, baseEndpoint, pageSize, skip) {
    console.log(
        `Fetching ${baseEndpoint} | top=${pageSize} | skip=${skip}`
    );
    const url = withPaging(baseEndpoint, pageSize, skip);
    const data = await myobRequest(dbUser, userId, "GET", url);
    const items = data?.Items || [];
    return items.length === 0 ? null : items;
}
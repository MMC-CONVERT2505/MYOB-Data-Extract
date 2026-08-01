// ── Concurrent MYOB pagination ─────────────────────────────────
//
// BOTTLENECK IDENTIFIED (old code, in extractionController.js):
//   Every single dataType case repeated this pattern ~18 times:
//     let allItems = [];
//     let pageUrl = `...?$top=1000...`;
//     while (pageUrl) {
//       const data = await myobRequest(...);   // <-- awaited one at a time
//       allItems = allItems.concat(data.Items);
//       pageUrl = data.NextPageLink ? ... : null;
//     }
//   For 200k records at $top=1000 that's ~200 *sequential* HTTP round
//   trips. Sequential network latency (even 150-300ms/request) turns
//   into 30-60+ seconds of pure waiting, with no retry on 429/500s, and
//   no bound on how much gets buffered in `allItems` before it's handed
//   to the Excel/conversion step.
//
// FIX:
//   MYOB's AccountRight API pages are addressable directly via
//   $top/$skip (the existing code already used $top/$skip explicitly
//   for credit-note/vendor-credit/etc. endpoints), so we don't have to
//   wait for page N's response to know page N+1's URL. We fetch pages
//   in *speculative batches* bounded by a configurable Request Pool
//   (default 5), instead of either "one at a time" or "unlimited
//   parallel" (which would risk hammering MYOB's rate limits).
//
// This module is the single place pagination/concurrency/retry/
// progress-logging logic lives now, instead of being duplicated in
// every controller case block.

import { myobRequest } from "./myobService.js";
import { runWithPool } from "./requestPool.js";
import env from "../config/env.js";

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_POOL_SIZE = env.MYOB_REQUEST_POOL_SIZE; // configurable, default 5

function withPaging(baseEndpoint, top, skip) {
  const [path, query = ""] = baseEndpoint.split("?");
  const params = new URLSearchParams(query);
  // Strip any $top/$skip already present (e.g. callers historically
  // passed `${baseEp}?$top=1000&$orderby=Date desc`) so we don't end
  // up with duplicate params like `$top=1000&...&$top=1000&$skip=1000`,
  // which MYOB's API rejects with a 400.
  params.delete("$top");
  params.delete("$skip");
  params.set("$top", top);
  params.set("$skip", skip);
  // URLSearchParams encodes "$" as "%24" — MYOB's OData-style API expects
  // literal "$top"/"$skip"/"$filter"/"$orderby", so undo that encoding.
  const search = params.toString().replace(/%24/g, "$");
  return `${path}?${search}`;
}

/**
 * Fetches ALL pages of a MYOB list endpoint using a bounded concurrent
 * request pool instead of a sequential NextPageLink walk.
 *
 * Back-compatible drop-in for the old "while (pageUrl) { ... }" blocks:
 * same return value (a flat array of Items), same log-friendly output,
 * but faster (concurrent) and resilient (retries via myobRequest).
 *
 * @param {object} dbUser
 * @param {string} userId
 * @param {string} baseEndpoint  e.g. `/Sale/Invoice?$orderby=Date desc`
 *                                (may already contain $top/$skip/$filter —
 *                                 $top/$skip will be overridden per page)
 * @param {object} [options]
 * @param {number} [options.pageSize=1000]
 * @param {number} [options.poolSize=5]     configurable request-pool size
 * @param {(batch: any[]) => (void|Promise<void>)} [options.onBatch]
 *        Optional streaming callback, invoked once per page as soon as
 *        it arrives. When provided, pages are NOT accumulated in memory
 *        — this is what the streaming Excel writer uses so a 200k+ row
 *        extraction never needs to hold the full dataset in RAM.
 * @returns {Promise<any[]>} all items (empty array if onBatch was used,
 *                            since nothing is retained in that mode)
 */
export async function fetchAllPages(dbUser, userId, baseEndpoint, options = {}) {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    onBatch = null,
    estimatedTotal = null,
  } = options;

  const label = baseEndpoint.split("?")[0];
  const collected = onBatch ? null : [];
  let fetchedCount = 0;
  let skip = 0;
  let reachedEnd = false;
  let poolSize = Math.max(1, options.poolSize ?? DEFAULT_POOL_SIZE);

  while (!reachedEnd) {
    // Build one batch of up to `poolSize` speculative page requests:
    // skip, skip+pageSize, skip+2*pageSize, ...
    const batchSkips = Array.from({ length: poolSize }, (_, i) => skip + i * pageSize);

    let pages;
    try {
      pages = await runWithPool(
        batchSkips.map((s) => () => fetchOnePage(dbUser, userId, baseEndpoint, pageSize, s)),
        poolSize
      );
    } catch (batchErr) {
      // MYOB's AccountRight API can only handle so many simultaneous
      // requests against a single company file — some data types (heavy
      // joins like /Purchase/Bill/Item) will time out under concurrency
      // that a single sequential request handles fine. Instead of
      // failing the whole 200k-record extraction because of this, we
      // self-heal by stepping concurrency down and retrying the SAME
      // skip range (nothing is lost/skipped) before giving up entirely.
      if (poolSize > 1) {
        const nextPoolSize = Math.max(1, Math.floor(poolSize / 2));
        console.warn(
          `⚠️ ${label}: batch failed at concurrency ${poolSize} (${batchErr.message}); ` +
          `stepping down to concurrency ${nextPoolSize} and retrying from offset ${skip}`
        );
        poolSize = nextPoolSize;
        continue; // retry same `skip`, smaller pool, don't advance
      }
      throw batchErr; // already fully sequential (poolSize === 1) and still failing
    }

    for (const pageItems of pages) {
      if (pageItems === null) {
        // Empty page → we've gone past the end of the dataset.
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
        // Short page → this was the last page of real data.
        reachedEnd = true;
      }
    }

    skip += poolSize * pageSize;
  }

  return collected || [];
}

async function fetchOnePage(dbUser, userId, baseEndpoint, pageSize, skip) {
  const url = withPaging(baseEndpoint, pageSize, skip);
  const data = await myobRequest(dbUser, userId, "GET", url);
  const items = data?.Items || [];
  return items.length === 0 ? null : items;
}

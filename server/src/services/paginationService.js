import { myobRequest } from "./myobService.js";
import { runWithPool } from "./requestPool.js";
import env from "../config/env.js";

const DEFAULT_PAGE_SIZE = 1000;
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
      throw batchErr;
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
  const url = withPaging(baseEndpoint, pageSize, skip);
  const data = await myobRequest(dbUser, userId, "GET", url);
  const items = data?.Items || [];
  return items.length === 0 ? null : items;
}
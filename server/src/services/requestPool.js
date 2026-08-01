// ── Request Pool (bounded concurrency) + Retry helper ─────────
//
// Why this file exists:
// The old extraction code fired MYOB API calls one at a time, in a
// strict sequential `while (pageUrl) { ... }` loop. For a 200k-record
// dataset paged at 1000 rows/page that is ~200 *sequential* round trips
// — each one waiting on full network latency before the next starts.
// It also had zero retry handling, so a single transient 429/500/502/503
// or timeout blew up the whole extraction.
//
// This module gives us two small, dependency-free primitives:
//   1. runWithPool(taskFns, poolSize) — runs an array of task functions
//      with at most `poolSize` running concurrently (a "worker pool"),
//      instead of either unbounded Promise.all() (which would hammer
//      the MYOB API with hundreds of parallel requests) or one-at-a-time.
//   2. withRetry(fn, options) — wraps a single request with exponential
//      backoff retry for transient failures (429/500/502/503/timeouts).

/**
 * Runs an array of zero-arg task functions with a bounded number of
 * them "in flight" at any time, preserving the result order.
 *
 * @param {Array<() => Promise<any>>} taskFns
 * @param {number} poolSize  max concurrent tasks (configurable; default 5)
 * @returns {Promise<any[]>} results in the same order as taskFns
 */
export async function runWithPool(taskFns, poolSize = 5) {
  const results = new Array(taskFns.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= taskFns.length) return;
      results[current] = await taskFns[current]();
    }
  }

  const workerCount = Math.max(1, Math.min(poolSize, taskFns.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// Status codes / error codes worth retrying automatically.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` with exponential backoff on transient failures.
 * Honors a numeric `Retry-After` header (seconds) on 429 responses.
 *
 * @param {() => Promise<any>} fn
 * @param {object} [opts]
 * @param {number} [opts.retries=4]       max retry attempts (not counting the first try)
 * @param {number} [opts.baseDelayMs=500] base delay, doubled each retry
 * @param {string} [opts.label="request"] used only for log messages
 */
export async function withRetry(fn, opts = {}) {
  const { retries = 4, baseDelayMs = 500, label = "request" } = opts;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.response?.status;
      const code = err.code;
      const isRetryable = RETRYABLE_STATUS.has(status) || RETRYABLE_CODES.has(code);

      if (!isRetryable || attempt >= retries) {
        throw err;
      }

      const retryAfterHeader = err.response?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
      const backoffMs = retryAfterMs || baseDelayMs * 2 ** attempt;

      attempt++;
      console.warn(
        `⏳ ${label}: retryable failure (status=${status || code}), retry ${attempt}/${retries} in ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }
}

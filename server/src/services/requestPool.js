// ── Request Pool (bounded concurrency) + Retry helper ─────────

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

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry(fn, opts = {}) {
 const { retries = 3, baseDelayMs = 500, maxDelayMs = 15000, label = "request" } = opts;

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
      const backoffMs = retryAfterMs || Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);

      attempt++;
      console.warn(
        `⏳ ${label}: retryable failure (status=${status || code}), retry ${attempt}/${retries} in ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }
}
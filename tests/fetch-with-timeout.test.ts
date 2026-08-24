import assert from "node:assert/strict";
import test from "node:test";

import {
  requestWithTimeout,
  RequestAbortedError,
  RequestTimeoutError,
} from "../lib/fetch-with-timeout";

function pendingRequest(signal: AbortSignal) {
  return new Promise<Response>((_resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

test("aborts an external request after the configured timeout", async () => {
  await assert.rejects(
    requestWithTimeout(pendingRequest, { timeoutMs: 5 }),
    (error: unknown) =>
      error instanceof RequestTimeoutError && error.timeoutMs === 5,
  );
});

test("preserves caller-initiated cancellation as an abort error", async () => {
  const controller = new AbortController();
  const request = requestWithTimeout(pendingRequest, {
    signal: controller.signal,
    timeoutMs: 1_000,
  });

  controller.abort();

  await assert.rejects(request, RequestAbortedError);
});

test("returns successful responses without changing them", async () => {
  let receivedSignal: AbortSignal | null | undefined;
  const response = new Response("ok");
  const result = await requestWithTimeout(
    async (signal) => {
      receivedSignal = signal;
      return response;
    },
  );

  assert.equal(result, response);
  assert.ok(receivedSignal);
  assert.equal(receivedSignal.aborted, false);
});

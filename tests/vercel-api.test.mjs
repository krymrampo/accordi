import assert from "node:assert/strict";
import test from "node:test";
import pageHandler, { safeSourcePath } from "../api/page.js";

function mockResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("accepts local source paths and preserves query strings", () => {
  assert.equal(safeSourcePath("/accordi/internazionali/pink-floyd/hey-you/?x=1"), "/accordi/internazionali/pink-floyd/hey-you/?x=1");
});

test("rejects source URLs outside the allowed origin", () => {
  assert.equal(safeSourcePath("https://example.com/private"), null);
});

test("page function returns upstream HTML with a Vercel cache policy", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html><h1>Hey You</h1></html>", { status: 200 });
  const response = mockResponse();

  try {
    await pageHandler({ method: "GET", query: { path: "/accordi/test/" } }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 200);
  assert.match(response.body.html, /Hey You/);
  assert.match(response.headers["Cache-Control"], /s-maxage=604800/);
});

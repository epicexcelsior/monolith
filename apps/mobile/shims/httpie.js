/**
 * httpie shim for React Native — uses fetch() instead of Node's https.
 *
 * Matches the httpie response shape: { data, headers, statusCode, statusMessage }
 * Used by colyseus.js HTTP module for room matchmaking.
 */

async function send(method, uri, opts) {
  opts = opts || {};
  const headers = opts.headers || {};
  let body = opts.body;

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(body);
  }

  const url = typeof uri === "string" ? uri : uri.href;
  const res = await fetch(url, {
    method,
    headers,
    body: method !== "GET" ? body : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  const result = {
    data,
    statusCode: res.status,
    statusMessage: res.statusText,
    headers: {},
  };

  res.headers.forEach((value, key) => {
    result.headers[key.toLowerCase()] = value;
  });

  if (res.status >= 400) {
    const err = new Error(data?.error || res.statusText);
    err.statusCode = res.status;
    err.statusMessage = res.statusText;
    err.data = data;
    err.headers = result.headers;
    throw err;
  }

  return result;
}

const get = send.bind(null, "GET");
const post = send.bind(null, "POST");
const put = send.bind(null, "PUT");
const patch = send.bind(null, "PATCH");
const del = send.bind(null, "DELETE");

// Export as both named and default
const httpie = { send, get, post, put, patch, del };

// CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = httpie;
  // Don't set .default — metro will handle it
}

// ESM
export { send, get, post, put, patch, del };
export default httpie;

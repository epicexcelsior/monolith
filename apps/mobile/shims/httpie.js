/**
 * httpie shim for React Native — uses fetch() instead of Node's https.
 *
 * Matches the httpie response shape: { data, headers, statusCode, statusMessage }
 * Used by colyseus.js HTTP module for room matchmaking.
 */

/* eslint-disable no-undef */

async function send(method, uri, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  var body = opts.body;

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(body);
  }

  var url = typeof uri === "string" ? uri : uri.href;
  var res = await fetch(url, {
    method: method,
    headers: headers,
    body: method !== "GET" ? body : undefined,
  });

  var contentType = res.headers.get("content-type") || "";
  var data;
  if (contentType.indexOf("application/json") !== -1) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  var result = {
    data: data,
    statusCode: res.status,
    statusMessage: res.statusText,
    headers: {},
  };

  res.headers.forEach(function (value, key) {
    result.headers[key.toLowerCase()] = value;
  });

  if (res.status >= 400) {
    var err = new Error((data && data.error) || res.statusText);
    err.statusCode = res.status;
    err.statusMessage = res.statusText;
    err.data = data;
    err.headers = result.headers;
    throw err;
  }

  return result;
}

exports.send = send;
exports.get = send.bind(null, "GET");
exports.post = send.bind(null, "POST");
exports.put = send.bind(null, "PUT");
exports.patch = send.bind(null, "PATCH");
exports.del = send.bind(null, "DELETE");

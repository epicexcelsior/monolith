/**
 * Tests for the httpie shim used in React Native.
 *
 * Validates that the fetch-based shim matches the httpie API shape
 * expected by colyseus.js's HTTP module.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpie = require("@/shims/httpie");

function makeMockResponse(status: number, statusText: string, data: any) {
  const headersMap: Record<string, string> = { "content-type": "application/json" };
  return {
    ok: status < 400,
    status,
    statusText,
    headers: {
      get: (k: string) => headersMap[k.toLowerCase()] ?? null,
      forEach: (cb: (v: string, k: string) => void) => {
        for (const [k, v] of Object.entries(headersMap)) cb(v, k);
      },
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe("httpie shim", () => {
  it("exports the required methods", () => {
    expect(typeof httpie.send).toBe("function");
    expect(typeof httpie.get).toBe("function");
    expect(typeof httpie.post).toBe("function");
    expect(typeof httpie.put).toBe("function");
    expect(typeof httpie.patch).toBe("function");
    expect(typeof httpie.del).toBe("function");
  });

  it("get() calls fetch with GET method", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeMockResponse(200, "OK", { rooms: [] }),
    );

    try {
      const result = await httpie.get("http://localhost:2567/matchmake/joinOrCreate/tower");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:2567/matchmake/joinOrCreate/tower",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({ rooms: [] });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("post() sends JSON body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeMockResponse(200, "OK", { sessionId: "abc123", room: { roomId: "room1" } }),
    );

    try {
      const result = await httpie.post("http://localhost:2567/matchmake/joinOrCreate/tower", {
        headers: {},
        body: { options: {} },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:2567/matchmake/joinOrCreate/tower",
        expect.objectContaining({
          method: "POST",
          body: '{"options":{}}',
        }),
      );
      expect(result.data.sessionId).toBe("abc123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws on HTTP 4xx errors with correct shape", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeMockResponse(404, "Not Found", { error: "Room not found" }),
    );

    try {
      await expect(
        httpie.get("http://localhost:2567/matchmake/joinOrCreate/missing"),
      ).rejects.toMatchObject({
        statusCode: 404,
        data: { error: "Room not found" },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("passes custom headers", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeMockResponse(200, "OK", {}),
    );

    try {
      await httpie.get("http://localhost:2567/test", {
        headers: { Authorization: "Bearer token123" },
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:2567/test",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer token123" }),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

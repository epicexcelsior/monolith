/**
 * ws shim for React Native — re-exports the global WebSocket.
 *
 * colyseus.js imports 'ws' for Node, but falls back to globalThis.WebSocket.
 * React Native provides WebSocket globally, so we just export it.
 */

const WebSocketShim = globalThis.WebSocket || class {};

// CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = WebSocketShim;
  // Don't set .default — metro will handle it
}

// ESM
export default WebSocketShim;

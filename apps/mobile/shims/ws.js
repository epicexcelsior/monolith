/**
 * ws shim for React Native — re-exports the global WebSocket.
 *
 * colyseus.js imports 'ws' for Node, but falls back to globalThis.WebSocket.
 * React Native provides WebSocket globally, so we just export it.
 */

/* eslint-disable no-undef */

module.exports = globalThis.WebSocket || function() {};

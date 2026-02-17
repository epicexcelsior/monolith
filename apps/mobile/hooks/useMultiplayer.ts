/**
 * Thin wrapper around the multiplayer Zustand store.
 * Re-exports for convenience so existing imports don't break.
 */
export { useMultiplayerStore as useMultiplayer, onChargeResult } from "@/stores/multiplayer-store";

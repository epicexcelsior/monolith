import { create } from "zustand";

export type ToastType = "error" | "success" | "info";

interface StatusToastStore {
  message: string | null;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  dismiss: () => void;
}

export const useStatusToastStore = create<StatusToastStore>((set) => ({
  message: null,
  type: "info",
  showToast: (message, type = "info") => set({ message, type }),
  dismiss: () => set({ message: null }),
}));

/** Convenience for non-React contexts (fire-and-forget error reporting). */
export function showStatusToast(message: string, type: ToastType = "info") {
  useStatusToastStore.getState().showToast(message, type);
}

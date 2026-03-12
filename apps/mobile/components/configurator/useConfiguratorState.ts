import { useCallback, useRef, useState } from "react";
import { useTowerStore } from "@/stores/tower-store";
import { useBlockActions } from "@/hooks/useBlockActions";

interface ConfiguratorChanges {
  color?: string;
  style?: number;
  name?: string;
}

export function useConfiguratorState(blockId: string) {
  const block = useTowerStore((s) => s.demoBlocks.find((b) => b.id === blockId));

  // Snapshot original values for revert
  const originalRef = useRef({
    color: block?.ownerColor,
    style: block?.style,
    name: block?.name,
  });

  // Pending changes (not yet saved to network)
  const [pending, setPending] = useState<ConfiguratorChanges>({});

  // Preview values = original merged with pending
  const preview = {
    color: pending.color ?? originalRef.current.color,
    style: pending.style ?? originalRef.current.style,
    name: pending.name ?? originalRef.current.name,
  };

  const updatePreview = useCallback((changes: Partial<ConfiguratorChanges>) => {
    setPending((prev) => ({ ...prev, ...changes }));
  }, []);

  // On save: send all pending changes as ONE network message
  const { applyCustomize } = useBlockActions();

  const save = useCallback(() => {
    if (Object.keys(pending).length === 0) return;
    // applyCustomize handles dual-path (offline + multiplayer)
    applyCustomize({
      ...(pending.color && { color: pending.color }),
      ...(pending.style !== undefined && { style: pending.style }),
      ...(pending.name && { name: pending.name }),
    });
  }, [pending, applyCustomize]);

  const discard = useCallback(() => {
    // Revert local preview to original
    // Since we haven't sent anything to the network, nothing to undo
    setPending({});
  }, []);

  const hasChanges = Object.keys(pending).length > 0;

  return { block, preview, updatePreview, save, discard, hasChanges };
}

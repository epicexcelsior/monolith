import React from "react";
import { useWindowDimensions } from "react-native";
import BottomPanel from "./BottomPanel";
import SettingsContent from "@/components/settings/SettingsContent";

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * SettingsSheet — Bottom sheet overlay for settings/profile content on tower screen.
 * Renders dark-themed SettingsContent inside a dark BottomPanel.
 */
export default function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { height } = useWindowDimensions();
  const panelHeight = Math.round(height * 0.75);

  return (
    <BottomPanel
      visible={visible}
      onClose={onClose}
      title="Me"
      height={panelHeight}
      dark
    >
      <SettingsContent onClose={onClose} />
    </BottomPanel>
  );
}

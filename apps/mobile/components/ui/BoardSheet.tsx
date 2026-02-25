import React from "react";
import { useWindowDimensions } from "react-native";
import BottomPanel from "./BottomPanel";
import BoardContent from "@/components/board/BoardContent";

interface BoardSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * BoardSheet — Bottom sheet overlay for board/leaderboard content on tower screen.
 * Renders dark-themed BoardContent inside a dark BottomPanel.
 */
export default function BoardSheet({ visible, onClose }: BoardSheetProps) {
  const { height } = useWindowDimensions();
  const panelHeight = Math.round(height * 0.75);

  return (
    <BottomPanel
      visible={visible}
      onClose={onClose}
      title="Board"
      height={panelHeight}
      dark
    >
      <BoardContent onSelectBlock={() => onClose()} />
    </BottomPanel>
  );
}

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { BLOCK_COLORS } from "@monolith/common";
import { SPACING, RADIUS, COLORS } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export default function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <View style={styles.grid}>
      {BLOCK_COLORS.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.cell,
            { backgroundColor: color },
            selected === color && styles.cellSelected,
          ]}
          onPress={() => {
            onSelect(color);
            hapticButtonPress();
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  cell: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cellSelected: {
    borderColor: COLORS.text,
    borderWidth: 3,
  },
});

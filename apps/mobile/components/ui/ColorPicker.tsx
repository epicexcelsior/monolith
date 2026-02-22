import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BLOCK_COLORS } from "@monolith/common";
import { SPACING, RADIUS, COLORS, FONT_FAMILY } from "@/constants/theme";
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
        >
          {selected === color && (
            <Text style={styles.check}>✓</Text>
          )}
        </TouchableOpacity>
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
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: {
    borderColor: COLORS.text,
    borderWidth: 3,
  },
  check: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.bodyBold,
    color: COLORS.textOnDark,
    textShadowColor: COLORS.bgTower,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

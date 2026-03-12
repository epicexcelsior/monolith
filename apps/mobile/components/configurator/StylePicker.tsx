import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { BLOCK_STYLE_LABELS } from "@monolith/common";
import { hapticStyleSelect } from "@/utils/haptics";
import { playCustomize } from "@/utils/audio";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";

interface Props {
  currentStyle: number;
  onStyleChange: (style: number) => void;
  currentColor?: string;
}

// Representative gradient colors for each style's preview swatch
const STYLE_PREVIEW_COLORS: Record<number, [string, string]> = {
  0: ["#4488ff", "#4488ff"], // Default — user color
  1: ["#ff6b6b", "#6bff6b"], // Holographic — rainbow
  2: ["#00ffff", "#ff00ff"], // Neon — bright saturated
  3: ["#888888", "#666666"], // Matte — desaturated
  4: ["#aaddff", "#ffffff"], // Glass — lighter
  5: ["#ff4400", "#ff8800"], // Fire — orange-red
  6: ["#88ccff", "#ffffff"], // Ice — blue-white
  7: ["#ff2200", "#220000"], // Lava — red-black
  8: ["#44ff88", "#8844ff"], // Aurora — green-purple
  9: ["#44ffcc", "#ffffff"], // Crystal — teal-white
  10: ["#44aa22", "#886644"], // Nature — green-brown
};

export function StylePicker({ currentStyle, onStyleChange, currentColor }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {BLOCK_STYLE_LABELS.map((style) => {
        const isSelected = currentStyle === style.id;
        const colors = STYLE_PREVIEW_COLORS[style.id] || ["#888", "#888"];
        // For Default style, use the user's current color
        const swatchColor = style.id === 0 && currentColor ? currentColor : colors[0];

        return (
          <TouchableOpacity
            key={style.id}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => {
              onStyleChange(style.id);
              hapticStyleSelect();
              playCustomize();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.swatch, { backgroundColor: swatchColor }]}>
              {/* Gradient hint for multi-color styles */}
              {style.id !== 0 && (
                <View
                  style={[
                    styles.swatchGradient,
                    { backgroundColor: colors[1], opacity: 0.5 },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.name, isSelected && styles.nameSelected]}>
              {style.name}
            </Text>
            <Text style={styles.description}>{style.description}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  card: {
    width: 100,
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: "center",
    gap: 4,
  },
  cardSelected: {
    borderColor: COLORS.goldAccent,
    borderWidth: 2,
    backgroundColor: "rgba(212, 175, 85, 0.08)",
  },
  swatch: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
  },
  swatchGradient: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "60%",
    height: "60%",
    borderTopLeftRadius: 30,
  },
  name: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.text,
    textAlign: "center",
  },
  nameSelected: {
    color: COLORS.goldAccent,
  },
  description: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});

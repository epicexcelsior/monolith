import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { ColorWheel } from "./ColorWheel";
import { StylePicker } from "./StylePicker";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";

interface Props {
  preview: { color?: string; style?: number; name?: string };
  onColorChange: (color: string) => void;
  onStyleChange: (style: number) => void;
  onNameChange: (name: string) => void;
}

export function ConfiguratorControls({
  preview,
  onColorChange,
  onStyleChange,
  onNameChange,
}: Props) {
  const [nameText, setNameText] = useState(preview.name || "");

  return (
    <View style={styles.container}>
      {/* Color Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>COLOR</Text>
        <ColorWheel
          currentColor={preview.color || "#4488ff"}
          onColorChange={onColorChange}
        />
      </View>

      {/* Style Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>STYLE</Text>
        <StylePicker
          currentStyle={preview.style ?? 0}
          onStyleChange={onStyleChange}
          currentColor={preview.color}
        />
      </View>

      {/* Name Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NAME</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={nameText}
            onChangeText={(text) => setNameText(text.slice(0, 12))}
            onBlur={() => {
              if (nameText.trim()) {
                onNameChange(nameText.trim());
                hapticButtonPress();
                playButtonTap();
              }
            }}
            onSubmitEditing={() => {
              if (nameText.trim()) {
                onNameChange(nameText.trim());
                hapticButtonPress();
                playButtonTap();
              }
            }}
            placeholder="Block name"
            placeholderTextColor={COLORS.textMuted}
            maxLength={12}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.charCount}>{nameText.length}/12</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.lg,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14,
    color: COLORS.text,
  },
  charCount: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    color: COLORS.textMuted,
  },
});

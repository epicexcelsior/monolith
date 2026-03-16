import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import { BLOCK_COLORS, BLOCK_ICONS } from "@monolith/common";
import { hapticButtonPress } from "@/utils/haptics";
import type { DemoBlock } from "@/stores/tower-store";

const PERSONALITIES = [
  { name: "Happy", kaomoji: "^_^" },
  { name: "Cool", kaomoji: "B-)" },
  { name: "Sleepy", kaomoji: "-_-" },
  { name: "Fierce", kaomoji: ">_<" },
  { name: "Derp", kaomoji: ":P" },
] as const;

interface InspectorCustomizeProps {
  block: DemoBlock;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
  onStyleChange: (style: number) => void;
  onTextureChange: (textureId: number) => void;
  onNameSubmit: (name: string) => void;
  onPersonalityChange?: (personality: number) => void;
  onImageUpload?: () => void;
  isPostClaim?: boolean;
}

export default function InspectorCustomize({
  block,
  onColorChange,
  onEmojiChange,
  onNameSubmit,
  onPersonalityChange,
  isPostClaim,
}: InspectorCustomizeProps) {
  const [nameInput, setNameInput] = useState("");

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.customizeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {isPostClaim && (
        <View style={styles.encourageContainer}>
          <Text style={styles.encourageHeading}>Make it yours!</Text>
          <Text style={styles.encourageSubtext}>Pick a face and color for your Spark</Text>
        </View>
      )}

      {/* FACE — personality choice (first for prominence) */}
      {onPersonalityChange && (
        <>
          <Text style={styles.sectionLabel}>FACE</Text>
          <Text style={styles.sectionSubtitle}>Your Spark's personality</Text>
          <View style={styles.personalityRow}>
            {PERSONALITIES.map((p, i) => (
              <TouchableOpacity
                key={p.name}
                style={[
                  styles.personalityCell,
                  block.personality === i && styles.personalityCellSelected,
                ]}
                onPress={() => {
                  onPersonalityChange(i);
                  hapticButtonPress();
                }}
              >
                <Text style={styles.personalityKaomoji}>{p.kaomoji}</Text>
                <Text style={styles.personalityLabel}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* COLOR */}
      <Text style={styles.sectionLabel}>COLOR</Text>
      <View style={styles.colorGrid}>
        {BLOCK_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorCell,
              { backgroundColor: color },
              block.ownerColor === color && styles.colorCellSelected,
            ]}
            onPress={() => {
              onColorChange(color);
              hapticButtonPress();
            }}
          >
            {block.ownerColor === color && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* NAME — text identity */}
      <Text style={styles.sectionLabel}>NAME</Text>
      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          value={nameInput}
          onChangeText={(t) => setNameInput(t.slice(0, 12))}
          placeholder={block.name || "My Spark"}
          placeholderTextColor={COLORS.textMuted}
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={() => onNameSubmit(nameInput)}
        />
        <TouchableOpacity style={styles.nameButton} onPress={() => onNameSubmit(nameInput)}>
          <Text style={styles.nameButtonText}>Set</Text>
        </TouchableOpacity>
      </View>

      {/* EMOJI — compact row of curated emojis */}
      <Text style={styles.sectionLabel}>EMOJI</Text>
      <View style={styles.emojiGrid}>
        {BLOCK_ICONS.map((icon) => (
          <TouchableOpacity
            key={icon}
            style={[styles.emojiCell, block.emoji === icon && styles.emojiCellSelected]}
            onPress={() => { onEmojiChange(icon); hapticButtonPress(); }}
          >
            <Text style={styles.emojiText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentScroll: {
    flexShrink: 1,
    maxHeight: 380,
  },
  customizeContent: {
    paddingBottom: SPACING.md,
  },
  encourageContainer: {
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  encourageHeading: {
    ...TEXT.headingLg,
    color: COLORS.gold,
    textAlign: "center",
  },
  encourageSubtext: {
    ...TEXT.bodySm,
    color: COLORS.textOnDark,
    textAlign: "center",
    marginTop: 2,
    opacity: 0.8,
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.inspectorTextSecondary,
    marginTop: SPACING.md,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  colorCell: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorCellSelected: {
    borderColor: COLORS.goldAccent,
    borderWidth: 2,
    backgroundColor: "rgba(212, 175, 85, 0.10)",
  },
  check: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bodyBold,
    color: COLORS.textOnDark,
    textShadowColor: COLORS.textShadowDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.inspectorBgMuted,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 13,
    color: COLORS.inspectorText,
    borderWidth: 1,
    borderColor: COLORS.inspectorBorder,
  },
  nameButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  nameButtonText: {
    color: COLORS.textOnGold,
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.inspectorBgMuted,
  },
  emojiCellSelected: {
    borderWidth: 2,
    borderColor: COLORS.goldAccent,
    backgroundColor: "rgba(212, 175, 85, 0.10)",
  },
  emojiText: {
    fontSize: 18,
  },
  personalityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  sectionSubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.inspectorTextSecondary,
    marginTop: 2,
  },
  personalityCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.inspectorBgMuted,
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 56,
  },
  personalityCellSelected: {
    borderColor: COLORS.goldAccent,
    backgroundColor: "rgba(212, 175, 85, 0.15)",
  },
  personalityKaomoji: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 18,
    color: COLORS.inspectorText,
  },
  personalityLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.inspectorTextSecondary,
    marginTop: 2,
  },
});

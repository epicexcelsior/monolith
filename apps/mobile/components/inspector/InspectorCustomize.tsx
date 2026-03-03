import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import { BLOCK_COLORS, BLOCK_ICONS, BLOCK_TEXTURES, CUSTOMIZATION_TIERS, getUnlockedColorCount, getUnlockedEmojiCount, isStyleUnlocked, areTexturesUnlocked } from "@monolith/common";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import type { DemoBlock } from "@/stores/tower-store";

const BLOCK_STYLES = [
  { id: 0, label: "Default", icon: "🔲" },
  { id: 1, label: "Holo", icon: "🌈" },
  { id: 2, label: "Neon", icon: "💜" },
  { id: 3, label: "Matte", icon: "🪨" },
  { id: 4, label: "Glass", icon: "💎" },
  { id: 5, label: "Fire", icon: "🔥" },
  { id: 6, label: "Ice", icon: "❄️" },
  { id: 7, label: "Lava", icon: "🌋" },
  { id: 8, label: "Aurora", icon: "🌌" },
  { id: 9, label: "Crystal", icon: "💠" },
  { id: 10, label: "Nature", icon: "🌿" },
] as const;

interface InspectorCustomizeProps {
  block: DemoBlock;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
  onStyleChange: (style: number) => void;
  onTextureChange: (textureId: number) => void;
  onNameSubmit: (name: string) => void;
  onImageUpload?: () => void;
  isPostClaim?: boolean;
}

export default function InspectorCustomize({
  block,
  onColorChange,
  onEmojiChange,
  onStyleChange,
  onTextureChange,
  onNameSubmit,
  onImageUpload,
  isPostClaim,
}: InspectorCustomizeProps) {
  const [nameInput, setNameInput] = useState("");
  const streak = block.streak ?? 0;

  const unlockedColors = getUnlockedColorCount(streak);
  const unlockedEmojis = getUnlockedEmojiCount(streak);
  const texturesUnlocked = areTexturesUnlocked(streak);

  // Split styles into unlocked and locked for progressive disclosure
  const unlockedStyles = BLOCK_STYLES.filter((s) => isStyleUnlocked(s.id, streak));
  const lockedStyles = BLOCK_STYLES.filter((s) => !isStyleUnlocked(s.id, streak));

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
          <Text style={styles.encourageSubtext}>Pick a color and emoji to personalize your block</Text>
        </View>
      )}

      {/* COLOR — larger cells, unlocked first */}
      <Text style={styles.sectionLabel}>COLOR</Text>
      <View style={styles.colorGrid}>
        {BLOCK_COLORS.slice(0, unlockedColors).map((color) => (
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
        {/* Locked colors shown dimmed at the end */}
        {unlockedColors < BLOCK_COLORS.length && (
          <TouchableOpacity
            style={[styles.colorCell, styles.lockedHintCell]}
            onPress={() => hapticButtonPress()}
            activeOpacity={0.6}
          >
            <Text style={styles.lockIconSmall}>+{BLOCK_COLORS.length - unlockedColors}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* EMOJI — wrapping grid instead of horizontal scroll */}
      <Text style={styles.sectionLabel}>EMOJI</Text>
      <View style={styles.emojiGrid}>
        {BLOCK_ICONS.slice(0, unlockedEmojis).map((icon) => (
          <TouchableOpacity
            key={icon}
            style={[styles.emojiCell, block.emoji === icon && styles.cellSelected]}
            onPress={() => { onEmojiChange(icon); hapticButtonPress(); }}
          >
            <Text style={styles.emojiText}>{icon}</Text>
          </TouchableOpacity>
        ))}
        {streak < CUSTOMIZATION_TIERS.FULL_EMOJIS_STREAK && (
          <View style={[styles.emojiCell, styles.lockedHintCell]}>
            <Text style={styles.lockIconSmall}>+{BLOCK_ICONS.length - unlockedEmojis}</Text>
          </View>
        )}
      </View>

      {/* STYLE — unlocked shown first, locked collapsed */}
      <Text style={styles.sectionLabel}>STYLE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
        {unlockedStyles.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.cell,
              (block.style ?? 0) === s.id && styles.cellSelected,
            ]}
            onPress={() => {
              onStyleChange(s.id);
              hapticButtonPress();
              playButtonTap();
            }}
          >
            <Text style={styles.cellIcon}>{s.icon}</Text>
            <Text style={[
              styles.cellLabel,
              (block.style ?? 0) === s.id && styles.cellLabelSelected,
            ]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
        {lockedStyles.length > 0 && (
          <View style={[styles.cell, styles.lockedHintCell]}>
            <Text style={styles.lockIconSmall}>+{lockedStyles.length}</Text>
            <Text style={styles.cellLabel}>{CUSTOMIZATION_TIERS.ANIMATED_STYLES_STREAK}d</Text>
          </View>
        )}
      </ScrollView>

      {/* TEXTURE */}
      <Text style={styles.sectionLabel}>TEXTURE</Text>
      {texturesUnlocked ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {BLOCK_TEXTURES.map((tex) => (
            <TouchableOpacity
              key={tex.id}
              style={[styles.cell, (block.textureId ?? 0) === tex.id && styles.cellSelected]}
              onPress={() => { onTextureChange(tex.id); hapticButtonPress(); playButtonTap(); }}
            >
              <Text style={styles.cellIcon}>{tex.icon}</Text>
              <Text style={[styles.cellLabel, (block.textureId ?? 0) === tex.id && styles.cellLabelSelected]}>
                {tex.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.lockedSection}>
          <Text style={styles.lockedSectionText}>
            Streak {CUSTOMIZATION_TIERS.TEXTURES_STREAK} to unlock
            {streak > 0 ? ` · ${CUSTOMIZATION_TIERS.TEXTURES_STREAK - streak} more days` : ""}
          </Text>
        </View>
      )}

      {/* IMAGE — upload button (Phase 1C) */}
      <Text style={styles.sectionLabel}>IMAGE</Text>
      <TouchableOpacity
        style={styles.imageUploadButton}
        onPress={() => {
          if (onImageUpload) {
            hapticButtonPress();
            onImageUpload();
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.imageUploadIcon}>{block.imageUrl ? "🖼️" : "📷"}</Text>
        <Text style={styles.imageUploadText}>
          {block.imageUrl ? "Change Image" : "Add Image"}
        </Text>
      </TouchableOpacity>

      {/* NAME */}
      <Text style={styles.sectionLabel}>NAME</Text>
      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          value={nameInput}
          onChangeText={(t) => setNameInput(t.slice(0, 12))}
          placeholder={block.name || "My Block"}
          placeholderTextColor={COLORS.textMuted}
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={() => onNameSubmit(nameInput)}
        />
        <TouchableOpacity style={styles.nameButton} onPress={() => onNameSubmit(nameInput)}>
          <Text style={styles.nameButtonText}>Set</Text>
        </TouchableOpacity>
      </View>

      {/* Unlock footer — single progressive disclosure message */}
      {streak < CUSTOMIZATION_TIERS.FULL_EMOJIS_STREAK && (
        <View style={styles.unlockFooter}>
          <Text style={styles.unlockFooterText}>
            Keep your streak going to unlock more options
          </Text>
        </View>
      )}
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
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.sm,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.xs,
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
    borderColor: COLORS.text,
    borderWidth: 3,
  },
  check: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bodyBold,
    color: COLORS.textOnDark,
    textShadowColor: COLORS.textShadowDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
  },
  emojiText: {
    fontSize: 18,
  },
  hScroll: {
    flexDirection: "row",
    maxHeight: 56,
    marginTop: SPACING.xs,
  },
  cell: {
    width: 52,
    height: 48,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldSubtle,
  },
  cellIcon: {
    fontSize: 16,
  },
  cellLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  cellLabelSelected: {
    color: COLORS.gold,
  },
  lockedHintCell: {
    backgroundColor: COLORS.bgMuted,
    opacity: 0.5,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  lockIconSmall: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  lockedSection: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  lockedSectionText: {
    ...TEXT.bodySm,
    color: COLORS.textMuted,
  },
  imageUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    marginTop: SPACING.xs,
  },
  imageUploadIcon: {
    fontSize: 20,
  },
  imageUploadText: {
    ...TEXT.buttonSm,
    color: COLORS.gold,
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  unlockFooter: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  unlockFooterText: {
    ...TEXT.caption,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});

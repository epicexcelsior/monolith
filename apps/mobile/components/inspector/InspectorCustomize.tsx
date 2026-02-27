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
  isPostClaim?: boolean;
}

export default function InspectorCustomize({
  block,
  onColorChange,
  onEmojiChange,
  onStyleChange,
  onTextureChange,
  onNameSubmit,
  isPostClaim,
}: InspectorCustomizeProps) {
  const [nameInput, setNameInput] = useState("");
  const streak = block.streak ?? 0;

  const unlockedColors = getUnlockedColorCount(streak);
  const unlockedEmojis = getUnlockedEmojiCount(streak);
  const texturesUnlocked = areTexturesUnlocked(streak);

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.customizeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {isPostClaim && (
        <Text style={styles.encourageText}>Make it yours! Pick a color and emoji</Text>
      )}

      {/* COLOR */}
      <Text style={styles.sectionLabel}>COLOR</Text>
      <View style={styles.colorGrid}>
        {BLOCK_COLORS.map((color, i) => {
          const locked = i >= unlockedColors;
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCell,
                { backgroundColor: color },
                block.ownerColor === color && styles.colorCellSelected,
                locked && styles.lockedCell,
              ]}
              onPress={() => {
                if (locked) {
                  // Could show toast — for now haptic feedback only
                  hapticButtonPress();
                  return;
                }
                onColorChange(color);
                hapticButtonPress();
              }}
            >
              {block.ownerColor === color && <Text style={styles.check}>✓</Text>}
              {locked && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={styles.lockStreakText}>{CUSTOMIZATION_TIERS.PREMIUM_COLORS_STREAK}d</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* EMOJI */}
      <Text style={styles.sectionLabel}>EMOJI</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
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
          <View style={[styles.emojiCell, styles.lockedEmojiCell]}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockStreakMini}>{CUSTOMIZATION_TIERS.FULL_EMOJIS_STREAK}d</Text>
          </View>
        )}
      </ScrollView>

      {/* STYLE */}
      <Text style={styles.sectionLabel}>STYLE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
        {BLOCK_STYLES.map((s) => {
          const locked = !isStyleUnlocked(s.id, streak);
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.cell,
                (block.style ?? 0) === s.id && styles.cellSelected,
                locked && styles.lockedCell,
              ]}
              onPress={() => {
                if (locked) {
                  hapticButtonPress();
                  return;
                }
                onStyleChange(s.id);
                hapticButtonPress();
                playButtonTap();
              }}
            >
              <Text style={[styles.cellIcon, locked && styles.dimmedText]}>{s.icon}</Text>
              <Text style={[
                styles.cellLabel,
                (block.style ?? 0) === s.id && styles.cellLabelSelected,
                locked && styles.dimmedText,
              ]}>
                {locked ? `🔒 ${CUSTOMIZATION_TIERS.ANIMATED_STYLES_STREAK}d` : s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* TEXTURE — only show section when unlocked or close to unlocking */}
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
            🔒 Streak {CUSTOMIZATION_TIERS.TEXTURES_STREAK} to unlock textures
            {streak > 0 ? ` · ${CUSTOMIZATION_TIERS.TEXTURES_STREAK - streak} more days` : ""}
          </Text>
        </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentScroll: {
    flexShrink: 1,
    maxHeight: 340,
  },
  customizeContent: {
    paddingBottom: SPACING.md,
  },
  encourageText: {
    ...TEXT.bodyLg,
    color: COLORS.gold,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.xs,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  colorCell: {
    width: 38,
    height: 38,
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
  emojiCell: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
  },
  emojiText: {
    fontSize: 18,
  },
  lockedCell: {
    opacity: 0.45,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.hudPillBg,
  },
  lockIcon: {
    fontSize: 12,
  },
  lockStreakText: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 12,
    color: COLORS.gold,
    marginTop: 1,
  },
  lockStreakMini: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  lockedEmojiCell: {
    backgroundColor: COLORS.bgMuted,
    opacity: 0.6,
  },
  dimmedText: {
    opacity: 0.5,
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
});

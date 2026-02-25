import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import ColorPicker from "@/components/ui/ColorPicker";
import { BLOCK_ICONS, BLOCK_TEXTURES } from "@monolith/common";
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
}

export default function InspectorCustomize({
  block,
  onColorChange,
  onEmojiChange,
  onStyleChange,
  onTextureChange,
  onNameSubmit,
}: InspectorCustomizeProps) {
  const [showMoreStyles, setShowMoreStyles] = useState(false);
  const [nameInput, setNameInput] = useState("");

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.customizeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {/* Primary: COLOR */}
      <Text style={styles.sectionLabel}>COLOR</Text>
      <ColorPicker selected={block.ownerColor} onSelect={onColorChange} />

      {/* EMOJI */}
      <Text style={styles.sectionLabel}>EMOJI</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
        {BLOCK_ICONS.slice(0, 20).map((icon) => (
          <TouchableOpacity
            key={icon}
            style={[styles.emojiCell, block.emoji === icon && styles.cellSelected]}
            onPress={() => onEmojiChange(icon)}
          >
            <Text style={styles.emojiText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* More styles expander */}
      <TouchableOpacity
        style={styles.moreStylesButton}
        onPress={() => { setShowMoreStyles(!showMoreStyles); hapticButtonPress(); playButtonTap(); }}
      >
        <Text style={styles.moreStylesText}>
          {showMoreStyles ? "Less options" : "More styles \u203A"}
        </Text>
      </TouchableOpacity>

      {showMoreStyles && (
        <>
          <Text style={styles.sectionLabel}>STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {BLOCK_STYLES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.cell, (block.style ?? 0) === s.id && styles.cellSelected]}
                onPress={() => onStyleChange(s.id)}
              >
                <Text style={styles.cellIcon}>{s.icon}</Text>
                <Text style={[styles.cellLabel, (block.style ?? 0) === s.id && styles.cellLabelSelected]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>TEXTURE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {BLOCK_TEXTURES.map((tex) => (
              <TouchableOpacity
                key={tex.id}
                style={[styles.cell, (block.textureId ?? 0) === tex.id && styles.cellSelected]}
                onPress={() => onTextureChange(tex.id)}
              >
                <Text style={styles.cellIcon}>{tex.icon}</Text>
                <Text style={[styles.cellLabel, (block.textureId ?? 0) === tex.id && styles.cellLabelSelected]}>
                  {tex.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentScroll: {
    flexShrink: 1,
    maxHeight: 300,
  },
  customizeContent: {
    paddingBottom: SPACING.md,
  },
  sectionLabel: {
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.xs,
  },
  hScroll: {
    flexDirection: "row",
    maxHeight: 56,
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
    fontSize: 9,
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
  moreStylesButton: {
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
    alignSelf: "flex-start",
  },
  moreStylesText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 0.3,
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
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

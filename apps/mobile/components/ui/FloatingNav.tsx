import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CubeFocus, Trophy, UserCircle } from "phosphor-react-native";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

type NavTab = "tower" | "board" | "me";

interface FloatingNavProps {
  activeTab: NavTab;
  onTabPress: (tab: NavTab) => void;
  visible: boolean;
}

const ICON_SIZE = 18;

const TABS: { key: NavTab; label: string }[] = [
  { key: "tower", label: "Tower" },
  { key: "board", label: "Board" },
  { key: "me", label: "Me" },
];

function NavIcon({ tab, active }: { tab: NavTab; active: boolean }) {
  const color = active ? COLORS.goldLight : COLORS.textMuted;
  const weight = active ? "fill" : "regular";
  switch (tab) {
    case "tower": return <CubeFocus size={ICON_SIZE} color={color} weight={weight} />;
    case "board": return <Trophy size={ICON_SIZE} color={color} weight={weight} />;
    case "me": return <UserCircle size={ICON_SIZE} color={color} weight={weight} />;
  }
}

export default function FloatingNav({ activeTab, onTabPress, visible }: FloatingNavProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 8 }]}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeInDown.springify().damping(14).stiffness(120).delay(100)}
        style={styles.pillRow}
      >
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.key;
          return (
            <Animated.View
              key={tab.key}
              entering={FadeInDown.springify().damping(14).stiffness(120).delay(150 + i * 50)}
            >
              <TouchableOpacity
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => {
                  hapticButtonPress();
                  playButtonTap();
                  onTabPress(tab.key);
                }}
                activeOpacity={0.7}
              >
                <NavIcon tab={tab.key} active={isActive} />
                <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  pillRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    ...GLASS_STYLE.hudDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minHeight: 44,
  },
  pillActive: {
    backgroundColor: COLORS.goldSubtle,
  },
  pillLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  pillLabelActive: {
    color: COLORS.goldLight,
  },
});

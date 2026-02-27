import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playPokeReceive } from "@/utils/audio";
import { useTowerStore } from "@/stores/tower-store";
import { onPokeReceived, type PokeReceived } from "@/stores/multiplayer-store";

const TOAST_DURATION = 6000;

export default function PokeReceivedToast() {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const dataRef = useRef<PokeReceived | null>(null);
  const [visible, setVisible] = React.useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((data: PokeReceived) => {
    dataRef.current = data;
    setVisible(true);

    // 3D shake + SFX already triggered by block_update handler in multiplayer-store
    const towerState = useTowerStore.getState();
    if (towerState.recentlyPokedId !== data.blockId) {
      towerState.setRecentlyPokedId(data.blockId);
    }
    hapticButtonPress();
    playPokeReceive();

    // Entrance: slide + scale + fade + glow pulse
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Gold glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Auto-dismiss
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -140,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        glowAnim.stopAnimation();
        glowAnim.setValue(0);
      });
    }, TOAST_DURATION);
  }, [slideAnim, opacityAnim, scaleAnim, glowAnim]);

  useEffect(() => {
    onPokeReceived(showToast);
  }, [showToast]);

  if (!visible || !dataRef.current) return null;

  const { fromName, energyAdded } = dataRef.current;
  const isBlink = fromName.includes("via Blink");

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + SPACING.sm },
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      {/* Glow backdrop */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }) },
        ]}
      />

      <View style={styles.toast}>
        {/* Icon area */}
        <View style={styles.iconContainer}>
          <Text style={styles.emoji}>{isBlink ? "⚡" : "👉"}</Text>
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isBlink ? "Blink Poke!" : "You got poked!"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {fromName} poked your block!
          </Text>
          <View style={styles.energyBadge}>
            <Text style={styles.energyText}>+{energyAdded}% energy</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: RADIUS.xl + 4,
    backgroundColor: COLORS.goldGlow,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    ...GLASS_STYLE.hudDark,
    borderWidth: 1,
    borderColor: COLORS.gold,
    gap: SPACING.sm + 4,
    width: "100%",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.goldSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 26,
  },
  textContainer: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
  },
  energyBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.goldSubtle,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginTop: 2,
  },
  energyText: {
    color: COLORS.goldLight,
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playPokeReceive } from "@/utils/audio";
import { useTowerStore } from "@/stores/tower-store";
import { onPokeReceived, type PokeReceived } from "@/stores/multiplayer-store";

const TOAST_DURATION = 5000;

export default function PokeReceivedToast() {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dataRef = useRef<PokeReceived | null>(null);
  const [visible, setVisible] = React.useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((data: PokeReceived) => {
    dataRef.current = data;
    setVisible(true);

    // Trigger 3D shake animation on the poked block
    useTowerStore.getState().setRecentlyPokedId(data.blockId);

    hapticButtonPress();
    playPokeReceive();

    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    }, TOAST_DURATION);
  }, [slideAnim, opacityAnim]);

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
        { top: insets.top + SPACING.md },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <Text style={styles.emoji}>{isBlink ? "⚡" : "👉"}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isBlink ? "Blink Poke!" : "You got poked!"}
          </Text>
          <Text style={styles.subtitle}>
            {fromName} poked your block! +{energyAdded}% energy
          </Text>
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
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    ...GLASS_STYLE,
    borderWidth: 1,
    borderColor: COLORS.goldMid,
    gap: SPACING.sm,
  },
  emoji: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: COLORS.goldMid,
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 14,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    marginTop: 2,
  },
});

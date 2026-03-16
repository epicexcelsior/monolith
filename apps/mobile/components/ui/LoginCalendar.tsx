/**
 * LoginCalendar — 7-day rolling login reward calendar.
 *
 * Shows as a BottomPanel overlay with 7 gold circles.
 * Today's circle pulses and is tappable. Collected days are filled gold.
 * Future days are gray. Tap to collect, auto-dismisses after 2s.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import BottomPanel from "@/components/ui/BottomPanel";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";
import { useLoginStore } from "@/stores/login-store";
import { LOGIN_REWARDS } from "@monolith/common";

const REWARD_ICONS: Record<string, string> = {
  xp: "✨",
  loot: "🎁",
  freeze: "🧊",
};

interface LoginCalendarProps {
  visible: boolean;
  onClose: () => void;
}

export default function LoginCalendar({ visible, onClose }: LoginCalendarProps) {
  const currentDay = useLoginStore((s) => s.currentDay);
  const collectedDays = useLoginStore((s) => s.collectedDays);
  const collectToday = useLoginStore((s) => s.collectToday);

  // Pre-allocate animation values in refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const collectScale = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulsing glow for today's circle
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  // Cleanup dismiss timer
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const handleCollect = useCallback(() => {
    collectToday();

    // Scale bounce animation
    Animated.sequence([
      Animated.timing(collectScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(collectScale, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 2s
    dismissTimer.current = setTimeout(() => {
      onClose();
    }, 2000);
  }, [collectToday, collectScale, onClose]);

  return (
    <BottomPanel visible={visible} onClose={onClose} height={200} title="Daily Login Rewards" dark>
      <View style={styles.container}>
        <View style={styles.row}>
          {LOGIN_REWARDS.map((reward, idx) => {
            const dayNum = idx + 1;
            const isCollected = collectedDays[idx];
            const isToday = dayNum === currentDay && !isCollected;
            const isFuture = dayNum > currentDay || (dayNum === currentDay && isCollected);
            const icon = REWARD_ICONS[reward.type] ?? "✨";

            return (
              <View key={dayNum} style={styles.dayColumn}>
                <TouchableOpacity
                  disabled={!isToday}
                  onPress={isToday ? handleCollect : undefined}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={[
                      styles.circle,
                      isCollected && styles.circleCollected,
                      isFuture && !isCollected && styles.circleFuture,
                      isToday && styles.circleToday,
                      isToday && { transform: [{ scale: pulseAnim }] },
                      isCollected && dayNum === currentDay - 1 && { transform: [{ scale: collectScale }] },
                    ]}
                  >
                    <Text style={[styles.dayNumber, isCollected && styles.dayNumberCollected, isFuture && !isCollected && styles.dayNumberFuture]}>
                      {dayNum}
                    </Text>
                    <Text style={styles.rewardIcon}>{isCollected ? "✓" : icon}</Text>
                  </Animated.View>
                </TouchableOpacity>

                {isToday && (
                  <Text style={styles.collectLabel}>COLLECT</Text>
                )}
                {!isToday && (
                  <Text style={styles.rewardLabel} numberOfLines={1}>{reward.label}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </BottomPanel>
  );
}

const CIRCLE_SIZE = 42;

const styles = StyleSheet.create({
  container: {
    paddingTop: SPACING.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.xs,
  },
  dayColumn: {
    alignItems: "center",
    width: CIRCLE_SIZE + 4,
    gap: 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: "transparent",
  },
  circleCollected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.goldLight,
  },
  circleFuture: {
    borderColor: COLORS.inspectorTextSecondary,
    backgroundColor: "transparent",
    opacity: 0.5,
  },
  circleToday: {
    borderColor: COLORS.goldLight,
    backgroundColor: COLORS.goldSubtle,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  dayNumber: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: COLORS.gold,
    marginTop: 2,
  },
  dayNumberCollected: {
    color: COLORS.bgTower,
  },
  dayNumberFuture: {
    color: COLORS.inspectorTextSecondary,
  },
  rewardIcon: {
    fontSize: 10,
    marginTop: -1,
  },
  collectLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: COLORS.goldLight,
    letterSpacing: 1,
  },
  rewardLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 8,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
  },
});

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, SPACING, FONT_FAMILY } from "@/constants/theme";
import { useActivityStore } from "@/stores/activity-store";
import { useTowerStore } from "@/stores/tower-store";

const MAX_VISIBLE = 3;
const EVENT_LIFETIME_MS = 5_000;

interface VisibleEvent {
  id: string;
  message: string;
  expiresAt: number;
}

function FeedRow({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0.85,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <Text style={styles.rowText} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  );
}

export default function ActivityFeed() {
  const events = useActivityStore((s) => s.events);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const [visibleEvents, setVisibleEvents] = useState<VisibleEvent[]>([]);
  const seenIds = useRef(new Set<string>());

  // Add new events, dedup, keep only MAX_VISIBLE
  useEffect(() => {
    const now = Date.now();

    for (const event of events) {
      if (seenIds.current.has(event.id)) continue;
      seenIds.current.add(event.id);

      const message = event.message ?? `${event.owner} ${event.type}d a block`;
      setVisibleEvents((prev) => {
        const next = [
          ...prev,
          { id: event.id, message, expiresAt: now + EVENT_LIFETIME_MS },
        ];
        return next.slice(-MAX_VISIBLE);
      });
    }

    if (seenIds.current.size > 200) {
      seenIds.current = new Set(events.slice(-100).map((e) => e.id));
    }
  }, [events]);

  // Expire old events
  useEffect(() => {
    if (visibleEvents.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setVisibleEvents((prev) => {
        const filtered = prev.filter((e) => e.expiresAt > now);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEvents.length > 0]);

  // Hide when block inspector is open or nothing to show
  if (selectedBlockId || visibleEvents.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {visibleEvents.map((event) => (
        <FeedRow key={event.id} message={event.message} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 12,
    left: SPACING.md,
    right: SPACING.md,
  },
  row: {
    paddingVertical: 1,
  },
  rowText: {
    color: "rgba(240, 236, 230, 0.75)",
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    letterSpacing: 0.2,
    textShadowColor: COLORS.textShadowDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

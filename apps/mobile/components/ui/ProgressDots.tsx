import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import { COLORS, SPACING, TIMING } from "@/constants/theme";

interface ProgressDotsProps {
    /** 0-based index of the active dot */
    current: number;
    /** Total number of dots */
    total: number;
}

/**
 * ProgressDots — Duolingo-style horizontal step indicator.
 * Active dot is gold + scaled up; inactive dots are dim.
 */
export default function ProgressDots({ current, total }: ProgressDotsProps) {
    return (
        <View style={styles.container}>
            {Array.from({ length: total }, (_, i) => (
                <Dot key={i} active={i === current} completed={i < current} />
            ))}
        </View>
    );
}

function Dot({ active, completed }: { active: boolean; completed: boolean }) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: withSpring(active ? 1.3 : 1, TIMING.microSpring),
            },
        ],
        backgroundColor: active
            ? COLORS.gold
            : completed
              ? COLORS.goldGlow
              : COLORS.hudPillBg,
    }));

    return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const DOT_SIZE = 8;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING.sm,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
    },
});

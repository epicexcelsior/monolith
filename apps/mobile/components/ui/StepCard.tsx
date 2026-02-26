import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { COLORS, GLASS_STYLE, RADIUS, SPACING, TEXT, TIMING } from "@/constants/theme";
import ProgressDots from "./ProgressDots";

interface StepCardProps {
    /** Card title */
    title: string;
    /** Optional subtitle below title */
    subtitle?: string;
    /** 1-based step number (displayed as "Step N of M") */
    step?: number;
    /** Total steps */
    totalSteps?: number;
    /** Card contents */
    children: React.ReactNode;
    /** Optional extra styles on the outer container */
    style?: ViewStyle;
}

/**
 * StepCard — Glass onboarding panel with gold accent border.
 *
 * Includes: title, subtitle, step label, ProgressDots footer, slide-up entrance.
 * Replaces the duplicated `panelContainer` pattern across OnboardingFlow phases.
 */
export default function StepCard({
    title,
    subtitle,
    step,
    totalSteps,
    children,
    style,
}: StepCardProps) {
    const showProgress = step != null && totalSteps != null;

    return (
        <Animated.View
            entering={FadeInUp.springify()
                .damping(TIMING.springOnboardingReanimated.damping)
                .stiffness(TIMING.springOnboardingReanimated.stiffness)
                .delay(200)}
            style={[styles.card, style]}
        >
            {/* Step label */}
            {showProgress && (
                <Text style={styles.stepLabel}>
                    Step {step} of {totalSteps}
                </Text>
            )}

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Subtitle */}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            {/* Content */}
            <View style={styles.content}>{children}</View>

            {/* Progress dots footer */}
            {showProgress && (
                <View style={styles.dotsContainer}>
                    <ProgressDots current={(step ?? 1) - 1} total={totalSteps ?? 0} />
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        ...GLASS_STYLE.hudDark,
        borderRadius: RADIUS.lg,
        borderColor: COLORS.goldGlow,
        backgroundColor: COLORS.hudGlassStrong,
        padding: SPACING.lg,
        gap: SPACING.sm,
    },
    stepLabel: {
        ...TEXT.caption,
        color: COLORS.goldLight,
        textAlign: "center",
    },
    title: {
        ...TEXT.headingLg,
        color: COLORS.textOnDark,
        textAlign: "center",
    },
    subtitle: {
        ...TEXT.bodySm,
        color: COLORS.textMuted,
        textAlign: "center",
    },
    content: {
        marginTop: SPACING.xs,
    },
    dotsContainer: {
        marginTop: SPACING.sm,
        alignItems: "center",
    },
});

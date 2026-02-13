import React from "react";
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, TEXT } from "@/constants/theme";

interface ScreenLayoutProps {
    /** Screen title (large heading) */
    title: string;
    /** Optional subtitle below the title */
    subtitle?: string;
    /** Screen content */
    children: React.ReactNode;
    /** Pull-to-refresh callback */
    onRefresh?: () => void;
    /** Whether refresh is in progress */
    refreshing?: boolean;
    /** Whether to use scroll view (default: true) */
    scrollable?: boolean;
}

/**
 * Standard screen wrapper — handles safe area, scroll, title, and pull-to-refresh.
 * Use this for all screens that are NOT the tower 3D view.
 *
 * @example
 * ```tsx
 * export default function MyBlocksScreen() {
 *   return (
 *     <ScreenLayout title="My Blocks" subtitle="3 blocks • Day 7 streak">
 *       <Card>...</Card>
 *       <Card>...</Card>
 *     </ScreenLayout>
 *   );
 * }
 * ```
 */
export default function ScreenLayout({
    title,
    subtitle,
    children,
    onRefresh,
    refreshing = false,
    scrollable = true,
}: ScreenLayoutProps) {
    const insets = useSafeAreaInsets();

    const content = (
        <>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.body}>{children}</View>
        </>
    );

    if (!scrollable) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        paddingTop: insets.top + SPACING.md,
                        paddingBottom: insets.bottom + SPACING.md,
                    },
                ]}
            >
                {content}
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[
                styles.scrollContent,
                {
                    paddingTop: insets.top + SPACING.md,
                    paddingBottom: insets.bottom + SPACING.xxl,
                },
            ]}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.gold}
                        colors={[COLORS.gold]}
                    />
                ) : undefined
            }
            showsVerticalScrollIndicator={false}
        >
            {content}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    scrollContent: {
        paddingHorizontal: SPACING.md,
    },
    title: {
        ...TEXT.displayLg,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TEXT.bodySm,
        marginBottom: SPACING.lg,
    },
    body: {
        gap: SPACING.md,
    },
});

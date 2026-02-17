import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, BLUR, GLASS_STYLE, SHADOW } from "@/constants/theme";

// Safe BlurView import — falls back when native module isn't compiled
let BlurViewComponent: any = null;
try {
  BlurViewComponent = require("expo-blur").BlurView;
} catch {
  // Native module not available
}

/**
 * Tab navigator — 3 tabs: Tower (3D view), Board (leaderboard), Me (profile).
 *
 * Liquid glass tab bar with real blur (one of only 2 places we keep blur).
 * Specular edge highlight via top border + inset shadow.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          ...styles.tabBar,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom, 8),
        },
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            {BlurViewComponent ? (
              <BlurViewComponent
                tint={BLUR.tint}
                intensity={BLUR.intensity}
                experimentalBlurMethod={BLUR.androidMethod}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUR.fallbackBg }]} />
            )}
            {/* Glass tint overlay */}
            <View style={[StyleSheet.absoluteFill, styles.tabBarTint]} />
            {/* Specular top-edge highlight — the liquid glass "lip" */}
            <View style={styles.specularEdge} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tower",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Text style={[styles.tabIcon, { color }]}>🗼</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="blocks"
        options={{
          title: "Board",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Text style={[styles.tabIcon, { color }]}>🏆</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Text style={[styles.tabIcon, { color }]}>👤</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 6,
  },
  tabBarTint: {
    backgroundColor: COLORS.glass,
  },
  specularEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.glassHighlight,
  },
  tabItem: {
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.bodySemibold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabIcon: {
    fontSize: 22,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerActive: {
    backgroundColor: COLORS.goldSubtle,
  },
});

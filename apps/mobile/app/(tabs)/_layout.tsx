import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONT_FAMILY, SPACING, RADIUS } from "@/constants/theme";

/**
 * Tab navigator — 3 tabs: Tower (3D view), Board (leaderboard), Me (profile).
 *
 * Safe-area aware: accounts for the system gesture bar / home indicator
 * so tabs never sit underneath the system UI on Seeker or any notched device.
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
          // Add bottom safe area so tabs sit above the gesture bar
          paddingBottom: Math.max(insets.bottom, 8),
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarItemStyle: styles.tabItem,
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
    backgroundColor: COLORS.bgCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 6,
    // Shadow for elevation
    ...Platform.select({
      ios: {
        shadowColor: "#1A1612",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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

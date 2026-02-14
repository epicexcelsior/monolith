import { Tabs } from "expo-router";
import { Text, StyleSheet } from "react-native";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

/**
 * Tab navigator — 3 tabs: Tower (3D view), Board (leaderboard), Me (profile + settings).
 * Uses the solarpunk design system with gold accents on cream backgrounds.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tower",
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>🗼</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="blocks"
        options={{
          title: "Board",
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>🏆</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>👤</Text>
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
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.bodySemibold,
    letterSpacing: 0.5,
  },
  tabIcon: {
    fontSize: 22,
  },
});

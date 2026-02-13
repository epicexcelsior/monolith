import { Tabs } from "expo-router";
import { Text, StyleSheet } from "react-native";

/**
 * Tab navigator — 3 tabs: Tower (3D view), Blocks (portfolio), Settings.
 * Uses a dark cyberpunk aesthetic with neon accents.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#00ffff",
        tabBarInactiveTintColor: "#666680",
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
          title: "Vault",
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>🏦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0d0d15",
    borderTopColor: "#1a1a2e",
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tabIcon: {
    fontSize: 22,
  },
});

import { Tabs } from "expo-router";

/**
 * Tab navigator — 3 tabs: Tower (3D view), Board (leaderboard), Me (profile).
 *
 * Tab bar is hidden — replaced by FloatingNav pills on the tower screen.
 * Board and Me content are shown as bottom sheets over the tower.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — replaced by FloatingNav on tower screen
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tower" }} />
      <Tabs.Screen name="blocks" options={{ title: "Board" }} />
      <Tabs.Screen name="settings" options={{ title: "Me" }} />
    </Tabs>
  );
}

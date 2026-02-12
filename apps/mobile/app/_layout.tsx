import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useAuthorization } from "@/hooks/useAuthorization";

// Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Root layout — wraps the entire app with providers and handles
 * wallet state hydration on boot.
 *
 * On mount:
 * 1. Checks expo-secure-store for cached MWA auth
 * 2. If found (and user has completed onboarding), restores wallet state
 * 3. User appears "connected" immediately without re-prompting
 *
 * This follows the official auth caching pattern:
 * https://docs.solanamobile.com/react-native/storing_mwa_auth
 */
export default function RootLayout() {
  const { hydrateCachedAuth } = useAuthorization();

  useEffect(() => {
    async function bootstrap() {
      try {
        // Hydrate wallet state from secure store
        // skipIfFirstLaunch=true → new users won't see "connected" state
        await hydrateCachedAuth(true);
      } catch (err) {
        // Non-fatal — user will just see "not connected" state
        console.warn("Wallet hydration failed:", err);
      } finally {
        // Hide splash screen after wallet state is resolved
        await SplashScreen.hideAsync();
      }
    }

    bootstrap();
  }, [hydrateCachedAuth]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0f" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="connect"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
});

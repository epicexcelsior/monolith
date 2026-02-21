import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { useAuthorization } from "@/hooks/useAuthorization";
import ErrorBoundary from "@/components/ErrorBoundary";
import { COLORS } from "@/constants/theme";

// Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Root layout — wraps the entire app with providers and handles
 * wallet state hydration on boot.
 *
 * On mount:
 * 1. Loads all Google Fonts (Outfit, Inter, JetBrains Mono)
 * 2. Checks expo-secure-store for cached MWA auth
 * 3. If found (and user has completed onboarding), restores wallet state
 * 4. Hides splash screen once fonts are loaded
 *
 * This follows the official auth caching pattern:
 * https://docs.solanamobile.com/react-native/storing_mwa_auth
 */
export default function RootLayout() {
  const { hydrateCachedAuth } = useAuthorization();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    async function bootstrap() {
      try {
        // Hydrate wallet state from secure store
        // skipIfFirstLaunch=true → new users won't see "connected" state
        await hydrateCachedAuth(true);
      } catch (err) {
        // Non-fatal — user will just see "not connected" state
        console.warn("Wallet hydration failed:", err);
      }
    }
    bootstrap();
  }, [hydrateCachedAuth]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
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
        <Stack.Screen
          name="deposit"
          options={{
            presentation: "formSheet",
            animation: "slide_from_bottom",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: COLORS.glassElevated },
          }}
        />
        <Stack.Screen
          name="faucet"
          options={{
            presentation: "formSheet",
            animation: "slide_from_bottom",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: COLORS.glassElevated },
          }}
        />
        <Stack.Screen
          name="withdraw"
          options={{
            presentation: "formSheet",
            animation: "slide_from_bottom",
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: COLORS.glassElevated },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns null if permission denied or unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.log("[Notifications] Permission not granted");
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "d8909ef0-36b3-4c65-aa05-467a3fba6444",
    });

    if (typeof __DEV__ !== "undefined" && __DEV__) console.log("[Notifications] Token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    // FCM not initialized is expected in dev builds without google-services.json
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("FirebaseApp") || msg.includes("FCM")) {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.log("[Notifications] Skipped — FCM not configured (expected in dev)");
    } else {
      console.warn("[Notifications] Registration failed:", msg);
    }
    return null;
  }
}

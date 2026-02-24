/**
 * Tests for mobile push notification registration.
 */

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

import * as Notifications from "expo-notifications";
import { registerForPushNotifications } from "../../utils/notifications";

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;

describe("registerForPushNotifications", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns token when permission already granted", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    mockGetToken.mockResolvedValue({ data: "ExponentPushToken[test-token]" });

    const token = await registerForPushNotifications();

    expect(token).toBe("ExponentPushToken[test-token]");
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it("requests permissions if not granted, returns token on success", async () => {
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockRequestPermissions.mockResolvedValue({ status: "granted" });
    mockGetToken.mockResolvedValue({ data: "ExponentPushToken[test-token-2]" });

    const token = await registerForPushNotifications();

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(token).toBe("ExponentPushToken[test-token-2]");
  });

  it("returns null when permission denied", async () => {
    mockGetPermissions.mockResolvedValue({ status: "denied" });
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });

  it("returns null when permission request is denied", async () => {
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("handles errors gracefully and returns null", async () => {
    mockGetPermissions.mockRejectedValue(new Error("Permission check failed"));

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });

  it("handles token fetch errors and returns null", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    mockGetToken.mockRejectedValue(new Error("Token fetch failed"));

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });
});

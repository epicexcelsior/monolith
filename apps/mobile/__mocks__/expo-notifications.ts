/**
 * Jest manual mock for expo-notifications.
 * Prevents native module loading issues in Jest environment.
 */

const setNotificationHandler = jest.fn();
const getPermissionsAsync = jest.fn().mockResolvedValue({ status: "undetermined" });
const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: "denied" });
const getExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: null });
const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const removeNotificationSubscription = jest.fn();
const scheduleNotificationAsync = jest.fn();
const cancelScheduledNotificationAsync = jest.fn();
const cancelAllScheduledNotificationsAsync = jest.fn();

export {
  setNotificationHandler,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  addNotificationResponseReceivedListener,
  addNotificationReceivedListener,
  removeNotificationSubscription,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
};

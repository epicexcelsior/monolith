// Polyfills MUST be imported before anything else
import "react-native-get-random-values";
import { Buffer } from "buffer";
global.Buffer = Buffer;

// Now import the app entry
import "expo-router/entry";

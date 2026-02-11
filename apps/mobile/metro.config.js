// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for Solana web3.js and other Node.js libraries in React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve("expo-crypto"),
  stream: require.resolve("readable-stream"),
  buffer: require.resolve("buffer"),
};

// Watch the monorepo packages
config.watchFolders = [
  require("path").resolve(__dirname, "../../packages/common"),
];

module.exports = config;

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Monorepo root — works both locally and on EAS Build
const monorepoRoot = path.resolve(__dirname, "../..");

// Required for Solana web3.js and other Node.js libraries in React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve("expo-crypto"),
  stream: require.resolve("readable-stream"),
  buffer: require.resolve("buffer"),
};

// Watch the monorepo packages so Metro picks up changes
config.watchFolders = [path.resolve(monorepoRoot, "packages/common")];

// With hoisted node_modules, ensure Metro can find deps at the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(__dirname, "node_modules"),
];

module.exports = config;

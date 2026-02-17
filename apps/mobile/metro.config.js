// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Monorepo root — works both locally and on EAS Build
const monorepoRoot = path.resolve(__dirname, "../..");

// Shims for Node-only deps used by colyseus.js
const shimsDir = path.resolve(__dirname, "shims");
const moduleShims = {
  httpie: path.resolve(shimsDir, "httpie.js"),
  ws: path.resolve(shimsDir, "ws.js"),
};

// Required for Solana web3.js and other Node.js libraries in React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve("expo-crypto"),
  stream: require.resolve("readable-stream"),
  buffer: require.resolve("buffer"),
  three: path.resolve(monorepoRoot, "node_modules/three"),
  ...moduleShims,
};

// Custom resolver: intercept imports of shimmed modules regardless of origin
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleShims[moduleName]) {
    return {
      filePath: moduleShims[moduleName],
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Watch the monorepo packages so Metro picks up changes
config.watchFolders = [path.resolve(monorepoRoot, "packages/common")];

// With hoisted node_modules, ensure Metro can find deps at the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(__dirname, "node_modules"),
];

module.exports = config;

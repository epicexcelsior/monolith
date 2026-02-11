module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./",
            "@monolith/common": "../../packages/common/src",
          },
        },
      ],
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};

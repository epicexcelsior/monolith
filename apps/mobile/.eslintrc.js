module.exports = {
  extends: ["expo"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    // Relax some rules for development
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off", // Allow console.log in mobile dev
  },
};

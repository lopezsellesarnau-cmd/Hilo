// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions are Deno code, checked by Supabase when they deploy
    ignores: ["dist/*", "supabase/functions/*"],
  }
]);

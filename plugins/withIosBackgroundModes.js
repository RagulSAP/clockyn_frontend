/**
 * Expo config plugin — removes iOS `UIBackgroundModes` entries that the app does not use.
 *
 * `expo-task-manager`'s own config plugin always adds `fetch`. Clockyn only uses TaskManager for the Android
 * background-location task (iOS never starts it: background tracking is Android-only) and registers no
 * background-fetch task, so `fetch` is dropped. `location` is never added either (see app.config.ts).
 */
const { withInfoPlist } = require('expo/config-plugins');

const UNUSED_MODES = new Set(['fetch', 'location', 'processing']);

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withIosBackgroundModes = (config) =>
  withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const kept = modes.filter((m) => !UNUSED_MODES.has(m));
      if (kept.length > 0) cfg.modResults.UIBackgroundModes = kept;
      else delete cfg.modResults.UIBackgroundModes;
    }
    return cfg;
  });

module.exports = withIosBackgroundModes;

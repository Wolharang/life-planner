// Makes MainActivity (the RN host) show OVER the lock screen and wake the screen, so the alarm's
// full-screen intent can render the RN execution moment (/execution) without unlocking
// (architecture §4). app.json can't set these attributes on MainActivity, so we patch the manifest.
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withExecutionLockScreen(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const mainActivity = app?.activity?.find((a) => a.$["android:name"] === ".MainActivity");
    if (mainActivity) {
      mainActivity.$["android:showWhenLocked"] = "true";
      mainActivity.$["android:turnScreenOn"] = "true";
    }
    return cfg;
  });
};

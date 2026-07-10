module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4 via jsxImportSource: routes JSX to nativewind/jsx-runtime
      // (= react-native-css-interop/jsx-runtime), which applies className styling.
      // The Tailwind CSS itself is compiled by withNativeWind in metro.config.js.
      //
      // Do NOT add the "nativewind/babel" preset here. On this SDK 52 / Reanimated 3
      // stack it pulls react-native-css-interop@0.2.6's babel.js, which unconditionally
      // requires "react-native-worklets/plugin" (Reanimated 4 only — not installed),
      // so the bundle fails with "Cannot find module 'react-native-worklets/plugin'".
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    // No manual reanimated plugin: babel-preset-expo auto-adds react-native-reanimated/plugin
    // when reanimated is installed, and reanimated 3.16 needs no worklets package.
  };
};

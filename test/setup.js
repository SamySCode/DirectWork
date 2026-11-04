// Runs before every test file.

// lib/env.ts validates these at import time.
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// expo-image is a native view; a plain View is enough to assert it rendered.
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props) => require("react").createElement(View, { ...props, testID: "expo-image" }),
  };
});

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: (props) => require("react").createElement(View, props) };
});

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// Icon fonts load asynchronously and trigger act() warnings; tests only care
// that an icon was rendered, not how it looks.
jest.mock("@expo/vector-icons/Ionicons", () => {
  const { Text } = require("react-native");
  const Icon = ({ name }) => require("react").createElement(Text, { testID: `icon-${name}` });
  return { __esModule: true, default: Icon };
});

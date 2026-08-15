import { Platform } from "react-native";

// The native animated module only exists on iOS/Android - on web, Animated
// always runs on the JS thread regardless, so requesting the native driver
// there just produces a console warning for no benefit.
export const nativeDriverEnabled = Platform.OS !== "web";

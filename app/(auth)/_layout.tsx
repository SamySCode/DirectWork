import { Stack } from "expo-router";
import { colors, typography } from "../../lib/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.onInk,
        headerTitleStyle: { fontFamily: typography.displayFontFamily },
        headerShadowVisible: false,
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      {/* Empty header titles: each card already says where you are. */}
      <Stack.Screen name="sign-in" options={{ title: "Sign in", headerTitle: "" }} />
      <Stack.Screen name="sign-up" options={{ title: "Create account", headerTitle: "" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Reset password", headerTitle: "" }} />
    </Stack>
  );
}

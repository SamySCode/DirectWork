import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { SessionProvider, useAuth } from "../features/auth/SessionProvider";
import { useProtectedRoute } from "../features/auth/hooks";
import { colors } from "../lib/theme";

function RootNavigator() {
  const { session, loading } = useAuth();
  useProtectedRoute(session, loading);

  if (loading) {
    return <AppLoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

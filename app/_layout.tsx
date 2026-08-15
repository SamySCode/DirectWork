import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoadingState } from "../components/LoadingState";
import { useProtectedRoute, useSession } from "../features/auth/hooks";
import { colors } from "../lib/theme";

export default function RootLayout() {
  const { session, loading } = useSession();
  useProtectedRoute(session, loading);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {loading ? (
        <LoadingState />
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}

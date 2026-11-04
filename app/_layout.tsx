import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundaryProps, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Appearance, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { ErrorState } from "../components/ErrorState";
import { SessionProvider, useAuth } from "../features/auth/SessionProvider";
import { useProtectedRoute } from "../features/auth/hooks";
import { useProfile } from "../features/profile/hooks";
import { installWebFocusStyles } from "../lib/accessibility";
import { useAppFonts } from "../lib/fonts";
import { errorMessage } from "../lib/functions";
import { queryClient } from "../lib/query";
import { colors, colorScheme, typography } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Expo Router renders this instead of a white screen if any route throws.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorState
      title="Something broke on this screen"
      description={errorMessage(error)}
      onRetry={retry}
    />
  );
}

function RootNavigator() {
  const { session, loading: sessionLoading } = useAuth();
  const { loaded: fontsLoaded } = useAppFonts();
  const profile = useProfile(session?.user.id);
  const hasProfile = !session ? false : profile.isSuccess ? !!profile.data : undefined;

  // Boot once. After that the Stack stays mounted for good: remounting it
  // (e.g. while a fresh sign-in's profile loads) would reset navigation to
  // the initial route and lose screens like update-password mid-flow.
  const ready = fontsLoaded && !sessionLoading && (!session || hasProfile !== undefined);
  const booted = useRef(false);
  if (ready) booted.current = true;
  useProtectedRoute(session, !booted.current, hasProfile);

  useEffect(() => {
    if (booted.current) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!booted.current) {
    return profile.isError ? (
      <ErrorState
        title="Couldn't load your profile"
        description={errorMessage(profile.error)}
        onRetry={() => profile.refetch()}
      />
    ) : (
      <AppLoadingScreen />
    );
  }

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: typography.displayFontFamily },
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="listing/new"
          options={{ title: "New listing", presentation: "modal" }}
        />
        <Stack.Screen name="listing/[id]/index" options={{ title: "Listing" }} />
        <Stack.Screen name="listing/[id]/edit" options={{ title: "Edit listing" }} />
        <Stack.Screen name="application/[id]" options={{ title: "Application" }} />
        <Stack.Screen name="people/[id]" options={{ title: "Profile" }} />
        <Stack.Screen name="account/edit" options={{ title: "Edit profile" }} />
        <Stack.Screen name="account/delete" options={{ title: "Delete account" }} />
        <Stack.Screen name="account/blocked" options={{ title: "Blocked people" }} />
        <Stack.Screen name="billing" options={{ title: "Plans" }} />
        <Stack.Screen name="guide" options={{ title: "Guide & tips" }} />
        <Stack.Screen name="inbox" options={{ title: "Activity" }} />
        <Stack.Screen name="moderation" options={{ title: "Reports" }} />
        <Stack.Screen name="review" options={{ title: "Review queue" }} />
        <Stack.Screen name="update-password" options={{ title: "New password" }} />
      </Stack>
      {session && hasProfile === undefined ? (
        <View style={StyleSheet.absoluteFill}>
          {profile.isError ? (
            <ErrorState
              title="Couldn't load your profile"
              description={errorMessage(profile.error)}
              onRetry={() => profile.refetch()}
            />
          ) : (
            <AppLoadingScreen />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});

// The palette is fixed at launch (lib/theme.ts). On web, follow a system
// theme change straight away with a reload; native picks it up next launch.
function useReloadOnThemeChangeOnWeb() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const subscription = Appearance.addChangeListener(({ colorScheme: next }) => {
      if ((next === "dark" ? "dark" : "light") !== colorScheme) window.location.reload();
    });
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  useReloadOnThemeChangeOnWeb();
  useEffect(installWebFocusStyles, []);
  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

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
import { useLegalStatus } from "../features/legal/hooks";
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
  // Based on data, not status: a failed background refresh keeps the cached
  // profile, so it mustn't bounce anyone back to onboarding or a spinner (F9).
  const hasProfile = !session ? false : profile.data !== undefined ? !!profile.data : undefined;
  // Terms/Privacy re-acceptance (fetched once per sign-in). A failed check
  // counts as "settled, no gate" so a network error never locks anyone out.
  const legal = useLegalStatus(session?.user.id);
  const needsAcceptance = legal.isSuccess ? legal.data : undefined;
  const legalSettled = !session || !legal.isPending;

  // Boot once. After that the Stack stays mounted for good: remounting it
  // (e.g. while a fresh sign-in's profile loads) would reset navigation to
  // the initial route and lose screens like update-password mid-flow.
  const ready =
    fontsLoaded && !sessionLoading && (!session || (hasProfile !== undefined && legalSettled));
  const booted = useRef(false);
  if (ready) booted.current = true;
  useProtectedRoute(session, !booted.current, hasProfile, needsAcceptance);

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
        <Stack.Screen name="deal/[id]" options={{ title: "Deal Sheet" }} />
        <Stack.Screen name="people/[id]" options={{ title: "Profile" }} />
        <Stack.Screen name="account/edit" options={{ title: "Edit profile" }} />
        <Stack.Screen name="account/delete" options={{ title: "Delete account" }} />
        <Stack.Screen name="account/blocked" options={{ title: "Blocked people" }} />
        <Stack.Screen name="billing" options={{ title: "Plans" }} />
        <Stack.Screen name="guide" options={{ title: "Guide & tips" }} />
        <Stack.Screen name="inbox" options={{ title: "Activity" }} />
        <Stack.Screen name="moderation" options={{ title: "Moderation" }} />
        <Stack.Screen name="review" options={{ title: "Review queue" }} />
        <Stack.Screen name="update-password" options={{ title: "New password" }} />
        <Stack.Screen name="help" options={{ title: "Help & legal" }} />
        <Stack.Screen name="legal/index" options={{ title: "Legal" }} />
        <Stack.Screen name="legal/[doc]" options={{ title: "" }} />
        <Stack.Screen
          name="legal/accept"
          options={{ title: "Updated terms", headerBackVisible: false, gestureEnabled: false }}
        />
      </Stack>
      {session && (hasProfile === undefined || !legalSettled) ? (
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

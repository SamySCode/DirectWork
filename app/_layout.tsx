import Ionicons from "@expo/vector-icons/Ionicons";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  ErrorBoundaryProps,
  Stack,
  useGlobalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Appearance, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { ErrorState } from "../components/ErrorState";
import { OfflineBanner } from "../components/OfflineBanner";
import { Text } from "../components/Text";
import { ToastHost } from "../components/Toast";
import { SessionProvider, useAuth } from "../features/auth/SessionProvider";
import { useProtectedRoute } from "../features/auth/hooks";
import { useSigningOut } from "../features/auth/signingOut";
import { useLegalStatus } from "../features/legal/hooks";
import { useListingTitle } from "../features/listings/hooks";
import { useProfile } from "../features/profile/hooks";
import { installWebFocusStyles } from "../lib/accessibility";
import { loadHapticsPreference } from "../lib/haptics";
import { installHistoryGate } from "../lib/historyGate";
import { useDocumentTitle } from "../lib/documentTitle";
import { useAppFonts } from "../lib/fonts";
import { errorMessage } from "../lib/functions";
import { queryClient } from "../lib/query";
import { colors, colorScheme, minTouchTarget, spacing, typography } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Before the router mounts, so it sees browser back/forward steps first
// (forms with unsaved changes can then hold them: lib/historyGate.ts).
installHistoryGate();
// Whether this person turned vibration off on this phone (lib/haptics.ts).
void loadHapticsPreference();

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

/**
 * Shown in a screen's header when there is nothing to go back to: someone
 * opened a link straight to a listing or profile (or reloaded the page), so
 * the stack holds only that screen. Without it they'd have no way into the
 * rest of the app, since detail screens have no tab bar.
 */
function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace("/home")}
      accessibilityRole="link"
      accessibilityLabel="Go to Home"
      hitSlop={8}
      style={styles.homeButton}
    >
      <Ionicons name="chevron-back" size={20} color={colors.accent} />
      <Text style={styles.homeLabel}>Home</Text>
    </Pressable>
  );
}

function RootNavigator() {
  const { session, loading: sessionLoading } = useAuth();
  const { loaded: fontsLoaded } = useAppFonts();
  const signingOut = useSigningOut();
  // Browser tab title: the listing's own title on a listing page, the
  // screen's name everywhere else.
  const segments = useSegments();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const onListing = segments[0] === "listing" && segments[1] === "[id]";
  useDocumentTitle(segments, useListingTitle(onListing ? id : undefined));
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
        screenOptions={({ navigation }) => ({
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: typography.displayFontFamily },
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: colors.background },
          // Only when there's no back button to replace.
          ...(navigation.canGoBack() ? {} : { headerLeft: () => <HomeButton /> }),
        })}
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
      <OfflineBanner />
      <ToastHost />
      {signingOut ? (
        <View style={StyleSheet.absoluteFill}>
          <AppLoadingScreen label="Signing out" />
        </View>
      ) : null}
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
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: minTouchTarget,
    paddingRight: spacing.md,
  },
  homeLabel: {
    fontSize: typography.size.md,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
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

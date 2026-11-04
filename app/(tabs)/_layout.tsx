import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIncomingPending } from "../../features/applications/hooks";
import { colors, tabThemes, typography } from "../../lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={22} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  // Badge the Listings tab when applicants are waiting - the main thing an
  // owner needs to act on, without push notifications (deferred to Phase 3).
  const { data: pending } = useIncomingPending();
  const insets = useSafeAreaInsets();
  const pendingCount = pending?.length ?? 0;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        // Sized from its parts, not React Navigation's 49pt default (which
        // assumes the native system font and squashed the labels to ~7px on
        // web): each item is 5+5 padding + 28 icon box + 14 label = 52, so the
        // bar is 6 top padding + 58 content + the bottom safe-area inset
        // (home indicator), minimum 8.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 6 + 58 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: typography.weight.semibold,
        },
        // Tab labels are short and fixed; let them grow with system text size,
        // but not so far that they wrap and overlap the icons.
        tabBarAllowFontScaling: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: typography.displayFontFamily, fontSize: 22 },
        headerTitleAlign: "left",
        // Every tab renders its own PageHero.
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarActiveTintColor: tabThemes.home.tint,
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="discover/index"
        options={{
          title: "Discover",
          tabBarActiveTintColor: tabThemes.discover.tint,
          tabBarIcon: tabIcon("compass", "compass-outline"),
        }}
      />
      <Tabs.Screen
        name="applications/index"
        options={{
          title: "Applied",
          tabBarActiveTintColor: tabThemes.applications.tint,
          tabBarIcon: tabIcon("paper-plane", "paper-plane-outline"),
        }}
      />
      <Tabs.Screen
        name="listings/index"
        options={{
          title: "Listings",
          tabBarActiveTintColor: tabThemes.listings.tint,
          tabBarIcon: tabIcon("layers", "layers-outline"),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: tabThemes.listings.tint, fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarActiveTintColor: tabThemes.profile.tint,
          tabBarIcon: tabIcon("person", "person-outline"),
        }}
      />
    </Tabs>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, radius, typography } from "../../../lib/theme";
import { useUnreadCount } from "../hooks";

/** Bell for the gradient hero: opens the inbox, badged with the unread count. */
export function InboxButton() {
  const router = useRouter();
  const unread = useUnreadCount().data ?? 0;
  const label = unread > 0 ? `Activity, ${unread} new` : "Activity";
  return (
    <Pressable
      onPress={() => router.push("/inbox")}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={unread > 0 ? "notifications" : "notifications-outline"}
        size={20}
        color={colors.onInk}
      />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    // Fixed: the badge always sits on the dark hero, in both themes.
    color: "#16133D",
  },
});

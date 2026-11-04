import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { colors, typography } from "../lib/theme";
import { Text } from "./Text";

const palette = ["#5B4CF0", "#2E2690", "#0B7A59", "#B86E00", "#C2417A", "#2563A8"];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

type AvatarProps = {
  name: string;
  /** Profile photo URL; falls back to coloured initials when absent or loading. */
  uri?: string | null;
  size?: number;
};

export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const backgroundColor = palette[hash(name) % palette.length] ?? colors.accent;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { width: size, height: size, backgroundColor }]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    // White in both themes: initials always sit on a saturated colour.
    color: colors.onInk,
    fontFamily: typography.displayFontFamily,
    fontWeight: typography.weight.bold,
  },
});

import { StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import { ConnectMark } from "./ConnectMark";
import { Text } from "./Text";

type WordmarkProps = {
  tone?: "dark" | "light";
  size?: "md" | "lg";
};

export function Wordmark({ tone = "dark", size = "lg" }: WordmarkProps) {
  const fontSize = size === "lg" ? typography.size.xxl : typography.size.lg;
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="DirectWork">
      <ConnectMark size={fontSize * 0.9} tone={tone} />
      <Text
        style={[
          styles.brand,
          { fontSize, color: tone === "dark" ? colors.textPrimary : colors.onInk },
        ]}
      >
        DirectWork
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brand: {
    fontFamily: typography.displayFontFamily,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
});

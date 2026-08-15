import { StyleSheet } from "react-native";
import { colors, typography } from "../lib/theme";
import { Text } from "./Text";

export function Wordmark() {
  return <Text style={styles.brand}>DirectWork</Text>;
}

const styles = StyleSheet.create({
  brand: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
});

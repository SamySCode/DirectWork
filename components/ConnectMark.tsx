import { StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

type ConnectMarkProps = {
  size?: number;
  /** Lit = both nodes mint: the "match made" state. */
  lit?: boolean;
  tone?: "dark" | "light";
};

// The brand's signature: two nodes joined directly by a line - an owner and
// a professional, no middleman. Built from Views so it needs no SVG dependency.
export function ConnectMark({ size = 28, lit = false, tone = "dark" }: ConnectMarkProps) {
  const node = size * 0.36;
  const lineHeight = Math.max(2, size * 0.1);
  const base = tone === "dark" ? colors.accent : colors.onInk;
  const right = lit ? colors.mint : base;
  const left = lit ? colors.mint : tone === "dark" ? colors.textPrimary : colors.onInkMuted;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { width: size * 1.5, height: node }]}
    >
      <View
        style={[
          styles.line,
          { height: lineHeight, left: node / 2, right: node / 2, backgroundColor: right },
        ]}
      />
      <View style={[styles.node, { width: node, height: node, backgroundColor: left }]} />
      <View style={[styles.node, { width: node, height: node, backgroundColor: right }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  line: {
    position: "absolute",
    borderRadius: 999,
  },
  node: {
    borderRadius: 999,
  },
});

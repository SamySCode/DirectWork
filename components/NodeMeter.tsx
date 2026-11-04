import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";
import { Text } from "./Text";

type NodeMeterProps = {
  /** One node per item; filled nodes come first. */
  total: number;
  lit: number;
  /** Lit colour - mint by default ("it's a match"). */
  color?: string;
  size?: number;
  /** Collapse anything beyond this into "+N" so long lists stay one line. */
  max?: number;
  /** Required for screen readers, e.g. "3 of 4 skills match". */
  accessibilityLabel: string;
};

// The ConnectMark stretched into a meter: nodes joined by a line, lit as
// they're satisfied. Every visualisation in the app uses this one shape, so
// "a lit chain" always means "progress / fit" wherever it appears. Plain
// Views - no SVG or chart library, nothing to load, cheap to render in lists.
function NodeMeterBase({
  total,
  lit,
  color = colors.mint,
  size = 10,
  max = 10,
  accessibilityLabel,
}: NodeMeterProps) {
  const shown = Math.min(total, max);
  const litShown = Math.min(lit, shown);
  const overflow = total - shown;
  const line = Math.max(2, Math.round(size / 4));

  if (total <= 0) return null;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: Math.min(lit, total) }}
    >
      {Array.from({ length: shown }, (_, index) => {
        const isLit = index < litShown;
        return (
          <View key={index} style={styles.row}>
            {index > 0 ? (
              <View
                style={{
                  width: size * 0.8,
                  height: line,
                  backgroundColor: isLit ? color : colors.border,
                }}
              />
            ) : null}
            <View
              style={[
                styles.node,
                {
                  width: size,
                  height: size,
                  borderWidth: Math.max(1.5, size / 6),
                  borderColor: isLit ? color : colors.border,
                  backgroundColor: isLit ? color : colors.surface,
                },
              ]}
            />
          </View>
        );
      })}
      {overflow > 0 ? <Text style={styles.overflow}>+{overflow}</Text> : null}
    </View>
  );
}

export const NodeMeter = memo(NodeMeterBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  node: {
    borderRadius: 999,
  },
  overflow: {
    marginLeft: 6,
    fontSize: 11,
    color: colors.textMuted,
  },
});

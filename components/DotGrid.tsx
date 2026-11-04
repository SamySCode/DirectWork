import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

type DotGridProps = {
  /** How many of the 100 dots to light. */
  value: number;
  color?: string;
  dimColor?: string;
  size?: number;
  accessibilityLabel: string;
};

// "N in 100" as 100 dots: the way people actually grasp a percentage. It's
// the NodeMeter idea scaled up - unjoined nodes, a crowd rather than a chain.
// Plain Views; 100 tiny ones render instantly and never re-render (memo).
function DotGridBase({
  value,
  color = colors.accent,
  dimColor = colors.border,
  size = 8,
  accessibilityLabel,
}: DotGridProps) {
  const lit = Math.max(0, Math.min(100, Math.round(value)));
  const gap = Math.max(2, Math.round(size / 3));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.grid, { width: size * 10 + gap * 9, gap }]}
    >
      {Array.from({ length: 100 }, (_, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: index < lit ? color : dimColor,
          }}
        />
      ))}
    </View>
  );
}

export const DotGrid = memo(DotGridBase);

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

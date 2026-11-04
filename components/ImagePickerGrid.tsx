import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

export type GridImage = { key: string; uri: string };

type ImagePickerGridProps = {
  label: string;
  images: GridImage[];
  max: number;
  onAdd: () => void;
  onRemove: (key: string) => void;
  hint?: string;
  error?: string | null;
  busy?: boolean;
  disabled?: boolean;
};

// Presentation only - picking, validation and upload live in lib/images.ts
// and the owning feature, so this works for any image list.
export function ImagePickerGrid({
  label,
  images,
  max,
  onAdd,
  onRemove,
  hint,
  error,
  busy = false,
  disabled = false,
}: ImagePickerGridProps) {
  const canAdd = images.length < max && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.count}>
          {images.length} / {max}
        </Text>
      </View>
      <View style={styles.grid}>
        {images.map((image) => (
          <View key={image.key} style={styles.tile}>
            <Image source={{ uri: image.uri }} style={styles.image} contentFit="cover" />
            {!disabled ? (
              <Pressable
                onPress={() => onRemove(image.key)}
                accessibilityRole="button"
                accessibilityLabel="Remove image"
                hitSlop={11}
                style={styles.remove}
              >
                <Ionicons name="close" size={14} color={colors.onInk} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {canAdd ? (
          <Pressable
            onPress={onAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add image to ${label}`}
            style={[styles.tile, styles.add]}
          >
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="image-outline" size={22} color={colors.accent} />
                <Text style={styles.addText}>Add</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const TILE = 88;

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  count: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,19,61,0.75)",
  },
  add: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  addText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
});

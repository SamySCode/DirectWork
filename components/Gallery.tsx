import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
import { Text } from "./Text";

export type GalleryImage = { key: string; uri: string; caption?: string | null };

type GalleryProps = {
  images: GalleryImage[];
  /** Tile height; width follows a 4:3 frame. */
  height?: number;
};

/** Horizontal strip of images; tap one to view it full screen. */
export function Gallery({ images, height = 150 }: GalleryProps) {
  const [open, setOpen] = useState<GalleryImage | null>(null);
  if (images.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {images.map((image) => (
          <Pressable
            key={image.key}
            onPress={() => setOpen(image)}
            accessibilityRole="imagebutton"
            accessibilityLabel={image.caption ?? "View image"}
            style={styles.item}
          >
            <Image
              source={{ uri: image.uri }}
              style={[styles.image, { height, width: height * (4 / 3) }]}
              contentFit="cover"
              transition={150}
            />
            {image.caption ? (
              <Text style={[styles.caption, { width: height * (4 / 3) }]} numberOfLines={1}>
                {image.caption}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.viewer}>
          <Pressable
            onPress={() => setOpen(null)}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            hitSlop={12}
            style={styles.close}
          >
            <Ionicons name="close" size={26} color={colors.onInk} />
          </Pressable>
          {open ? (
            <>
              <Image source={{ uri: open.uri }} style={styles.full} contentFit="contain" />
              {open.caption ? <Text style={styles.fullCaption}>{open.caption}</Text> : null}
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.sm,
  },
  item: {
    gap: spacing.xs,
  },
  image: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  caption: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  viewer: {
    flex: 1,
    backgroundColor: "rgba(22,19,61,0.96)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  close: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.lg,
    zIndex: 1,
  },
  full: {
    width: "100%",
    height: "80%",
  },
  fullCaption: {
    color: colors.onInk,
    textAlign: "center",
    marginTop: spacing.md,
    fontSize: typography.size.md,
  },
});

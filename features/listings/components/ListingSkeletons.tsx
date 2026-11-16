import { StyleSheet, View } from "react-native";
import { Bone, Skeleton, SkeletonCard, SkeletonLines } from "../../../components/Skeleton";
import { radius, spacing } from "../../../lib/theme";

/**
 * The shape of a `ListingCard`. Not a `Skeleton` on its own: wrap a group
 * of these in one, so the whole list pulses together.
 */
export function ListingCardSkeleton() {
  return (
    <SkeletonCard style={styles.card}>
      <View style={styles.topRow}>
        <Bone width={84} height={22} rounded={radius.pill} />
        <Bone width={48} height={10} />
      </View>
      <View style={styles.titleBlock}>
        <Bone width="70%" height={20} />
        <Bone width="50%" />
      </View>
      <SkeletonLines lines={3} />
      <View style={styles.chips}>
        <Bone width={72} height={22} rounded={radius.pill} />
        <Bone width={56} height={22} rounded={radius.pill} />
        <Bone width={88} height={22} rounded={radius.pill} />
      </View>
    </SkeletonCard>
  );
}

/** `count` listing cards, pulsing as one. */
export function ListingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Skeleton label="Loading listings">
      {Array.from({ length: count }, (_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </Skeleton>
  );
}

/** The listing page (`ListingDetailView`) while the listing loads. */
export function ListingDetailSkeleton() {
  return (
    <Skeleton page label="Loading listing">
      <View style={styles.header}>
        <Bone width={84} height={22} rounded={radius.pill} />
        <Bone width="85%" height={28} />
        <View style={styles.owner}>
          <Bone width={40} height={40} rounded={radius.pill} />
          <View style={styles.ownerText}>
            <Bone width="45%" height={14} />
            <Bone width="70%" />
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Bone width="30%" height={10} />
        <SkeletonLines lines={5} lineHeight={23} />
      </View>
      <View style={styles.section}>
        <Bone width="30%" height={10} />
        <View style={styles.chips}>
          <Bone width={80} height={28} rounded={radius.pill} />
          <Bone width={64} height={28} rounded={radius.pill} />
          <Bone width={96} height={28} rounded={radius.pill} />
        </View>
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  // Padding and gap match ListingCard, so the list doesn't jump on arrival.
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  header: {
    gap: spacing.md,
  },
  owner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  ownerText: {
    flex: 1,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
});

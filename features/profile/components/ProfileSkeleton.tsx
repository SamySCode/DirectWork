import { StyleSheet, View } from "react-native";
import { Bone, Skeleton, SkeletonCard, SkeletonLines } from "../../../components/Skeleton";
import { radius, spacing } from "../../../lib/theme";

/** A profile page (`ProfileView`) while the profile loads. */
export function ProfileSkeleton() {
  return (
    <Skeleton page label="Loading profile">
      <SkeletonCard style={styles.header}>
        <Bone width={72} height={72} rounded={radius.pill} />
        <Bone width="50%" height={22} />
        <Bone width="70%" height={14} />
        <View style={styles.chips}>
          <Bone width={120} height={22} rounded={radius.pill} />
          <Bone width={96} height={22} rounded={radius.pill} />
        </View>
      </SkeletonCard>
      <View style={styles.section}>
        <Bone width="25%" height={10} />
        <SkeletonLines lines={4} lineHeight={23} />
      </View>
      <View style={styles.section}>
        <Bone width="25%" height={10} />
        <View style={styles.chips}>
          <Bone width={88} height={28} rounded={radius.pill} />
          <Bone width={64} height={28} rounded={radius.pill} />
          <Bone width={104} height={28} rounded={radius.pill} />
        </View>
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
});

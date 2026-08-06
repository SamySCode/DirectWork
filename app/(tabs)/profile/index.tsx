import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { colors } from "../../../lib/theme";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Profile"
        description="Editing your professional profile arrives in slice 3, once authentication (slice 2) exists."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

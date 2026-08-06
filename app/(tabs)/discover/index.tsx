import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { colors } from "../../../lib/theme";

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Discover projects"
        description="Browsing, searching, and filtering open listings arrives in slice 5, once projects can be created and published."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { colors } from "../../../lib/theme";

export default function ApplicationsScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Applications"
        description="Submitted, accepted, and rejected applications will appear here once the applications slice (6-7) is built."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

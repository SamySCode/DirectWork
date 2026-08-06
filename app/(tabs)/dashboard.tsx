import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../lib/theme";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Dashboard"
        description="Your listings, applications, and outstanding actions will appear here once authentication and profiles are built (slices 2-3)."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

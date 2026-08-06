import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { colors } from "../../../lib/theme";

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Messages"
        description="Project-scoped messaging arrives in slice 10, after workspace membership exists."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

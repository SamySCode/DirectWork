import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { searchSkills } from "../api";

type SkillsFieldProps = {
  value: string[];
  onChange: (skills: string[]) => void;
  error?: string;
};

export function SkillsField({ value, onChange, error }: SkillsFieldProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchSkills(trimmed)
        .then((results) => setSuggestions(results.filter((s) => !value.includes(s))))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, value]);

  const addSkill = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!value.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setQuery("");
    setSuggestions([]);
  };

  const removeSkill = (name: string) => {
    onChange(value.filter((s) => s !== name));
  };

  return (
    <View style={styles.container}>
      <TextField
        label="Skills"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => addSkill(query)}
        placeholder="Type a skill and press enter"
        error={error}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => addSkill(suggestion)}
              style={styles.suggestionItem}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((skill) => (
            <Pressable key={skill} onPress={() => removeSkill(skill)} style={styles.chip}>
              <Text style={styles.chipText}>{skill}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  suggestions: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  suggestionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  suggestionText: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
  chipRemove: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.bold,
  },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { errorMessage } from "../../../lib/functions";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { useFormValidation } from "../../../lib/validation";
import { timeAgo } from "../../listings/labels";
import { MAX_QUESTIONS, type Application } from "../api";
import { useAnswerQuestion, useAskQuestion } from "../hooks";
import { answerSchema, questionSchema } from "../schemas";

type ApplicationQuestionsProps = {
  application: Application;
  viewerIsOwner: boolean;
};

/**
 * The useful part of messaging, without open-ended chat: while an
 * application is pending the owner can ask up to three questions, one at a
 * time, and the applicant answers each once. Questions arrive embedded in
 * the application, so this costs no extra request.
 */
export function ApplicationQuestions({ application, viewerIsOwner }: ApplicationQuestionsProps) {
  const pending = application.status === "submitted";
  const list = application.questions;
  const open = list.find((q) => q.answer === null);
  const canAsk = viewerIsOwner && pending && !open && list.length < MAX_QUESTIONS;

  if (list.length === 0 && !canAsk) return null;

  return (
    <View style={styles.wrap}>
      {list.map((q) => (
        <View key={q.id} style={styles.thread}>
          <View style={styles.bubble}>
            <Text style={styles.label}>
              {viewerIsOwner ? "You asked" : "Owner asked"} · {timeAgo(q.asked_at)}
            </Text>
            <Text style={styles.body}>{q.question}</Text>
          </View>
          {q.answer !== null ? (
            <View style={[styles.bubble, styles.answer]}>
              <Text style={styles.label}>
                {viewerIsOwner ? "They answered" : "You answered"}
                {q.answered_at ? ` · ${timeAgo(q.answered_at)}` : ""}
              </Text>
              <Text style={styles.body}>{q.answer}</Text>
            </View>
          ) : viewerIsOwner ? (
            <Text style={styles.waiting}>Waiting for their answer</Text>
          ) : pending ? (
            <AnswerBox questionId={q.id} />
          ) : null}
        </View>
      ))}
      {canAsk ? (
        <AskBox applicationId={application.id} remaining={MAX_QUESTIONS - list.length} />
      ) : null}
    </View>
  );
}

function AskBox({ applicationId, remaining }: { applicationId: string; remaining: number }) {
  const ask = useAskQuestion();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const form = useFormValidation(questionSchema, { question });

  if (!open) {
    return (
      <Button
        label="Ask a question"
        icon="help-circle-outline"
        variant="ghost"
        size="sm"
        onPress={() => setOpen(true)}
        style={styles.askButton}
      />
    );
  }

  const submit = () => {
    const data = form.submit();
    if (!data) return;
    setError(null);
    ask.mutate(
      { applicationId, question: data.question },
      {
        onSuccess: () => {
          setQuestion("");
          setOpen(false);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <View style={styles.composer}>
      <TextField
        label="Your question"
        hint={`They'll see it on their application. ${remaining} of ${MAX_QUESTIONS} left.`}
        value={question}
        onChangeText={setQuestion}
        onBlur={() => form.touch("question")}
        error={form.errors.question}
        multiline
        maxLength={500}
        showCount
        autoCapitalize="sentences"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <Button
          label="Cancel"
          variant="secondary"
          size="sm"
          onPress={() => setOpen(false)}
          style={styles.flex}
        />
        <Button
          label="Send question"
          size="sm"
          onPress={submit}
          loading={ask.isPending}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function AnswerBox({ questionId }: { questionId: string }) {
  const answerQuestion = useAnswerQuestion();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const form = useFormValidation(answerSchema, { answer });

  const submit = () => {
    const data = form.submit();
    if (!data) return;
    setError(null);
    answerQuestion.mutate(
      { questionId, answer: data.answer },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <View style={styles.composer}>
      <View style={styles.nudge}>
        <Ionicons name="time-outline" size={16} color={colors.warning} />
        <Text style={styles.nudgeText}>The owner is waiting on this to decide.</Text>
      </View>
      <TextField
        label="Your answer"
        value={answer}
        onChangeText={setAnswer}
        onBlur={() => form.touch("answer")}
        error={form.errors.answer}
        multiline
        maxLength={1000}
        showCount
        autoCapitalize="sentences"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send answer" size="sm" onPress={submit} loading={answerQuestion.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  thread: {
    gap: spacing.sm,
  },
  bubble: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  answer: {
    marginLeft: spacing.lg,
    backgroundColor: colors.accentMuted,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  waiting: {
    marginLeft: spacing.lg,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  askButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
  },
  composer: {
    gap: spacing.sm,
  },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  nudgeText: {
    fontSize: typography.size.sm,
    color: colors.warning,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});

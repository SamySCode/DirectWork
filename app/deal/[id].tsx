import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { useApplication } from "../../features/applications/hooks";
import { useAuth } from "../../features/auth/SessionProvider";
import { getDealSheet } from "../../features/deals/api";
import { DealSheetForm, initialDealForm } from "../../features/deals/components/DealSheetForm";
import { DealSheetView } from "../../features/deals/components/DealSheetView";
import { PaymentReports } from "../../features/deals/components/PaymentReports";
import {
  rememberTerms,
  useConfirmDeal,
  useDealSheet,
  useProposeDeal,
  useSeenTerms,
} from "../../features/deals/hooks";
import { canRepropose, isAgreed, prefillFromListing, type Side } from "../../features/deals/logic";
import { dealSheetHtml, saveDealSheetPdf } from "../../features/deals/pdf";
import { useListing } from "../../features/listings/hooks";
import { useBlockedIds } from "../../features/safety/hooks";
import { errorMessage, FunctionError } from "../../lib/functions";
import { colors, spacing, typography } from "../../lib/theme";

/** The Deal Sheet for one accepted collaboration. `id` is the application id. */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const application = useApplication(id);
  const membershipId = application.data?.membership?.id;
  const deal = useDealSheet(membershipId);
  const listing = useListing(application.data?.project_id);
  const seen = useSeenTerms(deal.data?.id);
  const blockedIds = useBlockedIds();
  const propose = useProposeDeal();
  const confirmDeal = useConfirmDeal();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (application.isPending) return <LoadingState />;
  if (application.data === undefined) return <ErrorState onRetry={() => application.refetch()} />;
  const app = application.data;
  if (!app || app.status !== "accepted" || !app.membership) {
    return (
      <EmptyState
        icon="document-text-outline"
        title="No Deal Sheet here"
        description="Deal Sheets are for accepted collaborations."
      />
    );
  }
  if (deal.isPending) return <LoadingState />;
  if (deal.data === undefined) return <ErrorState onRetry={() => deal.refetch()} />;

  const sheet = deal.data;
  // The first proposal is prefilled from the listing - wait for it.
  if (!sheet && listing.isPending) return <LoadingState />;
  const side: Side = app.project?.owner_id === session?.user.id ? "owner" : "member";
  const partner = app.application_type === "partner";
  const projectTitle = app.project?.title ?? "Collaboration";
  const ownerName = listing.data?.owner?.full_name ?? "the owner";
  const memberName = app.applicant?.full_name ?? "the professional";
  const otherName = (side === "owner" ? memberName : ownerName).split(" ")[0] ?? "them";
  const myBusiness = sheet
    ? side === "owner"
      ? sheet.owner_business
      : sheet.member_business
    : false;
  const otherId = side === "owner" ? app.applicant_id : app.project?.owner_id;
  // The server refuses propose/confirm once either side has blocked the
  // other; we can only see our own blocks, so hide what we know is refused.
  const blocked = !!otherId && (blockedIds.data ?? []).includes(otherId);
  const canPropose = !blocked && canRepropose(sheet);
  const showForm = canPropose && (!sheet || editing);

  const onPropose = (terms: Parameters<typeof propose.mutate>[0]["sheet"], business: boolean) => {
    setError(null);
    propose.mutate(
      { membershipId: app.membership!.id, business, sheet: terms },
      {
        onSuccess: async () => {
          setEditing(false);
          // Keep a copy of what you proposed, to show what they change later.
          const fresh = await getDealSheet(app.membership!.id).catch(() => null);
          if (fresh) await rememberTerms(fresh);
          seen.refetch();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  const onConfirm = (business: boolean) => {
    if (!sheet) return;
    setError(null);
    confirmDeal.mutate(
      { sheet, business },
      {
        onSuccess: () => seen.refetch(),
        onError: (err) => {
          if (err instanceof FunctionError && err.code === "DEAL_CHANGED") {
            setError("The terms changed. Review the new version.");
            deal.refetch();
            return;
          }
          setError(errorMessage(err));
        },
      },
    );
  };

  const onPdf = async () => {
    if (!sheet) return;
    setPdfBusy(true);
    try {
      await saveDealSheetPdf(
        dealSheetHtml(sheet, { projectTitle, ownerName, memberName }),
        `Deal Sheet - ${projectTitle}`,
      );
    } catch {
      setError("Couldn't make the PDF. Try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Screen onRefresh={() => deal.refetch()} refreshing={deal.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Deal Sheet</Text>
        <Text style={styles.title}>{projectTitle}</Text>
        <Text style={styles.body}>
          The terms you and {otherName} agree for this collaboration. DirectWork records them; it
          isn't a party to your deal and doesn't give legal advice.
        </Text>
        <Button
          label={side === "owner" ? "Back to the listing" : "Back to your application"}
          variant="ghost"
          size="sm"
          icon="arrow-back"
          onPress={() =>
            router.push(side === "owner" ? `/listing/${app.project_id}` : `/application/${app.id}`)
          }
          style={styles.back}
        />
      </View>

      <Card style={styles.card}>
        {!sheet && !showForm ? (
          <Text style={styles.body}>
            Deal Sheets aren't available while one of you has blocked the other.
          </Text>
        ) : showForm ? (
          <DealSheetForm
            initial={initialDealForm(
              sheet,
              prefillFromListing(listing.data, partner),
              partner,
              myBusiness,
            )}
            partner={partner}
            editing={!!sheet}
            submitting={propose.isPending}
            error={error}
            onSubmit={onPropose}
            onCancel={sheet ? () => setEditing(false) : undefined}
          />
        ) : (
          <DealSheetView
            sheet={sheet!}
            canPropose={canPropose}
            canConfirm={!blocked}
            side={side}
            otherName={otherName}
            seen={seen.data ?? null}
            confirming={confirmDeal.isPending}
            error={error}
            onConfirm={onConfirm}
            onEdit={() => setEditing(true)}
            onPdf={onPdf}
            pdfBusy={pdfBusy}
          />
        )}
      </Card>

      {sheet && !showForm && isAgreed(sheet) && sheet.pay_basis !== "equity" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          <PaymentReports
            sheet={sheet}
            side={side}
            projectTitle={projectTitle}
            ownerName={ownerName}
            memberName={memberName}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

// A crash here shows a retry prompt in place of this screen only.
export { RouteErrorBoundary as ErrorBoundary } from "../../components/RouteErrorBoundary";

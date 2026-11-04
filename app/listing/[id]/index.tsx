import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Screen } from "../../../components/Screen";
import { SectionHeader } from "../../../components/SectionHeader";
import {
  ApplicantFunnel,
  funnelCounts,
} from "../../../features/applications/components/ApplicantFunnel";
import { ApplicantCard } from "../../../features/applications/components/ApplicantCard";
import { ApplyPanel } from "../../../features/applications/components/ApplyPanel";
import { useListingApplications } from "../../../features/applications/hooks";
import { useAuth } from "../../../features/auth/SessionProvider";
import { FitPanel } from "../../../features/listings/components/FitPanel";
import { ListingDetailView } from "../../../features/listings/components/ListingDetailView";
import { computeFit } from "../../../features/listings/fit";
import { OwnerPanel } from "../../../features/listings/components/OwnerPanel";
import { useListing } from "../../../features/listings/hooks";
import { useMyProfile } from "../../../features/profile/hooks";
import { spacing } from "../../../lib/theme";
import { SafetyActions } from "../../../features/safety/components/SafetyActions";

export default function ListingScreen() {
  const { id, notice } = useLocalSearchParams<{ id: string; notice?: string }>();
  const { session } = useAuth();
  const listing = useListing(id);
  const isOwner = !!listing.data && listing.data.owner_id === session?.user.id;
  const applications = useListingApplications(isOwner ? id : undefined);
  const { skills, profile } = useMyProfile();
  const mySkills = useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);

  if (listing.isPending) return <LoadingState />;
  if (listing.isError) return <ErrorState onRetry={() => listing.refetch()} />;
  if (!listing.data) {
    return (
      <EmptyState
        icon="eye-off-outline"
        title="This listing isn't available"
        description="It may have been closed or taken down by its owner."
      />
    );
  }

  const data = listing.data;
  const pending = (applications.data ?? []).filter((a) => a.status === "submitted");
  const accepted = (applications.data ?? []).filter((a) => a.status === "accepted");
  const others = (applications.data ?? []).filter(
    (a) => a.status !== "submitted" && a.status !== "accepted",
  );
  const acceptingApplications = data.status === "published";

  return (
    <Screen
      onRefresh={() => {
        listing.refetch();
        if (isOwner) applications.refetch();
      }}
      footer={
        !isOwner && acceptingApplications ? (
          <ApplyPanel
            projectId={data.id}
            ownerFirstName={data.owner?.full_name.split(" ")[0] ?? "the owner"}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: isOwner ? "Your listing" : "Listing" }} />

      {isOwner ? <OwnerPanel listing={data} notice={notice} /> : null}
      {isOwner ? <ApplicantFunnel counts={funnelCounts(applications.data ?? [])} /> : null}

      {isOwner && (applications.data?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          {pending.length > 0 ? (
            <>
              <SectionHeader title={`Waiting for you (${pending.length})`} />
              {pending.map((app) => (
                <ApplicantCard key={app.id} application={app} />
              ))}
            </>
          ) : null}
          {accepted.length > 0 ? (
            <>
              <SectionHeader title="Working with" />
              {accepted.map((app) => (
                <ApplicantCard key={app.id} application={app} />
              ))}
            </>
          ) : null}
          {others.length > 0 ? (
            <>
              <SectionHeader title="Past applicants" />
              {others.map((app) => (
                <ApplicantCard key={app.id} application={app} />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {isOwner ? <SectionHeader title="How it looks to others" /> : null}
      <ListingDetailView
        listing={data}
        mySkills={isOwner ? undefined : mySkills}
        afterHeader={isOwner ? null : <FitPanel fit={computeFit(data, profile, mySkills)} />}
      />

      {!isOwner && !acceptingApplications ? (
        <EmptyState
          inline
          icon="pause-circle-outline"
          title="Not accepting applications"
          description="This listing is paused or closed right now."
        />
      ) : null}

      {!isOwner && data.owner ? (
        <SafetyActions
          target={{ kind: "listing", id: data.id }}
          person={{ id: data.owner.id, name: data.owner.full_name }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
});

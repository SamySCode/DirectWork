import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../features/auth/SessionProvider";
import { ProfileView } from "../../features/profile/components/ProfileView";
import {
  usePortfolio,
  useProfile,
  useReferences,
  useProfileSkills,
  useTrackRecord,
} from "../../features/profile/hooks";
import { SafetyActions } from "../../features/safety/components/SafetyActions";

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const profile = useProfile(id);
  const skills = useProfileSkills(id);
  const trackRecord = useTrackRecord(id);
  const portfolio = usePortfolio(id);
  const references = useReferences(id);

  if (profile.isPending) return <LoadingState />;
  if (profile.isError)
    return <ErrorState title="Couldn't load this profile" onRetry={() => profile.refetch()} />;
  if (!profile.data) {
    return (
      <EmptyState
        icon="person-outline"
        title="This profile doesn't exist"
        description="The account may have been deleted."
      />
    );
  }

  return (
    <Screen>
      <ProfileView
        profile={profile.data}
        skills={skills.data ?? []}
        trackRecord={trackRecord.data}
        portfolio={portfolio.data}
        references={references.data}
      />
      {session?.user.id !== profile.data.id ? (
        <SafetyActions
          target={{ kind: "profile", id: profile.data.id }}
          person={{ id: profile.data.id, name: profile.data.full_name }}
        />
      ) : null}
    </Screen>
  );
}

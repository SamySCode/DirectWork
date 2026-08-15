import { Redirect } from "expo-router";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../features/auth/hooks";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return <LoadingState />;
  }

  return <Redirect href={session ? "/dashboard" : "/sign-in"} />;
}

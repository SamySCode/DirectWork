import type { BadgeTone } from "../../components/Badge";
import type { Application, ApplicationStatus } from "./api";

export const applicationStatusMeta: Record<ApplicationStatus, { label: string; tone: BadgeTone }> =
  {
    submitted: { label: "Waiting for reply", tone: "warning" },
    accepted: { label: "Accepted", tone: "mint" },
    rejected: { label: "Not this time", tone: "neutral" },
    withdrawn: { label: "Withdrawn", tone: "neutral" },
  };

/** What the collaboration looks like from one side, in plain words. */
export function collaborationState(
  application: Application,
  viewerIsOwner: boolean,
): { label: string; tone: BadgeTone; needsYou: boolean } | null {
  const membership = application.membership;
  if (application.status !== "accepted" || !membership) return null;
  const outcome = membership.outcome;
  if (!outcome) return { label: "Working together", tone: "accent", needsYou: false };
  const mine = viewerIsOwner ? outcome.confirmed_by_owner_at : outcome.confirmed_by_member_at;
  const theirs = viewerIsOwner ? outcome.confirmed_by_member_at : outcome.confirmed_by_owner_at;
  const word = outcome.outcome === "completed" ? "completed" : "ended";
  if (mine && theirs) {
    return {
      label: outcome.outcome === "completed" ? "Completed" : "Ended",
      tone: outcome.outcome === "completed" ? "mint" : "neutral",
      needsYou: false,
    };
  }
  if (mine)
    return { label: `Waiting for them to confirm ${word}`, tone: "warning", needsYou: false };
  return { label: `They marked this ${word} - confirm?`, tone: "warning", needsYou: true };
}

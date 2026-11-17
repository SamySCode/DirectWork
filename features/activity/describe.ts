import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import type { ActivityItem } from "./api";

export type ActivityTone = "accent" | "mint" | "warning" | "neutral";

export type ActivityView = {
  icon: ComponentProps<typeof Ionicons>["name"];
  tone: ActivityTone;
  text: string;
  href: Href | null;
};

/** How one inbox row reads and where it leads, from the viewer's side. */
export function describeActivity(item: ActivityItem, viewerId: string | undefined): ActivityView {
  const who = item.actor?.full_name.split(" ")[0] ?? "Someone";
  const title = item.project?.title ?? "a listing";
  const listing: Href | null = item.project_id ? `/listing/${item.project_id}` : null;
  const application: Href | null = item.application_id
    ? `/application/${item.application_id}`
    : null;
  // Outcome and reference rows go to whichever side of the collaboration you're on.
  const isOwner = item.project?.owner_id === viewerId;
  const collaboration = isOwner ? listing : application;
  // Deal Sheet rows open the Deal Sheet itself (keyed by the application).
  const deal: Href | null = item.application_id ? `/deal/${item.application_id}` : collaboration;

  switch (item.kind) {
    case "application_received":
      return {
        icon: "person-add",
        tone: "accent",
        text: `${who} applied to ${title}`,
        href: listing,
      };
    case "application_accepted":
      return {
        icon: "sparkles",
        tone: "mint",
        text: `${who} accepted you for ${title} - contact details unlocked`,
        href: application,
      };
    case "application_declined":
      return {
        icon: "close-circle",
        tone: "neutral",
        text: `${title} wasn't a fit this time`,
        href: application,
      };
    case "application_closed":
      return {
        icon: "lock-closed",
        tone: "neutral",
        text: `${title} closed before a decision`,
        href: application,
      };
    case "listing_published":
      return { icon: "rocket", tone: "mint", text: `${title} is live`, href: listing };
    case "listing_changes_requested":
      return {
        icon: "create",
        tone: "warning",
        text: `A reviewer asked for changes to ${title}`,
        href: listing,
      };
    case "outcome_to_confirm":
      return {
        icon: "checkmark-done",
        tone: "warning",
        text: `${who} recorded how ${title} went - confirm it`,
        href: collaboration,
      };
    case "outcome_confirmed":
      return {
        icon: "ribbon",
        tone: "mint",
        text: `${title} is confirmed complete - write ${who} a reference`,
        href: collaboration,
      };
    case "reference_received":
      return {
        icon: "chatbox-ellipses",
        tone: "mint",
        text: `${who} wrote you a reference for ${title}`,
        href: "/profile",
      };
    case "question_asked":
      return {
        icon: "help-circle",
        tone: "warning",
        text: `${who} asked you a question about ${title}`,
        href: application,
      };
    case "question_answered":
      return {
        icon: "chatbubble",
        tone: "accent",
        text: `${who} answered your question on ${title}`,
        href: listing,
      };
    case "deal_proposed":
      return {
        icon: "document-text",
        tone: "warning",
        text: `${who} proposed Deal Sheet terms for ${title} - review and confirm`,
        href: deal,
      };
    case "deal_agreed":
      return {
        icon: "checkmark-circle",
        tone: "mint",
        text: `The Deal Sheet for ${title} is agreed by you both`,
        href: deal,
      };
    case "payment_due":
      return {
        icon: "calendar",
        tone: "accent",
        text: isOwner
          ? `A payment on ${title} is due today`
          : `A payment on ${title} is due - record it once you know`,
        href: deal,
      };
    case "payment_reported":
      return {
        icon: "receipt",
        tone: "accent",
        text: `${who} recorded a payment on ${title} - you can dispute it within 14 days`,
        href: deal,
      };
    case "payment_disputed":
      return {
        icon: "flag",
        tone: "warning",
        text: `${who} disputed your payment report on ${title}`,
        href: deal,
      };
    case "payment_dispute_resolved":
      return {
        icon: "shield-checkmark",
        tone: "neutral",
        text: `A moderator decided the payment dispute on ${title}`,
        href: deal,
      };
  }
}

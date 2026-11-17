import { onAccountChange } from "../../lib/accountScope";

// An application note someone has started but not sent, by listing. Writing
// a good note often means leaving the listing to look at the owner's
// profile or your own; without this the note is gone when you come back.
//
// In memory only: it lasts for this visit to the app, is never stored on the
// device or sent anywhere, and is dropped once the application is sent.
const drafts = new Map<string, string>();
onAccountChange(() => drafts.clear());

export function getApplicationDraft(projectId: string): string {
  return drafts.get(projectId) ?? "";
}

export function setApplicationDraft(projectId: string, note: string): void {
  if (note) drafts.set(projectId, note);
  else drafts.delete(projectId);
}

export function clearApplicationDraft(projectId: string): void {
  drafts.delete(projectId);
}

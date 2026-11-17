import { accountChanged } from "../../../lib/accountScope";
import { clearApplicationDraft, getApplicationDraft, setApplicationDraft } from "../drafts";

describe("unsent application notes", () => {
  afterEach(() => accountChanged());

  it("keeps a note per listing for the rest of the visit", () => {
    setApplicationDraft("listing-1", "I built something very like this last year");
    setApplicationDraft("listing-2", "Different note");
    expect(getApplicationDraft("listing-1")).toBe("I built something very like this last year");
    expect(getApplicationDraft("listing-2")).toBe("Different note");
    expect(getApplicationDraft("listing-3")).toBe("");
  });

  it("forgets a note once the application is sent, or the box is emptied", () => {
    setApplicationDraft("listing-1", "Draft");
    clearApplicationDraft("listing-1");
    expect(getApplicationDraft("listing-1")).toBe("");

    setApplicationDraft("listing-2", "Draft");
    setApplicationDraft("listing-2", "");
    expect(getApplicationDraft("listing-2")).toBe("");
  });

  it("never carries a note over to the next person who signs in on this device", () => {
    setApplicationDraft("listing-1", "Someone else's half-written note");
    accountChanged();
    expect(getApplicationDraft("listing-1")).toBe("");
  });
});

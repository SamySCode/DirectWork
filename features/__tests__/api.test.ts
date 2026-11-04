import { createSupabaseMock } from "../../test/supabaseMock";

const mock = createSupabaseMock();
jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mock.supabase;
  },
}));

const mockUpload = jest.fn();
const mockRemove = jest.fn();
jest.mock("../../lib/images", () => ({
  ...jest.requireActual("../../lib/images"),
  uploadImage: (...args: unknown[]) => mockUpload(...args),
  removeImages: (...args: unknown[]) => mockRemove(...args),
}));

import { applyToListing, attachImages } from "../applications/api";
import { deleteDraft, discoverListings, syncListingImages } from "../listings/api";
import { ensureSkillIds, setAvatar } from "../profile/api";

const image = { uri: "file://x.jpg", width: 1, height: 1 };

beforeEach(() => {
  mock.reset();
  mockUpload.mockReset();
  mockRemove.mockReset().mockResolvedValue(undefined);
});

describe("applyToListing", () => {
  it("returns the new application id", async () => {
    mock.queue("applications", { data: { id: "app-9" } });
    await expect(applyToListing("listing-1", "A relevant note")).resolves.toBe("app-9");
  });

  it("turns the one-live-application rule into a friendly message", async () => {
    mock.queue("applications", { error: { code: "23505", message: "duplicate key" } });
    await expect(applyToListing("l", "note")).rejects.toThrow(
      "You've already applied to this listing.",
    );
  });

  it("passes database rule messages straight through", async () => {
    mock.queue("applications", {
      error: { code: "P0001", message: "This listing is not accepting applications" },
    });
    await expect(applyToListing("l", "note")).rejects.toThrow(
      "This listing is not accepting applications",
    );
  });
});

describe("attachImages", () => {
  it("uploads each image into the applicant's folder and links it", async () => {
    mockUpload.mockResolvedValueOnce("user-1/a.jpg").mockResolvedValueOnce("user-1/b.jpg");
    await attachImages("app-1", "user-1", [image, image]);
    expect(mockUpload).toHaveBeenCalledWith("application-attachments", "user-1", image);
    const inserts = mock.callsTo("application_attachments").filter((c) => c.method === "insert");
    expect(inserts.map((c) => c.args[0])).toEqual([
      { application_id: "app-1", storage_path: "user-1/a.jpg" },
      { application_id: "app-1", storage_path: "user-1/b.jpg" },
    ]);
  });

  it("reports partial failure and cleans up the orphaned file", async () => {
    mockUpload.mockResolvedValueOnce("user-1/a.jpg").mockResolvedValueOnce("user-1/b.jpg");
    mock.queue("application_attachments", {}, { error: { message: "cap reached" } });
    await expect(attachImages("app-1", "user-1", [image, image])).rejects.toThrow(
      "Application sent, but 1 of 2 images couldn't be attached.",
    );
    expect(mockRemove).toHaveBeenCalledWith("application-attachments", ["user-1/b.jpg"]);
  });
});

describe("setAvatar", () => {
  it("points the profile at the new file, then deletes the old one", async () => {
    mockUpload.mockResolvedValue("user-1/new.jpg");
    await setAvatar("user-1", image, "user-1/old.jpg");
    const update = mock.callsTo("profiles").find((c) => c.method === "update");
    expect(update?.args[0]).toEqual({ avatar_url: "user-1/new.jpg" });
    expect(mockRemove).toHaveBeenCalledWith("avatars", ["user-1/old.jpg"]);
  });

  it("rolls back the upload if the profile can't be updated", async () => {
    mockUpload.mockResolvedValue("user-1/new.jpg");
    mock.queue("profiles", { error: new Error("check constraint profiles_avatar_path") });
    await expect(setAvatar("user-1", image, "user-1/old.jpg")).rejects.toThrow(/avatar_path/);
    expect(mockRemove).toHaveBeenCalledWith("avatars", ["user-1/new.jpg"]);
    expect(mockRemove).not.toHaveBeenCalledWith("avatars", ["user-1/old.jpg"]);
  });
});

describe("syncListingImages", () => {
  it("removes dropped images first, then appends new ones after the kept ones", async () => {
    mock.queue("listing_images", {
      data: [
        { id: "keep", storage_path: "o/p/keep.jpg" },
        { id: "drop", storage_path: "o/p/drop.jpg" },
      ],
    });
    mockUpload.mockResolvedValue("o/p/new.jpg");
    await syncListingImages("p", "o", {
      keep: [{ id: "keep", storage_path: "o/p/keep.jpg", position: 0, url: "" }],
      added: [image],
    });

    const calls = mock.callsTo("listing_images").map((c) => c.method);
    expect(calls.indexOf("delete")).toBeLessThan(calls.indexOf("insert"));
    expect(mockRemove).toHaveBeenCalledWith("listing-images", ["o/p/drop.jpg"]);
    expect(mockUpload).toHaveBeenCalledWith("listing-images", "o/p", image);
    const insert = mock.callsTo("listing_images").find((c) => c.method === "insert");
    expect(insert?.args[0]).toEqual({ project_id: "p", storage_path: "o/p/new.jpg", position: 1 });
  });

  it("does nothing extra when nothing changed", async () => {
    mock.queue("listing_images", { data: [{ id: "keep", storage_path: "o/p/keep.jpg" }] });
    await syncListingImages("p", "o", {
      keep: [{ id: "keep", storage_path: "o/p/keep.jpg", position: 0, url: "" }],
      added: [],
    });
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe("deleteDraft", () => {
  it("collects image paths before deleting the row, then removes the files", async () => {
    mock.queue("listing_images", { data: [{ storage_path: "o/p/a.jpg" }] });
    await deleteDraft("p");
    expect(mock.callsTo("projects").some((c) => c.method === "delete")).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith("listing-images", ["o/p/a.jpg"]);
  });

  it("keeps the files if the delete is refused", async () => {
    mock.queue("listing_images", { data: [{ storage_path: "o/p/a.jpg" }] });
    mock.queue("projects", { error: new Error("not a draft") });
    await expect(deleteDraft("p")).rejects.toThrow("not a draft");
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("discoverListings", () => {
  const orFilter = () =>
    mock.callsTo("projects").find((c) => c.method === "or")?.args[0] as string | undefined;

  it("strips PostgREST syntax characters and escapes LIKE wildcards in search", async () => {
    // An attempt to close the ilike clause and inject `status.eq.draft`.
    await discoverListings({ query: 'react),status.eq.draft,(title "100%_', remoteOnly: false }, 0);
    const clauses = orFilter()!.split(",");
    // Still exactly our two clauses - nothing injected alongside them.
    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toMatch(/^title\.ilike\.%/);
    expect(clauses[1]).toMatch(/^public_summary\.ilike\.%/);
    for (const clause of clauses) {
      expect(clause).not.toMatch(/[()"]/);
      expect(clause).toContain("100\\%\\_");
    }
  });

  it("only ever asks for published listings, featured first, one page at a time", async () => {
    await discoverListings({ query: "", remoteOnly: true, type: "partner" }, 2);
    const calls = mock.callsTo("projects");
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "eq", args: ["status", "published"] }),
        expect.objectContaining({ method: "eq", args: ["opportunity_type", "partner"] }),
        expect.objectContaining({ method: "in", args: ["remote_pref", ["remote", "flexible"]] }),
        expect.objectContaining({ method: "order", args: ["is_featured", { ascending: false }] }),
        expect.objectContaining({ method: "range", args: [40, 59] }),
      ]),
    );
    expect(orFilter()).toBeUndefined();
  });

  it("applies commitment, pay type and minimum pay (either end of the range)", async () => {
    await discoverListings(
      {
        query: "",
        remoteOnly: false,
        commitment: "part_time",
        compensationType: "daily",
        minPay: 400,
      },
      0,
    );
    expect(mock.callsTo("projects")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "eq", args: ["commitment", "part_time"] }),
        expect.objectContaining({ method: "eq", args: ["compensation_type", "daily"] }),
        expect.objectContaining({
          method: "or",
          args: ["compensation_max.gte.400,and(compensation_max.is.null,compensation_min.gte.400)"],
        }),
      ]),
    );
  });

  it("sorts by pay without putting featured first", async () => {
    await discoverListings({ query: "", remoteOnly: false, sort: "pay" }, 0);
    const orders = mock
      .callsTo("projects")
      .filter((c) => c.method === "order")
      .map((c) => c.args[0]);
    expect(orders).toContain("compensation_max");
    expect(orders).not.toContain("is_featured");
  });

  it("ignores a non-integer minimum pay", async () => {
    await discoverListings({ query: "", remoteOnly: false, minPay: 12.5 }, 0);
    expect(mock.callsTo("projects").some((c) => c.method === "or")).toBe(false);
  });

  it("asks for only the cover image per listing", async () => {
    await discoverListings({ query: "", remoteOnly: false }, 0);
    expect(mock.callsTo("projects")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "limit",
          args: [1, { referencedTable: "listing_images" }],
        }),
      ]),
    );
  });
});

describe("ensureSkillIds", () => {
  it("resolves a whole list in one call", async () => {
    mock.queue("rpc:ensure_skills", { data: [{ id: "s1" }, { id: "s2" }] });
    await expect(ensureSkillIds(["Go", "Rust"])).resolves.toEqual(["s1", "s2"]);
    expect(mock.callsTo("rpc:ensure_skills")).toHaveLength(1);
  });

  it("skips the round trip for an empty list", async () => {
    await expect(ensureSkillIds([])).resolves.toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });
});

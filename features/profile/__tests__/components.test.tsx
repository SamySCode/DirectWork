import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { makeProfile } from "../../../test/fixtures";
import { pickImages } from "../../../lib/images";
import { searchSkills } from "../api";
import { ProfileImagesEditor } from "../components/ProfileImagesEditor";
import { ProfileView } from "../components/ProfileView";
import { SkillsField } from "../components/SkillsField";
import {
  useAddPortfolioImages,
  useClearAvatar,
  usePortfolio,
  useRemovePortfolioImage,
  useSetAvatar,
} from "../hooks";

jest.mock("../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }),
    },
  },
}));
jest.mock("../api", () => ({
  ...jest.requireActual("../api"),
  searchSkills: jest.fn(),
}));
jest.mock("../../../lib/images", () => ({
  ...jest.requireActual("../../../lib/images"),
  pickImages: jest.fn(),
}));
jest.mock("../hooks", () => ({
  usePortfolio: jest.fn(),
  useSetAvatar: jest.fn(),
  useClearAvatar: jest.fn(),
  useAddPortfolioImages: jest.fn(),
  useRemovePortfolioImage: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("SkillsField", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function Harness({ initial = [] as string[] }) {
    const [value, setValue] = require("react").useState(initial);
    return <SkillsField value={value} onChange={setValue} />;
  }

  it("offers the typed text as a new skill and adds it", () => {
    (searchSkills as jest.Mock).mockResolvedValue([]);
    render(<Harness />);
    fireEvent.changeText(screen.getByLabelText("Skills"), "Rust");
    fireEvent.press(screen.getByRole("button", { name: "Add “Rust”" }));
    expect(screen.getByText("Rust")).toBeTruthy();
    expect(screen.getByLabelText("Skills").props.value).toBe("");
  });

  it("suggests existing skills after a debounce and excludes ones already chosen", async () => {
    (searchSkills as jest.Mock).mockResolvedValue(["React", "React Native"]);
    render(<Harness initial={["React"]} />);
    fireEvent.changeText(screen.getByLabelText("Skills"), "rea");
    expect(searchSkills).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(searchSkills).toHaveBeenCalledWith("rea");
    await waitFor(() => expect(screen.getByText("React Native")).toBeTruthy());
    // "React" is already selected - shown once as a chip, not as a suggestion.
    expect(screen.getAllByText("React")).toHaveLength(1);
  });

  it("doesn't add duplicates case-insensitively", () => {
    (searchSkills as jest.Mock).mockResolvedValue([]);
    render(<Harness initial={["TypeScript"]} />);
    fireEvent.changeText(screen.getByLabelText("Skills"), "typescript");
    expect(screen.queryByRole("button", { name: /Add “typescript”/ })).toBeNull();
    fireEvent(screen.getByLabelText("Skills"), "submitEditing");
    expect(screen.getAllByText("TypeScript")).toHaveLength(1);
  });

  it("removes a skill when its chip is pressed", () => {
    render(<Harness initial={["Go", "Postgres"]} />);
    fireEvent.press(screen.getByText("Go"));
    expect(screen.queryByText("Go")).toBeNull();
    expect(screen.getByText("Postgres")).toBeTruthy();
  });
});

describe("ProfileView", () => {
  it("shows intents, details, skills, track record and portfolio", () => {
    render(
      <ProfileView
        profile={makeProfile({ seeking_partner: true, wants_to_hire: true })}
        skills={["React Native", "Supabase"]}
        trackRecord={{ completed: 3, total: 4 }}
        portfolio={[
          {
            id: "p1",
            storage_path: "x",
            caption: "Booking flow",
            position: 0,
            url: "https://cdn/x",
          },
        ]}
      />,
    );
    expect(screen.getByText("Open to paid work")).toBeTruthy();
    expect(screen.getByText("Open to partnerships")).toBeTruthy();
    expect(screen.getByText("Hiring")).toBeTruthy();
    expect(screen.getByText("Senior mobile engineer · Manchester, UK · Remote")).toBeTruthy();
    expect(screen.getByText("3 completed collaborations")).toBeTruthy();
    expect(screen.getByText(/1 more ended early/)).toBeTruthy();
    expect(screen.getByRole("imagebutton", { name: "Booking flow" })).toBeTruthy();
  });

  it("explains the track record when there isn't one yet", () => {
    render(
      <ProfileView profile={makeProfile()} skills={[]} trackRecord={{ completed: 0, total: 0 }} />,
    );
    expect(screen.getByText("0 completed collaborations")).toBeTruthy();
    expect(screen.getByText(/Confirmed by both sides once a project wraps up/)).toBeTruthy();
  });

  it("opens the portfolio link", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ProfileView profile={makeProfile()} skills={[]} />);
    fireEvent.press(screen.getByRole("link"));
    expect(openURL).toHaveBeenCalledWith("https://sam.dev");
  });

  it("can hide its header when the screen shows name and photo itself", () => {
    render(<ProfileView profile={makeProfile()} skills={[]} showHeader={false} />);
    expect(screen.queryByText("Sam Saib")).toBeNull();
    expect(screen.getByText("I build mobile products end to end.")).toBeTruthy();
  });
});

describe("ProfileImagesEditor", () => {
  const mutateAsync = jest.fn().mockResolvedValue(undefined);
  const mutate = jest.fn();
  beforeEach(() => {
    (usePortfolio as jest.Mock).mockReturnValue({ data: [] });
    for (const hook of [
      useSetAvatar,
      useClearAvatar,
      useAddPortfolioImages,
      useRemovePortfolioImage,
    ]) {
      (hook as jest.Mock).mockReturnValue({ mutate, mutateAsync, isPending: false });
    }
  });

  it("uploads a square-cropped avatar and replaces the previous one", async () => {
    const image = { uri: "file://me.jpg", width: 800, height: 800 };
    (pickImages as jest.Mock).mockResolvedValue([image]);
    render(<ProfileImagesEditor profile={makeProfile({ avatar_url: "user-1/old.jpg" })} />);
    fireEvent.press(screen.getByRole("button", { name: "Change" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ image, previous: "user-1/old.jpg" }),
    );
    expect(pickImages).toHaveBeenCalledWith({ square: true });
  });

  it("shows validation errors from the picker", async () => {
    (pickImages as jest.Mock).mockRejectedValue(new Error("GIFs and SVGs aren't supported."));
    render(<ProfileImagesEditor profile={makeProfile()} />);
    fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
    expect(await screen.findByText("GIFs and SVGs aren't supported.")).toBeTruthy();
  });

  it("only asks for as many portfolio images as there are free slots", async () => {
    (usePortfolio as jest.Mock).mockReturnValue({
      data: [0, 1, 2, 3].map((i) => ({
        id: `p${i}`,
        storage_path: "x",
        caption: null,
        position: i,
        url: "u",
      })),
    });
    (pickImages as jest.Mock).mockResolvedValue([]);
    render(<ProfileImagesEditor profile={makeProfile()} />);
    fireEvent.press(screen.getByRole("button", { name: "Add image to Portfolio" }));
    await waitFor(() => expect(pickImages).toHaveBeenCalledWith({ limit: 2 }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("removes a portfolio image", () => {
    const item = { id: "p1", storage_path: "x", caption: null, position: 0, url: "u" };
    (usePortfolio as jest.Mock).mockReturnValue({ data: [item] });
    render(<ProfileImagesEditor profile={makeProfile()} />);
    fireEvent.press(screen.getByRole("button", { name: "Remove image" }));
    expect(mutate).toHaveBeenCalledWith(item, expect.any(Object));
  });
});

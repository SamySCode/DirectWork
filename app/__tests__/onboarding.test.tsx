import { fireEvent, render, screen } from "@testing-library/react-native";
import OnboardingScreen from "../onboarding";
import { useSaveProfile } from "../../features/profile/hooks";

jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../features/auth/api", () => ({ signOut: jest.fn() }));
jest.mock("../../features/profile/hooks", () => ({ useSaveProfile: jest.fn() }));
jest.mock("../../features/profile/components/SkillsField", () => {
  const { Pressable, Text } = require("react-native");
  return {
    SkillsField: ({
      value,
      onChange,
      error,
    }: {
      value: string[];
      onChange: (v: string[]) => void;
      error?: string;
    }) => (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="add test skill"
          onPress={() => onChange([...value, "Go"])}
        />
        {error ? <Text>{error}</Text> : null}
      </>
    ),
  };
});

const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (useSaveProfile as jest.Mock).mockReturnValue({ mutate, isPending: false, isError: false });
});

const pressContinue = () => fireEvent.press(screen.getByRole("button", { name: "Continue" }));

describe("Onboarding", () => {
  it("won't continue until an intent is picked", () => {
    render(<OnboardingScreen />);
    pressContinue();
    expect(screen.getByText("Pick at least one reason you're here")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  });

  it("walks through all three steps and saves the profile", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole("checkbox", { name: /Find paid projects/ }));
    pressContinue();

    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    pressContinue();
    expect(screen.getByText("Enter your name")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Full name"), "Sam Saib");
    fireEvent.changeText(screen.getByLabelText("Headline"), "React Native engineer");
    fireEvent.press(screen.getByRole("button", { name: "Remote" }));
    pressContinue();

    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Finish setup" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Add at least one skill")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "add test skill" }));
    fireEvent.press(screen.getByRole("button", { name: "Finish setup" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Sam Saib",
        headline: "React Native engineer",
        remotePref: "remote",
        seekingPaid: true,
        seekingPartner: false,
        wantsToHire: false,
        skills: ["Go"],
      }),
    );
  });

  it("blocks contact details in the headline", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole("checkbox", { name: /Post a project/ }));
    pressContinue();
    fireEvent.changeText(screen.getByLabelText("Full name"), "Sam Saib");
    const headline = screen.getByLabelText("Headline");
    fireEvent.changeText(headline, "Founder - sam@example.com");
    fireEvent(headline, "blur");
    expect(screen.getByText(/Leave out emails, phone numbers and links/)).toBeTruthy();
    pressContinue();
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
  });

  it("tailors copy for people who are only hiring", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole("checkbox", { name: /Post a project/ }));
    pressContinue();
    expect(screen.getByPlaceholderText("e.g. Founder, building a booking app")).toBeTruthy();
  });

  it("can go back a step", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole("checkbox", { name: /Find paid projects/ }));
    pressContinue();
    fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Find paid projects/ })).toBeChecked();
  });
});

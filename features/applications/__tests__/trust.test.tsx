import { fireEvent, render, screen } from "@testing-library/react-native";
import { makeApplication, T } from "../../../test/fixtures";
import { ApplicationQuestions } from "../components/ApplicationQuestions";
import { ReferenceComposer } from "../components/ReferenceComposer";
import {
  useAnswerQuestion,
  useAskQuestion,
  useHasWrittenReference,
  useWriteReference,
} from "../hooks";

jest.mock("../../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../hooks", () => ({
  useAskQuestion: jest.fn(),
  useAnswerQuestion: jest.fn(),
  useHasWrittenReference: jest.fn(),
  useWriteReference: jest.fn(),
}));

const ask = jest.fn();
const answer = jest.fn();
const write = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAskQuestion as jest.Mock).mockReturnValue({ mutate: ask, isPending: false });
  (useAnswerQuestion as jest.Mock).mockReturnValue({ mutate: answer, isPending: false });
  (useWriteReference as jest.Mock).mockReturnValue({ mutate: write, isPending: false });
  (useHasWrittenReference as jest.Mock).mockReturnValue({ data: false, isPending: false });
});

const question = (overrides = {}) => ({
  id: "q-1",
  question: "Which payment provider did you use?",
  answer: null,
  asked_at: T,
  answered_at: null,
  ...overrides,
});

describe("ApplicationQuestions", () => {
  it("lets the owner ask on a pending application", async () => {
    await render(<ApplicationQuestions application={makeApplication()} viewerIsOwner />);
    await fireEvent.press(screen.getByRole("button", { name: "Ask a question" }));
    await fireEvent.changeText(screen.getByLabelText("Your question"), "What was your role?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(ask).toHaveBeenCalledWith(
      { applicationId: "app-1", question: "What was your role?" },
      expect.any(Object),
    );
  });

  it("blocks contact details in a question before sending", async () => {
    await render(<ApplicationQuestions application={makeApplication()} viewerIsOwner />);
    await fireEvent.press(screen.getByRole("button", { name: "Ask a question" }));
    await fireEvent.changeText(screen.getByLabelText("Your question"), "Email me at a@b.co please");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(ask).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave out emails/)).toBeTruthy();
  });

  it("waits for an answer before the owner can ask again", async () => {
    await render(
      <ApplicationQuestions
        application={makeApplication({ questions: [question()] })}
        viewerIsOwner
      />,
    );
    expect(screen.getByText("Waiting for their answer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("stops at three questions", async () => {
    const answered = [1, 2, 3].map((n) =>
      question({ id: `q-${n}`, answer: "Answered.", answered_at: T }),
    );
    await render(
      <ApplicationQuestions application={makeApplication({ questions: answered })} viewerIsOwner />,
    );
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("lets the applicant answer an open question", async () => {
    await render(
      <ApplicationQuestions
        application={makeApplication({ questions: [question()] })}
        viewerIsOwner={false}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "Stripe, with webhooks.");
    await fireEvent.press(screen.getByRole("button", { name: "Send answer" }));
    expect(answer).toHaveBeenCalledWith(
      { questionId: "q-1", answer: "Stripe, with webhooks." },
      expect.any(Object),
    );
  });

  it("renders nothing for an applicant with no questions", async () => {
    const { toJSON } = await render(
      <ApplicationQuestions application={makeApplication()} viewerIsOwner={false} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("ReferenceComposer", () => {
  it("publishes a validated reference", async () => {
    await render(<ReferenceComposer membershipId="m-1" otherName="Priya Shah" />);
    expect(screen.getByText("Write Priya a reference")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Reference"), "Too short");
    await fireEvent.press(screen.getByRole("button", { name: "Publish reference" }));
    expect(write).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Reference"),
      "Shipped the booking flow two days early.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Publish reference" }));
    expect(write).toHaveBeenCalledWith(
      { membershipId: "m-1", body: "Shipped the booking flow two days early." },
      expect.any(Object),
    );
  });

  it("confirms instead of offering a second one", async () => {
    (useHasWrittenReference as jest.Mock).mockReturnValue({ data: true, isPending: false });
    await render(<ReferenceComposer membershipId="m-1" otherName="Priya Shah" />);
    expect(screen.getByText(/is on their profile/)).toBeTruthy();
    expect(screen.queryByLabelText("Reference")).toBeNull();
  });
});

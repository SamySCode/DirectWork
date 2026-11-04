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
  it("lets the owner ask on a pending application", () => {
    render(<ApplicationQuestions application={makeApplication()} viewerIsOwner />);
    fireEvent.press(screen.getByRole("button", { name: "Ask a question" }));
    fireEvent.changeText(screen.getByLabelText("Your question"), "What was your role?");
    fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(ask).toHaveBeenCalledWith(
      { applicationId: "app-1", question: "What was your role?" },
      expect.any(Object),
    );
  });

  it("blocks contact details in a question before sending", () => {
    render(<ApplicationQuestions application={makeApplication()} viewerIsOwner />);
    fireEvent.press(screen.getByRole("button", { name: "Ask a question" }));
    fireEvent.changeText(screen.getByLabelText("Your question"), "Email me at a@b.co please");
    fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(ask).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave out emails/)).toBeTruthy();
  });

  it("waits for an answer before the owner can ask again", () => {
    render(
      <ApplicationQuestions
        application={makeApplication({ questions: [question()] })}
        viewerIsOwner
      />,
    );
    expect(screen.getByText("Waiting for their answer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("stops at three questions", () => {
    const answered = [1, 2, 3].map((n) =>
      question({ id: `q-${n}`, answer: "Answered.", answered_at: T }),
    );
    render(
      <ApplicationQuestions application={makeApplication({ questions: answered })} viewerIsOwner />,
    );
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("lets the applicant answer an open question", () => {
    render(
      <ApplicationQuestions
        application={makeApplication({ questions: [question()] })}
        viewerIsOwner={false}
      />,
    );
    fireEvent.changeText(screen.getByLabelText("Your answer"), "Stripe, with webhooks.");
    fireEvent.press(screen.getByRole("button", { name: "Send answer" }));
    expect(answer).toHaveBeenCalledWith(
      { questionId: "q-1", answer: "Stripe, with webhooks." },
      expect.any(Object),
    );
  });

  it("renders nothing for an applicant with no questions", () => {
    const { toJSON } = render(
      <ApplicationQuestions application={makeApplication()} viewerIsOwner={false} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("ReferenceComposer", () => {
  it("publishes a validated reference", () => {
    render(<ReferenceComposer membershipId="m-1" otherName="Priya Shah" />);
    expect(screen.getByText("Write Priya a reference")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Reference"), "Too short");
    fireEvent.press(screen.getByRole("button", { name: "Publish reference" }));
    expect(write).not.toHaveBeenCalled();
    fireEvent.changeText(
      screen.getByLabelText("Reference"),
      "Shipped the booking flow two days early.",
    );
    fireEvent.press(screen.getByRole("button", { name: "Publish reference" }));
    expect(write).toHaveBeenCalledWith(
      { membershipId: "m-1", body: "Shipped the booking flow two days early." },
      expect.any(Object),
    );
  });

  it("confirms instead of offering a second one", () => {
    (useHasWrittenReference as jest.Mock).mockReturnValue({ data: true, isPending: false });
    render(<ReferenceComposer membershipId="m-1" otherName="Priya Shah" />);
    expect(screen.getByText(/is on their profile/)).toBeTruthy();
    expect(screen.queryByLabelText("Reference")).toBeNull();
  });
});

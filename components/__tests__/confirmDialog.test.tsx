import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { confirm } from "../../lib/confirm";
import { ConfirmHost } from "../ConfirmDialog";

const withdraw = {
  title: "Withdraw your application?",
  message: "The owner will still see it, marked as withdrawn.",
  confirmLabel: "Withdraw",
  destructive: true,
};

/** Starts a confirm(), waits until the dialog has finished opening, and returns the pending answer. */
async function ask(options = withdraw) {
  let answer!: Promise<boolean>;
  await act(async () => {
    answer = confirm(options);
  });
  await screen.findByTestId("confirm-dialog");
  return { answer };
}

describe("the app's confirmation dialog", () => {
  it("shows the question as an alert dialog, with Cancel and the action", async () => {
    await render(<ConfirmHost />);
    await ask();
    // Announced as an alert dialog; its buttons stay separately reachable.
    expect(screen.getByTestId("confirm-dialog").props.role).toBe("alertdialog");
    expect(screen.getByText("Withdraw your application?")).toBeTruthy();
    expect(screen.getByText("The owner will still see it, marked as withdrawn.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });

  it("answers yes to the action, and closes", async () => {
    await render(<ConfirmHost />);
    const { answer } = await ask();
    await fireEvent.press(screen.getByRole("button", { name: "Withdraw" }));
    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).toBeNull());
  });

  it.each([
    ["Cancel", () => fireEvent.press(screen.getByRole("button", { name: "Cancel" }))],
    [
      "a tap outside",
      () =>
        fireEvent.press(screen.getByTestId("confirm-backdrop", { includeHiddenElements: true })),
    ],
    [
      "Android back or Escape",
      () => fireEvent(screen.getByTestId("confirm-modal"), "requestClose"),
    ],
  ])("answers no to %s", async (_how, dismiss) => {
    await render(<ConfirmHost />);
    const { answer } = await ask();
    await dismiss();
    await expect(answer).resolves.toBe(false);
  });

  it("asks one question at a time, in order", async () => {
    await render(<ConfirmHost />);
    const { answer: first } = await ask();
    let second!: Promise<boolean>;
    await act(async () => {
      second = confirm({ ...withdraw, title: "Block Priya?", confirmLabel: "Block" });
    });
    expect(screen.getByText("Withdraw your application?")).toBeTruthy();
    expect(screen.queryByText("Block Priya?")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Withdraw" }));
    await expect(first).resolves.toBe(true);
    await screen.findByText("Block Priya?");
    await screen.findByTestId("confirm-dialog");
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await expect(second).resolves.toBe(false);
  });

  it("only one press counts, however fast someone taps", async () => {
    await render(<ConfirmHost />);
    const { answer } = await ask();
    const action = screen.getByRole("button", { name: "Withdraw" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await fireEvent.press(action);
    await fireEvent.press(cancel);
    await expect(answer).resolves.toBe(true);
  });

  it("falls back to the system dialog if the app's isn't on screen", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    await expect(confirm(withdraw)).resolves.toBe(true);
    expect(alert).toHaveBeenCalledWith(
      "Withdraw your application?",
      "The owner will still see it, marked as withdrawn.",
      expect.any(Array),
    );
    alert.mockRestore();
  });
});

it("answers no to anything still waiting if the dialog goes away", async () => {
  const view = await render(<ConfirmHost />);
  const { answer } = await ask();
  await view.unmount();
  await expect(answer).resolves.toBe(false);
});

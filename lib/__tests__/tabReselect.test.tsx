import { act, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { emitTabReselect, tabNameOf, useTabReselect } from "../tabReselect";
import { renderHook } from "@testing-library/react-native";

describe("tab reselect", () => {
  it("maps the tab bar's route names to tab names", () => {
    expect(tabNameOf("discover/index")).toBe("discover");
    expect(tabNameOf("home")).toBe("home");
  });

  it("calls only the listeners for the tab that was pressed, until they unmount", async () => {
    const onHome = jest.fn();
    const onDiscover = jest.fn();
    const home = await renderHook(() => useTabReselect("home", onHome));
    await renderHook(() => useTabReselect("discover", onDiscover));

    emitTabReselect("home");
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onDiscover).not.toHaveBeenCalled();

    await home.unmount();
    emitTabReselect("home");
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("uses the latest handler without resubscribing", async () => {
    const first = jest.fn();
    const second = jest.fn();
    const hook = await renderHook(
      ({ handler }: { handler: () => void }) => useTabReselect("profile", handler),
      {
        initialProps: { handler: first },
      },
    );
    await hook.rerender({ handler: second });
    emitTabReselect("profile");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });

  it("does nothing for a screen that isn't a tab", async () => {
    const handler = jest.fn();
    await renderHook(() => useTabReselect(undefined, handler));
    emitTabReselect("home");
    expect(handler).not.toHaveBeenCalled();
  });

  it("scrolls a tab's Screen back to the top", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
    const view = await render(
      <Screen tab="applications">
        <Text>Content</Text>
      </Screen>,
    );
    await act(() => emitTabReselect("applications"));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 0 }));
    await view.unmount();
    scrollTo.mockRestore();
  });
});

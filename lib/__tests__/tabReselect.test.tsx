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

  it("calls only the listeners for the tab that was pressed, until they unmount", () => {
    const onHome = jest.fn();
    const onDiscover = jest.fn();
    const home = renderHook(() => useTabReselect("home", onHome));
    renderHook(() => useTabReselect("discover", onDiscover));

    emitTabReselect("home");
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onDiscover).not.toHaveBeenCalled();

    home.unmount();
    emitTabReselect("home");
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("uses the latest handler without resubscribing", () => {
    const first = jest.fn();
    const second = jest.fn();
    const hook = renderHook(
      ({ handler }: { handler: () => void }) => useTabReselect("profile", handler),
      {
        initialProps: { handler: first },
      },
    );
    hook.rerender({ handler: second });
    emitTabReselect("profile");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it("does nothing for a screen that isn't a tab", () => {
    const handler = jest.fn();
    renderHook(() => useTabReselect(undefined, handler));
    emitTabReselect("home");
    expect(handler).not.toHaveBeenCalled();
  });

  it("scrolls a tab's Screen back to the top", () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
    const view = render(
      <Screen tab="applications">
        <Text>Content</Text>
      </Screen>,
    );
    act(() => emitTabReselect("applications"));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 0 }));
    view.unmount();
    scrollTo.mockRestore();
  });
});

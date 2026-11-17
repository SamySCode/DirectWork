import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { setHapticsEnabled } from "../../../lib/haptics";
import { DeviceSettings } from "../components/DeviceSettings";

describe("On this phone: vibration", () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await act(() => setHapticsEnabled(true));
  });

  it("is a labelled switch, on by default, that turns vibration off", async () => {
    // iOS's switch: the test renderer's Android stand-in has no accessible
    // role. The setting itself is the same on both.
    jest.replaceProperty(Platform, "OS", "ios");
    render(<DeviceSettings />);
    const toggle = screen.getByRole("switch", { name: "Vibration" });
    expect(toggle.props.value).toBe(true);
    await act(async () => fireEvent(toggle, "valueChange", false));
    expect(screen.getByRole("switch", { name: "Vibration" }).props.value).toBe(false);
  });

  it("isn't shown on the web, where there's nothing to turn off", () => {
    jest.replaceProperty(Platform, "OS", "web");
    render(<DeviceSettings />);
    expect(screen.queryByRole("switch", { name: "Vibration" })).toBeNull();
  });
});

import { Platform } from "react-native";

// A minimal browser window: the test environment has none.
const target = new EventTarget();
const fakeWindow = {
  addEventListener: target.addEventListener.bind(target),
  removeEventListener: target.removeEventListener.bind(target),
  dispatchEvent: target.dispatchEvent.bind(target),
};

let gateModule: typeof import("../historyGate");

beforeAll(() => {
  jest.replaceProperty(Platform, "OS", "web");
  Object.assign(window, fakeWindow);
  gateModule = require("../historyGate");
  gateModule.installHistoryGate();
});

describe("history gate (web)", () => {
  // Stands in for the router's own listener, added after the gate at app start.
  const router = jest.fn();
  beforeAll(() => window.addEventListener("popstate", router));
  beforeEach(() => router.mockClear());

  const browserBack = () => window.dispatchEvent(new Event("popstate"));

  it("is added once, and lets every step through when no screen holds it", () => {
    gateModule.installHistoryGate();
    expect(gateModule.historyGateInstalled()).toBe(true);
    browserBack();
    expect(router).toHaveBeenCalledTimes(1);
  });

  it("keeps a refused step from ever reaching the router", () => {
    const remove = gateModule.setHistoryGate(() => false);
    browserBack();
    expect(router).not.toHaveBeenCalled();
    remove();
  });

  it("passes an allowed step on to the router", () => {
    const allow = jest.fn(() => true);
    const remove = gateModule.setHistoryGate(allow);
    browserBack();
    expect(allow).toHaveBeenCalledTimes(1);
    expect(router).toHaveBeenCalledTimes(1);
    remove();
  });

  it("stops asking once the screen removes its gate", () => {
    const remove = gateModule.setHistoryGate(() => false);
    remove();
    browserBack();
    expect(router).toHaveBeenCalledTimes(1);
  });

  it("an old screen's clean-up doesn't remove a newer screen's gate", () => {
    const removeOld = gateModule.setHistoryGate(() => true);
    const removeNew = gateModule.setHistoryGate(() => false);
    removeOld();
    browserBack();
    expect(router).not.toHaveBeenCalled();
    removeNew();
  });
});

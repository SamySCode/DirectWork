import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { haptics, loadHapticsPreference, setHapticsEnabled } from "../haptics";
import { showToast } from "../toast";

const ios = Haptics.notificationAsync as jest.Mock;
const iosSelection = Haptics.selectionAsync as jest.Mock;
const android = Haptics.performAndroidHapticsAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("haptics", () => {
  it("uses the Taptic Engine on iOS", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    haptics.success();
    haptics.selection();
    expect(ios).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(iosSelection).toHaveBeenCalledTimes(1);
    expect(android).not.toHaveBeenCalled();
  });

  it("uses Android's system haptics, never the vibrator (VIBRATE is blocked in app.json)", () => {
    jest.replaceProperty(Platform, "OS", "android");
    haptics.success();
    haptics.selection();
    expect(android).toHaveBeenCalledWith(Haptics.AndroidHaptics.Confirm);
    expect(android).toHaveBeenCalledWith(Haptics.AndroidHaptics.Segment_Tick);
    expect(ios).not.toHaveBeenCalled();
    expect(iosSelection).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("does nothing on the web", () => {
    jest.replaceProperty(Platform, "OS", "web");
    haptics.success();
    haptics.selection();
    expect(ios).not.toHaveBeenCalled();
    expect(android).not.toHaveBeenCalled();
  });

  it("never throws, whether the device rejects or throws outright", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    ios.mockRejectedValueOnce(new Error("no haptics engine"));
    expect(() => haptics.success()).not.toThrow();
    ios.mockImplementationOnce(() => {
      throw new Error("old device");
    });
    expect(() => haptics.success()).not.toThrow();
    await Promise.resolve();
  });

  it("taps once with each confirmation toast", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    showToast("Profile saved");
    expect(ios).toHaveBeenCalledTimes(1);
  });
});

describe("app.json", () => {
  it("blocks the vibrate permission the haptics package would add", () => {
    const app = require("../../app.json");
    expect(app.expo.android.blockedPermissions).toContain("android.permission.VIBRATE");
  });
});

describe("turning vibration off", () => {
  const KEY = "directwork.haptics-off";

  beforeEach(async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    // Back to the default (on) with nothing stored, then a clean slate.
    await setHapticsEnabled(true);
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("is on by default, with nothing stored", async () => {
    await loadHapticsPreference();
    haptics.success();
    expect(ios).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("stops every tap once turned off, and remembers it on this device", async () => {
    await setHapticsEnabled(false);
    haptics.success();
    haptics.selection();
    expect(ios).not.toHaveBeenCalled();
    expect(iosSelection).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(KEY)).toBe("1");
  });

  it("reads the choice back at start-up", async () => {
    await AsyncStorage.setItem(KEY, "1");
    await loadHapticsPreference();
    haptics.success();
    expect(ios).not.toHaveBeenCalled();
  });

  it("turning it back on deletes the stored choice and gives one tick", async () => {
    await setHapticsEnabled(false);
    await setHapticsEnabled(true);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(iosSelection).toHaveBeenCalledTimes(1);
  });
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LargeSecureStore } from "../secureStorage";

const mockKeychain = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async (k: string, v: string) => void mockKeychain.set(k, v)),
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeychain.delete(k)),
}));
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) =>
    Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)),
}));

const SESSION = JSON.stringify({ access_token: "secret-token", user: { id: "u1" } });

beforeEach(async () => {
  mockKeychain.clear();
  await AsyncStorage.clear();
});

describe("LargeSecureStore", () => {
  it("round-trips a session", async () => {
    const store = new LargeSecureStore();
    await store.setItem("sb-auth", SESSION);
    await expect(store.getItem("sb-auth")).resolves.toBe(SESSION);
  });

  it("never writes the token in plain text to AsyncStorage", async () => {
    await new LargeSecureStore().setItem("sb-auth", SESSION);
    const raw = await AsyncStorage.getItem("sb-auth");
    expect(raw).not.toContain("secret-token");
    expect(raw).toMatch(/^[0-9a-f]+$/);
  });

  it("uses a fresh key on every write", async () => {
    const store = new LargeSecureStore();
    await store.setItem("sb-auth", SESSION);
    const first = mockKeychain.get("sb-auth");
    await store.setItem("sb-auth", SESSION);
    expect(mockKeychain.get("sb-auth")).not.toBe(first);
    await expect(store.getItem("sb-auth")).resolves.toBe(SESSION);
  });

  it("reads as signed out without its key (e.g. restored backup)", async () => {
    await new LargeSecureStore().setItem("sb-auth", SESSION);
    mockKeychain.clear();
    await expect(new LargeSecureStore().getItem("sb-auth")).resolves.toBeNull();
  });

  it("removes both halves", async () => {
    const store = new LargeSecureStore();
    await store.setItem("sb-auth", SESSION);
    await store.removeItem("sb-auth");
    expect(mockKeychain.has("sb-auth")).toBe(false);
    await expect(AsyncStorage.getItem("sb-auth")).resolves.toBeNull();
  });
});

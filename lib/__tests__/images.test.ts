import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import {
  ImageValidationError,
  MAX_UPLOAD_BYTES,
  pickImages,
  signedImageUrls,
  uploadImage,
} from "../images";
import { supabase } from "../supabase";

jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000000" }));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: jest.fn() },
}));

const upload = jest.fn();
const createSignedUrls = jest.fn();
jest.mock("../supabase", () => ({
  supabase: { storage: { from: jest.fn() } },
}));

const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
const manipulate = ImageManipulator.manipulate as jest.Mock;
let context: { crop: jest.Mock; resize: jest.Mock; renderAsync: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  context = {
    crop: jest.fn(),
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue({
      saveAsync: jest.fn().mockResolvedValue({ uri: "file://out.jpg", width: 800, height: 600 }),
    }),
  };
  manipulate.mockReturnValue(context);
  (supabase.storage.from as jest.Mock).mockReturnValue({ upload, createSignedUrls });
});

const asset = (overrides: Partial<ImagePicker.ImagePickerAsset> = {}) => ({
  uri: "file://in.heic",
  width: 4000,
  height: 3000,
  mimeType: "image/jpeg",
  fileSize: 3_000_000,
  ...overrides,
});

describe("pickImages", () => {
  it("returns nothing when the picker is cancelled", async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickImages()).resolves.toEqual([]);
  });

  it("resizes large photos to fit 1600px and re-encodes as JPEG", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset()] });
    const [image] = await pickImages();
    expect(context.resize).toHaveBeenCalledWith({ width: 1600 });
    expect(image).toEqual({ uri: "file://out.jpg", width: 800, height: 600 });
  });

  it("fits portrait photos by height", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset({ width: 3000, height: 4000 })] });
    await pickImages();
    expect(context.resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it("centre-crops and shrinks avatars to a square", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset()] });
    await pickImages({ square: true });
    expect(context.crop).toHaveBeenCalledWith({
      originX: 500,
      originY: 0,
      width: 3000,
      height: 3000,
    });
    expect(context.resize).toHaveBeenCalledWith({ width: 800, height: 800 });
  });

  it("leaves small images at their size", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset({ width: 800, height: 600 })] });
    await pickImages();
    expect(context.resize).not.toHaveBeenCalled();
  });

  it.each([
    [{ mimeType: "application/pdf" }, /isn't an image/],
    [{ mimeType: "image/gif" }, /GIFs and SVGs/],
    [{ mimeType: "image/svg+xml" }, /GIFs and SVGs/],
    [{ fileSize: 30 * 1024 * 1024 }, /under 25 MB/],
  ])("rejects %p", async (overrides, message) => {
    launch.mockResolvedValue({ canceled: false, assets: [asset(overrides)] });
    await expect(pickImages()).rejects.toThrow(message);
    await expect(pickImages()).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("caps how many can be picked and passes the limit to the picker", async () => {
    launch.mockResolvedValue({ canceled: false, assets: [asset(), asset(), asset()] });
    const images = await pickImages({ limit: 2 });
    expect(images).toHaveLength(2);
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 2, exif: false }),
    );
  });

  it("doesn't open the picker when no slots are left", async () => {
    await expect(pickImages({ limit: 0 })).resolves.toEqual([]);
    expect(launch).not.toHaveBeenCalled();
  });
});

describe("uploadImage", () => {
  const image = { uri: "file://out.jpg", width: 10, height: 10 };
  const mockFetch = (bytes: number) => {
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
    }) as unknown as typeof fetch;
  };

  it("uploads into the given folder with a random JPEG name", async () => {
    mockFetch(1000);
    upload.mockResolvedValue({ error: null });
    const path = await uploadImage("avatars", "user-1", image);
    expect(path).toBe("user-1/00000000-0000-4000-8000-000000000000.jpg");
    expect(upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: "image/jpeg",
      upsert: false,
    });
  });

  it("refuses files still over the limit after compression", async () => {
    mockFetch(MAX_UPLOAD_BYTES + 1);
    await expect(uploadImage("avatars", "user-1", image)).rejects.toThrow(/over 5 MB/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("propagates storage errors", async () => {
    mockFetch(1000);
    upload.mockResolvedValue({ error: new Error("new row violates row-level security policy") });
    await expect(uploadImage("avatars", "user-1", image)).rejects.toThrow(/row-level security/);
  });
});

describe("signedImageUrls", () => {
  it("batches paths into one request and maps them by path", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "a.jpg", signedUrl: "https://signed/a" },
        { path: "b.jpg", signedUrl: null },
      ],
      error: null,
    });
    await expect(signedImageUrls(["a.jpg", "b.jpg"])).resolves.toEqual({
      "a.jpg": "https://signed/a",
    });
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("skips the request for an empty list", async () => {
    await expect(signedImageUrls([])).resolves.toEqual({});
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

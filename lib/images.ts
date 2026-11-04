import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

// Mirrors the bucket limits in supabase/migrations/*_images_and_content_rules.sql.
// Storage enforces them server-side; these checks just fail fast with a
// clear message instead of an upload error.
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Originals above this are rejected before we even try to resize - phones
// produce 3-12MB photos, so this only catches genuinely odd files.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type ImageBucket = "avatars" | "portfolio" | "listing-images" | "application-attachments";

/** A picked image, already resized/compressed and ready to upload. */
export type PreparedImage = {
  uri: string;
  width: number;
  height: number;
};

export class ImageValidationError extends Error {}

function checkSource(asset: ImagePicker.ImagePickerAsset) {
  const type = asset.mimeType?.toLowerCase();
  // HEIC from iPhones is fine: it's re-encoded to JPEG below. Anything that
  // isn't an image at all (or a GIF/SVG on web) is turned away.
  if (type && !type.startsWith("image/")) {
    throw new ImageValidationError("That file isn't an image. Choose a photo instead.");
  }
  if (type && (type === "image/gif" || type === "image/svg+xml")) {
    throw new ImageValidationError("GIFs and SVGs aren't supported. Use a JPEG, PNG or WebP.");
  }
  if (asset.fileSize && asset.fileSize > MAX_SOURCE_BYTES) {
    throw new ImageValidationError("That image is too large. Choose one under 25 MB.");
  }
}

/** Resize to fit 1600px and re-encode as JPEG - strips EXIF (incl. GPS) too. */
async function prepare(
  asset: ImagePicker.ImagePickerAsset,
  square: boolean,
): Promise<PreparedImage> {
  checkSource(asset);
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (square) {
    const side = Math.min(asset.width, asset.height);
    context.crop({
      originX: (asset.width - side) / 2,
      originY: (asset.height - side) / 2,
      width: side,
      height: side,
    });
    if (side > 800) context.resize({ width: 800, height: 800 });
  } else if (longest > MAX_DIMENSION) {
    context.resize(
      asset.width >= asset.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION },
    );
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Opens the photo library and returns prepared images (empty if cancelled).
 * `square` centre-crops, for avatars.
 */
export async function pickImages({
  limit = 1,
  square = false,
}: { limit?: number; square?: boolean } = {}): Promise<PreparedImage[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, limit).map((asset) => prepare(asset, square)));
}

/** Uploads into the caller's own folder: `<userId>/[...subfolders/]<uuid>.jpg`. */
export async function uploadImage(
  bucket: ImageBucket,
  folder: string,
  image: PreparedImage,
): Promise<string> {
  const body = await (await fetch(image.uri)).arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("That image is still over 5 MB after compressing. Try another.");
  }
  const path = `${folder}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function removeImages(bucket: ImageBucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

export function publicImageUrl(
  bucket: Exclude<ImageBucket, "application-attachments">,
  path: string,
) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Private bucket: short-lived signed URLs, batched into one request. */
export async function signedImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("application-attachments")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }
  return urls;
}

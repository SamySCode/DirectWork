import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { supabase } from "./supabase";

// Mirrors the bucket limits in supabase/migrations/*_images_and_content_rules.sql.
// Storage enforces them server-side; these checks just fail fast with a
// clear message instead of an upload error.
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// Bucket file_size_limit (2 MB). A 1600px JPEG at 0.8 is usually well
// under; busy, detailed photos get re-encoded at the lower steps below.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const FIRST_QUALITY = 0.8;
const FALLBACK_QUALITIES = [0.65, 0.5] as const;
// Originals above this are rejected before we even try to resize - phones
// produce 3-12MB photos, so this only catches genuinely odd files.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 1600;

// A small JPEG is uploaded next to every public image and shown wherever the
// slot is small (list cards, gallery tiles, avatars): a 1600px cover in a
// 140px slot was ~10x the bytes it needed, and images are most of our egress.
// Made on the device because Supabase image transformations are billed.
// Longest edge in px; private attachments are only ever opened full size.
const THUMBNAIL_SIZE: Partial<Record<ImageBucket, number>> = {
  avatars: 160,
  portfolio: 480,
  "listing-images": 480,
};
const THUMBNAIL_QUALITY = 0.6;
const IMAGE_EXTENSION = /\.(jpg|jpeg|png|webp)$/;
const THUMBNAIL_SUFFIX = ".thumb.jpg";

/**
 * Where an image's thumbnail lives: `<uuid>.jpg` -> `<uuid>.thumb.jpg`, same
 * folder (works on a storage path or its public URL). The database knows the
 * same rule - supabase/migrations/20261111090000_thumbnails.sql - so file
 * caps, the cleanup queue and the storage policies cover both files.
 */
export function thumbnailPath(path: string): string {
  if (path.endsWith(THUMBNAIL_SUFFIX)) return path;
  return path.replace(IMAGE_EXTENSION, THUMBNAIL_SUFFIX);
}

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
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: FIRST_QUALITY });
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

const readBytes = async (uri: string) => (await fetch(uri)).arrayBuffer();

/**
 * The prepared JPEG's bytes, re-encoded at lower quality steps only when it's
 * over the limit - most photos never pay for the extra encode.
 */
async function fitUploadLimit(image: PreparedImage): Promise<ArrayBuffer> {
  let body = await readBytes(image.uri);
  for (const compress of FALLBACK_QUALITIES) {
    if (body.byteLength <= MAX_UPLOAD_BYTES) return body;
    const rendered = await ImageManipulator.manipulate(image.uri).renderAsync();
    const smaller = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
    body = await readBytes(smaller.uri);
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("That image is still over 2 MB after compressing. Try another.");
  }
  return body;
}

async function renderThumbnail(image: PreparedImage, size: number): Promise<ArrayBuffer> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > size) {
    context.resize(image.width >= image.height ? { width: size } : { height: size });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: THUMBNAIL_QUALITY });
  return readBytes(saved.uri);
}

/**
 * Uploads into the caller's own folder: `<userId>/[...subfolders/]<uuid>.jpg`,
 * then its thumbnail beside it (public buckets only).
 */
export async function uploadImage(
  bucket: ImageBucket,
  folder: string,
  image: PreparedImage,
): Promise<string> {
  const body = await fitUploadLimit(image);
  const path = `${folder}/${Crypto.randomUUID()}.jpg`;
  // Keep Storage's default 1-hour cache. A longer one would cut egress, but
  // deleted photos (removed images, deleted accounts) would stay reachable
  // from CDN and browser caches until it expired.
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const size = THUMBNAIL_SIZE[bucket];
  if (size) {
    // Best effort, after the full image (the storage policy requires it to
    // exist first). If this fails the image still works everywhere: readers
    // fall back to the full file - see useThumbnailSource().
    try {
      const thumbnail = await renderThumbnail(image, size);
      await supabase.storage
        .from(bucket)
        .upload(thumbnailPath(path), thumbnail, { contentType: "image/jpeg", upsert: false });
    } catch {
      // Ignored on purpose.
    }
  }
  return path;
}

export async function removeImages(bucket: ImageBucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Thumbnails go with their images (removing one that was never made is a no-op).
  const all = THUMBNAIL_SIZE[bucket] ? paths.flatMap((path) => [path, thumbnailPath(path)]) : paths;
  const { error } = await supabase.storage.from(bucket).remove(all);
  if (error) throw error;
}

export function publicImageUrl(
  bucket: Exclude<ImageBucket, "application-attachments">,
  path: string,
) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Thumbnails that failed to load this session: images uploaded before
// thumbnails existed, or whose thumbnail upload failed. Remembered so each
// one costs a single 404, not one per render.
const missingThumbnails = new Set<string>();

/**
 * Props for an expo-image `<Image>` in a small slot: loads the thumbnail and
 * switches to the full image if there isn't one. Spread onto the Image:
 * `<Image {...useThumbnailSource(url)} />`.
 */
export function useThumbnailSource(uri: string, cacheKey?: string) {
  // Remote public images only: a just-picked local file has no thumbnail.
  const thumbnail = uri.startsWith("http") ? thumbnailPath(uri) : uri;
  const [failed, setFailed] = useState<string | null>(null);
  const useThumbnail =
    thumbnail !== uri && failed !== thumbnail && !missingThumbnails.has(thumbnail);
  return {
    source: useThumbnail ? { uri: thumbnail } : cacheKey ? { uri, cacheKey } : { uri },
    onError: useThumbnail
      ? () => {
          missingThumbnails.add(thumbnail);
          setFailed(thumbnail);
        }
      : undefined,
  };
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

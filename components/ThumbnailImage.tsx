import { Image, ImageProps } from "expo-image";
import { useThumbnailSource } from "../lib/images";

type ThumbnailImageProps = Omit<ImageProps, "source" | "onError"> & {
  /** The full image's URL; its thumbnail is loaded instead when there is one. */
  uri: string;
  /** Stable cache key for a URL that changes (signed URLs). */
  cacheKey?: string;
};

/**
 * An image in a small slot (card cover, gallery tile, avatar). Loads the
 * small thumbnail uploaded next to the image and falls back to the full
 * file for images that have none. Use a plain expo-image for full-size views.
 */
export function ThumbnailImage({ uri, cacheKey, ...props }: ThumbnailImageProps) {
  return (
    <Image
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      // Lists reuse views: without this a recycled card shows the last image
      // until the new one loads.
      recyclingKey={uri}
      {...props}
      {...useThumbnailSource(uri, cacheKey)}
    />
  );
}

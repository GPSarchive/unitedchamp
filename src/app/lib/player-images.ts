// app/lib/player-images.ts
import { imageConfig, ImageType } from './image-config';

/**
 * @deprecated Use OptimizedImage component instead
 * This is kept for backward compatibility
 */
export function resolvePlayerPhotoUrl(input?: string | null): string {
  return imageConfig.resolve(input, ImageType.PLAYER) || "/player-placeholder.jpg";
}

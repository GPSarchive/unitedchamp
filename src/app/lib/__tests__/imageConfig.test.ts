import { describe, it, expect } from "vitest";
import { isPlaceholderPhoto, resolveImageUrl, ImageType } from "../image-config";

describe("placeholder photos", () => {
  it("treats every stored placeholder variant as 'no photo'", () => {
    // 814 players carry the legacy .jpg value, the rest the .svg one.
    expect(isPlaceholderPhoto("/player-placeholder.jpg")).toBe(true);
    expect(isPlaceholderPhoto("/player-placeholder.svg")).toBe(true);
    expect(isPlaceholderPhoto("player-placeholder.jpg")).toBe(true);
    expect(isPlaceholderPhoto("/team-placeholder.svg")).toBe(true);
    expect(isPlaceholderPhoto(null)).toBe(true);
    expect(isPlaceholderPhoto("")).toBe(true);
  });

  it("keeps real photos", () => {
    expect(isPlaceholderPhoto("/players/123/photo.jpg")).toBe(false);
    expect(isPlaceholderPhoto("https://images.ultrachamp.gr/players/s/1.webp")).toBe(false);
  });

  it("resolves placeholders to the local /public files, never to storage", () => {
    expect(resolveImageUrl("/player-placeholder.jpg", ImageType.PLAYER)).toBe("/player-placeholder.svg");
    expect(resolveImageUrl("/player-placeholder.svg", ImageType.PLAYER)).toBe("/player-placeholder.svg");
    expect(resolveImageUrl("/team-placeholder.svg", ImageType.TEAM)).toBe("/team-placeholder.svg");
    expect(resolveImageUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});

import { describe, it, expect } from "vitest";
import { ageFromBirthDate } from "../playerAge";

describe("ageFromBirthDate", () => {
  const today = "2026-09-05";

  it("returns null for missing or malformed input", () => {
    expect(ageFromBirthDate(null, today)).toBeNull();
    expect(ageFromBirthDate(undefined, today)).toBeNull();
    expect(ageFromBirthDate("", today)).toBeNull();
    expect(ageFromBirthDate("abc", today)).toBeNull();
    expect(ageFromBirthDate("2000-13-01", today)).toBeNull();
  });

  it("counts whole years, birthday included", () => {
    expect(ageFromBirthDate("2000-09-05", today)).toBe(26);
    expect(ageFromBirthDate("2000-09-06", today)).toBe(25);
    expect(ageFromBirthDate("2000-01-01", today)).toBe(26);
    expect(ageFromBirthDate("2000-12-31", today)).toBe(25);
  });

  it("accepts a timestamp and reads only the date part", () => {
    expect(ageFromBirthDate("2000-09-05T23:59:59+03:00", today)).toBe(26);
  });

  it("rejects future and implausible dates", () => {
    expect(ageFromBirthDate("2027-01-01", today)).toBeNull();
    expect(ageFromBirthDate("1800-01-01", today)).toBeNull();
  });
});

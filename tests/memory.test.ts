import { describe, expect, it } from "vitest";
import {
  effectiveMaxMemoryMb,
  getMemoryInfo,
  isValidMaxMemoryMb,
  maxAllowedMemoryMb,
  recommendedMaxMemoryMb,
} from "../src/main/utils/memory";

const GB = 1024;

describe("game memory limits", () => {
  it("recommends a quarter of RAM between 2 GB and 4 GB", () => {
    expect(recommendedMaxMemoryMb(4 * GB)).toBe(2048);
    expect(recommendedMaxMemoryMb(8 * GB)).toBe(2048);
    expect(recommendedMaxMemoryMb(12 * GB)).toBe(3072);
    expect(recommendedMaxMemoryMb(16 * GB)).toBe(4096);
    expect(recommendedMaxMemoryMb(64 * GB)).toBe(4096);
  });

  it("never recommends more than the PC can spare", () => {
    expect(recommendedMaxMemoryMb(3 * GB)).toBe(1024);
  });

  it("leaves 2 GB for the system", () => {
    expect(maxAllowedMemoryMb(16 * GB)).toBe(14 * GB);
    expect(maxAllowedMemoryMb(2 * GB)).toBe(1024);
  });

  it("accepts only whole 512 MB steps inside the allowed range", () => {
    const total = 16 * GB;
    expect(isValidMaxMemoryMb(4096, total)).toBe(true);
    expect(isValidMaxMemoryMb(4608, total)).toBe(true);
    expect(isValidMaxMemoryMb(1024, total)).toBe(true);
    expect(isValidMaxMemoryMb(512, total)).toBe(false);
    expect(isValidMaxMemoryMb(4000, total)).toBe(false);
    expect(isValidMaxMemoryMb(15 * GB, total)).toBe(false);
    expect(isValidMaxMemoryMb("4096", total)).toBe(false);
    expect(isValidMaxMemoryMb(4096.5, total)).toBe(false);
  });

  it("uses the recommended value when nothing is stored", () => {
    expect(effectiveMaxMemoryMb(undefined, 16 * GB)).toBe(4096);
  });

  it("clamps a stored value that no longer fits this PC", () => {
    expect(effectiveMaxMemoryMb(12 * GB, 8 * GB)).toBe(6 * GB);
    expect(effectiveMaxMemoryMb(256, 16 * GB)).toBe(1024);
  });

  it("reports memory info from total bytes", () => {
    const info = getMemoryInfo(6144, 16 * GB * 1024 * 1024);
    expect(info).toEqual({
      totalMb: 16 * GB,
      minMb: 1024,
      maxAllowedMb: 14 * GB,
      recommendedMb: 4096,
      maxMemoryMb: 6144,
    });
  });
});

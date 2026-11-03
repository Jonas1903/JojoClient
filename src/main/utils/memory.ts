// Game memory (-Xmx) limits, derived from the PC's total RAM.
// Pure functions so they can be unit-tested without Electron or a real machine.

export const MEMORY_STEP_MB = 512;
export const MIN_MAX_MEMORY_MB = 1024;
// Headroom left for Windows, the launcher and other apps.
const SYSTEM_RESERVE_MB = 2048;

export type MemoryInfo = {
  totalMb: number;
  minMb: number;
  maxAllowedMb: number;
  recommendedMb: number;
  maxMemoryMb: number;
};

function floorToStep(mb: number): number {
  return Math.floor(mb / MEMORY_STEP_MB) * MEMORY_STEP_MB;
}

export function maxAllowedMemoryMb(totalMb: number): number {
  return Math.max(MIN_MAX_MEMORY_MB, floorToStep(totalMb - SYSTEM_RESERVE_MB));
}

// A quarter of system RAM, between 2 GB and 4 GB. Enough for typical Fabric
// setups without starving 8 GB machines.
export function recommendedMaxMemoryMb(totalMb: number): number {
  const quarter = floorToStep(totalMb / 4);
  return Math.min(maxAllowedMemoryMb(totalMb), Math.max(2048, Math.min(4096, quarter)));
}

export function isValidMaxMemoryMb(value: unknown, totalMb: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value % MEMORY_STEP_MB === 0 &&
    value >= MIN_MAX_MEMORY_MB &&
    value <= maxAllowedMemoryMb(totalMb)
  );
}

// The value actually used for -Xmx. A stored value that no longer fits (e.g. the
// settings file moved to a PC with less RAM) is clamped instead of failing the launch.
export function effectiveMaxMemoryMb(stored: number | undefined, totalMb: number): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) {
    return recommendedMaxMemoryMb(totalMb);
  }
  const clamped = Math.min(maxAllowedMemoryMb(totalMb), Math.max(MIN_MAX_MEMORY_MB, stored));
  return Math.max(MIN_MAX_MEMORY_MB, floorToStep(clamped));
}

export function getMemoryInfo(stored: number | undefined, totalBytes: number): MemoryInfo {
  const totalMb = Math.floor(totalBytes / (1024 * 1024));
  return {
    totalMb,
    minMb: MIN_MAX_MEMORY_MB,
    maxAllowedMb: maxAllowedMemoryMb(totalMb),
    recommendedMb: recommendedMaxMemoryMb(totalMb),
    maxMemoryMb: effectiveMaxMemoryMb(stored, totalMb),
  };
}

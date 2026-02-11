const DURATION_UNITS = [
  { label: "year", seconds: 365 * 24 * 60 * 60 },
  { label: "day", seconds: 24 * 60 * 60 },
  { label: "hour", seconds: 60 * 60 },
  { label: "minute", seconds: 60 },
  { label: "second", seconds: 1 },
] as const;

export interface DurationFormatOptions {
  maximumFractionDigits?: number;
}

export function humanTimeDurationFormatter(
  durationSeconds: number,
  options: DurationFormatOptions = {},
): string {
  if (!Number.isFinite(durationSeconds)) {
    throw new Error("durationSeconds must be a finite number");
  }

  const maximumFractionDigits = options.maximumFractionDigits ?? 1;
  const sign = durationSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(durationSeconds);

  const selectedUnit =
    DURATION_UNITS.find((unit) => absoluteSeconds >= unit.seconds) ??
    DURATION_UNITS[DURATION_UNITS.length - 1];

  const value = absoluteSeconds / selectedUnit.seconds;
  const roundedValue = Number(value.toFixed(maximumFractionDigits));
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

  const unitLabel =
    roundedValue === 1 ? selectedUnit.label : `${selectedUnit.label}s`;
  return `${sign}${formatter.format(roundedValue)} ${unitLabel}`;
}

export function formatCount(value: number | undefined): string {
  return Intl.NumberFormat().format(value ?? 0);
}

export function formatCompactCount(value: number | undefined): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

export function formatDate(value: string | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString("en-US");
}

export function formatIsoTimestamp(value: string | undefined): string {
  if (!value) {
    return "Unknown timestamp";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}

export function formatDurationFromDays(valueDays: number | null): string {
  if (valueDays === null) {
    return "N/A";
  }

  return humanTimeDurationFormatter(valueDays * 24 * 60 * 60);
}

export function formatDurationFromHours(valueHours: number | null): string {
  if (valueHours === null) {
    return "N/A";
  }

  return humanTimeDurationFormatter(valueHours * 60 * 60);
}

export function formatRatio(value: number): string {
  if (!Number.isFinite(value)) {
    return "inf";
  }

  return value.toFixed(1).replace(/\.0$/, "");
}

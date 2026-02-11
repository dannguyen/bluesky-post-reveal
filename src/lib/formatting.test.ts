import { describe, expect, it } from "vitest";

import { humanTimeDurationFormatter } from "./formatting";

describe("humanTimeDurationFormatter", () => {
  it("formats into the largest matching unit", () => {
    expect(humanTimeDurationFormatter(320000)).toBe("3.7 days");
    expect(humanTimeDurationFormatter(30)).toBe("30 seconds");
    expect(humanTimeDurationFormatter(3600)).toBe("1 hour");
    expect(humanTimeDurationFormatter(60 * 60 * 24 * 400)).toBe("1.1 years");
  });

  it("handles negatives and zero", () => {
    expect(humanTimeDurationFormatter(0)).toBe("0 seconds");
    expect(humanTimeDurationFormatter(-90)).toBe("-1.5 minutes");
  });

  it("supports custom precision", () => {
    expect(
      humanTimeDurationFormatter(320000, { maximumFractionDigits: 2 }),
    ).toBe("3.7 days");
    expect(humanTimeDurationFormatter(90, { maximumFractionDigits: 0 })).toBe(
      "2 minutes",
    );
  });
});

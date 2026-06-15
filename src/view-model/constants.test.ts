// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

import { describe, expect, it } from "vitest";

import { AXIS_X_ROWS, AXIS_Y_ROWS, calculateScore, scoreToMaturitySignal } from "./constants.js";

describe("calculateScore", () => {
  it("returns 100 for a clean result", () => {
    expect(calculateScore({ errors: 0, warnings: 0, infos: 0 })).toBe(100);
  });

  it("applies weighted deductions", () => {
    expect(calculateScore({ errors: 1, warnings: 2, infos: 3 })).toBe(100 - 12 - 8 - 3);
  });

  it("clamps to the 0–100 range", () => {
    expect(calculateScore({ errors: 100, warnings: 0, infos: 0 })).toBe(0);
    expect(calculateScore({ errors: 0, warnings: 0, infos: 0 })).toBeLessThanOrEqual(100);
  });
});

describe("scoreToMaturitySignal", () => {
  it.each([
    [90, "excellent"],
    [85, "excellent"],
    [70, "good"],
    [50, "fair"],
    [30, "poor"],
    [0, "critical"],
  ] as const)("maps score %i to %s", (score, expected) => {
    expect(scoreToMaturitySignal(score)).toBe(expected);
  });
});

describe("axis rows", () => {
  it("cover every rendered axis-Y and axis-X classification once", () => {
    expect(AXIS_Y_ROWS.map((r) => r.key)).toEqual([
      "fullyDeterministic",
      "policyDependent",
      "runtimeBound",
    ]);
    expect(AXIS_X_ROWS.map((r) => r.key)).toEqual([
      "selfContained",
      "profileScoped",
      "engineSpecific",
      "externalCoupled",
    ]);
  });
});

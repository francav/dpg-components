// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Framework-neutral presentation constants and scoring helpers shared by the
 * L3 components. No UI framework or DOM dependency.
 */

import type { AxisXClassification, AxisYClassification, MaturitySignal } from "./types.js";

/** Degradation flags surfaced on the analysis summary. */
export const ANALYSIS_FLAGS = {
  policyDefault: "policy-default",
  runtimeBound: "runtime-bound",
} as const;

export const AXIS_SECTION_LABELS = {
  axisY: "Determinism · Axis Y",
  axisX: "Coupling · Axis X",
} as const;

export interface AxisRow<TKey extends string> {
  readonly key: TKey;
  readonly label: string;
  readonly color: string;
}

export const AXIS_Y_ROWS: ReadonlyArray<AxisRow<AxisYClassification>> = [
  { key: "fullyDeterministic", label: "FD", color: "#22c55e" },
  { key: "policyDependent", label: "PD", color: "#eab308" },
  { key: "runtimeBound", label: "RB", color: "#f97316" },
] as const;

export const AXIS_X_ROWS: ReadonlyArray<AxisRow<AxisXClassification>> = [
  { key: "selfContained", label: "SC", color: "#9ca3af" },
  { key: "profileScoped", label: "PS", color: "#3b82f6" },
  { key: "engineSpecific", label: "ES", color: "#a855f7" },
  { key: "externalCoupled", label: "EC", color: "#ef4444" },
] as const;

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface ScoreCounts {
  errors: number;
  warnings: number;
  infos: number;
}

/** Weighted governance score clamped to the 0–100 range. */
export function calculateScore({ errors, warnings, infos }: ScoreCounts): number {
  return Math.max(0, Math.min(100, 100 - errors * 12 - warnings * 4 - infos));
}

/** Bucket a 0–100 score into a maturity signal band. */
export function scoreToMaturitySignal(score: number): MaturitySignal {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  if (score >= 30) return "poor";
  return "critical";
}

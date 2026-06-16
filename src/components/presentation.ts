// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Shared presentation metadata for the L3 components: per-classification labels,
 * colors, and severity vocabulary. Framework-neutral — pure data, no DOM.
 *
 * Mined and rebuilt from the modeler panels' inline maps so every component
 * renders the same axis vocabulary and color band.
 */

import type {
  AxisXClassification,
  AxisYClassification,
  FindingSeverity,
  MaturitySignal,
} from "../view-model/types.js";

export interface AxisYInfo {
  readonly label: string;
  readonly short: string;
  readonly color: string;
  readonly description: string;
  readonly score: number;
  readonly riskLevel: string;
}

export const AXIS_Y_INFO: Record<AxisYClassification, AxisYInfo> = {
  fullyDeterministic: {
    label: "Fully Deterministic",
    short: "Fully Det.",
    color: "#10b981",
    description: "Behavior is fully predictable from the process definition.",
    score: 100,
    riskLevel: "Low",
  },
  policyDependent: {
    label: "Policy-Dependent",
    short: "Policy-Dep.",
    color: "#f59e0b",
    description: "Behavior depends on policy configuration.",
    score: 65,
    riskLevel: "Medium",
  },
  runtimeBound: {
    label: "Runtime-Bound",
    short: "Runtime-Bound",
    color: "#ef4444",
    description: "Behavior depends on runtime environment state.",
    score: 30,
    riskLevel: "High",
  },
  nonDeterministic: {
    label: "Non-Deterministic",
    short: "Non-Det.",
    color: "#7f1d1d",
    description: "Same input can yield different outputs (e.g. a human task).",
    score: 10,
    riskLevel: "Critical",
  },
  unknown: {
    label: "Unknown",
    short: "Unknown",
    color: "#6b7280",
    description: "Determinism could not be established (e.g. a call activity).",
    score: 25,
    riskLevel: "Unknown",
  },
};

export interface AxisXInfo {
  readonly label: string;
  readonly short: string;
  readonly color: string;
  readonly description: string;
  readonly score: number;
  readonly portabilityLevel: string;
}

export const AXIS_X_INFO: Record<AxisXClassification, AxisXInfo> = {
  selfContained: {
    label: "Self-Contained",
    short: "Self-Cont.",
    color: "#10b981",
    description: "No external dependencies.",
    score: 100,
    portabilityLevel: "Excellent",
  },
  profileScoped: {
    label: "Profile-Scoped",
    short: "Profile-Sc.",
    color: "#3b82f6",
    description: "Depends on runtime profile configuration.",
    score: 70,
    portabilityLevel: "Good",
  },
  engineSpecific: {
    label: "Engine-Specific",
    short: "Engine-Sp.",
    color: "#a855f7",
    description: "Tied to a specific engine implementation.",
    score: 45,
    portabilityLevel: "Limited",
  },
  externalCoupled: {
    label: "External-Coupled",
    short: "External-C.",
    color: "#ef4444",
    description: "Depends on external systems or services.",
    score: 20,
    portabilityLevel: "Poor",
  },
};

export const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

export const MATURITY_COLOR: Record<MaturitySignal, string> = {
  excellent: "#10b981",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#f97316",
  critical: "#ef4444",
};

/**
 * Per-element governance score: determinism weighted 60%, coupling 40%.
 * Mirrors the per-element scoring used by the source modeler's element view.
 */
export function elementGovernanceScore(
  axisY: AxisYClassification,
  axisX: AxisXClassification,
): number {
  return Math.round(AXIS_Y_INFO[axisY].score * 0.6 + AXIS_X_INFO[axisX].score * 0.4);
}

export function scoreColor(score: number | null): string {
  if (score === null) return "#9ca3af";
  if (score >= 85) return MATURITY_COLOR.excellent;
  if (score >= 70) return MATURITY_COLOR.good;
  if (score >= 50) return MATURITY_COLOR.fair;
  if (score >= 30) return MATURITY_COLOR.poor;
  return MATURITY_COLOR.critical;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Framework-neutral view-model types for @francav/components.
 *
 * These describe the shape the L3 components render. They are deliberately
 * decoupled from any UI framework (no React, no DOM) and from the compiler
 * package: the adapter ({@link ./compilerAdapter}) maps a compiler result onto
 * this view-model.
 */

// ── Axis classifications (view-model vocabulary) ──────────────────────────────

/** Axis Y — behavioral determinism, collapsed to the three rendered rows. */
export type AxisYClassification = "fullyDeterministic" | "policyDependent" | "runtimeBound";

/** Axis X — runtime coupling, collapsed to the four rendered rows. */
export type AxisXClassification =
  | "selfContained"
  | "profileScoped"
  | "engineSpecific"
  | "externalCoupled";

// ── Maturity signal ───────────────────────────────────────────────────────────

export type MaturitySignal = "excellent" | "good" | "fair" | "poor" | "critical";

// ── Findings ──────────────────────────────────────────────────────────────────

export type FindingSeverity = "error" | "warning" | "info";

export type FindingCategory = "policy" | "structural" | "runtime";

export interface Finding {
  id: string;
  elementId?: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  message: string;
  policyId: string;
  recommendation: string;
}

// ── Determinism map entry ─────────────────────────────────────────────────────

export interface DeterminismEntry {
  axisY: AxisYClassification;
  axisX: AxisXClassification;
  rationale: string;
}

// ── Runtime dependency / contract types ───────────────────────────────────────

export interface ContractDescriptor {
  name: string;
  type: string;
  owner: string;
  status: "documented" | "undocumented" | "partial";
}

export interface RuntimeDependencyEntry {
  contracts: ContractDescriptor[];
}

// ── Recommendation card ───────────────────────────────────────────────────────

export interface RecommendationCard {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
}

// ── Matrix counts ─────────────────────────────────────────────────────────────

export interface AxisYCounts {
  fullyDeterministic: number;
  policyDependent: number;
  runtimeBound: number;
}

export interface AxisXCounts {
  selfContained: number;
  profileScoped: number;
  engineSpecific: number;
  externalCoupled: number;
}

// ── Top-level analysis view-model ─────────────────────────────────────────────

export interface AnalysisResult {
  process: { id: string; name: string };
  summary: {
    maturitySignal: MaturitySignal | null;
    score: number | null;
    structuralFindings: number;
    semanticFindings: number;
    contractCoverageRatio: number;
    degradedFlags: string[];
  };
  matrix: {
    axisY: AxisYCounts;
    axisX: AxisXCounts;
  };
  findings: Finding[];
  determinismMap: Record<string, DeterminismEntry>;
  runtimeDependencyMap: Record<string, RuntimeDependencyEntry>;
  recommendations: RecommendationCard[];
}

// ── Diagram element index input ───────────────────────────────────────────────

/**
 * The only diagram detail the adapter needs: the set of canonical element ids.
 * Supplying a diagram lets the adapter reconcile the compiler's evaluation-point
 * ids (which may be namespace-prefixed) against the diagram's element ids.
 *
 * Kept structural on purpose so any diagram model with `{ elements: [{ id }] }`
 * satisfies it without pulling in a full BPMN domain model.
 */
export interface DiagramElementRef {
  id: string;
}

export interface DiagramElementIndex {
  elements: ReadonlyArray<DiagramElementRef>;
}

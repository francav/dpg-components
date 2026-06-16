// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * compilerAdapter — maps a compiler result onto the framework-neutral
 * {@link AnalysisResult} view-model the L3 components render.
 *
 * Pure TypeScript: no React, no DOM, no compiler-package import (it consumes the
 * structural {@link CompilerResultInput} boundary instead).
 */

import { AXIS_X_INFO, AXIS_Y_INFO } from "../components/presentation.js";
import { ANALYSIS_FLAGS, scoreToMaturitySignal } from "./constants.js";
import type {
  CompilerAxisX,
  CompilerAxisY,
  CompilerFindingInput,
  CompilerMaturitySignalInput,
  CompilerResultInput,
} from "./compilerResult.js";
import type {
  AnalysisResult,
  AxisXCounts,
  AxisXClassification,
  AxisYCounts,
  AxisYClassification,
  DeterminismEntry,
  DiagramElementIndex,
  Finding,
  MaturitySignal,
  RecommendationCard,
  RuntimeDependencyEntry,
} from "./types.js";

// ── Axis mappings ─────────────────────────────────────────────────────────────

function mapAxisY(y: CompilerAxisY): AxisYClassification {
  if (y === "deterministic") return "fullyDeterministic";
  if (y === "policyDependent") return "policyDependent";
  if (y === "runtimeBound") return "runtimeBound";
  // nonDeterministic / unknown — treat as worst-case
  return "runtimeBound";
}

function mapAxisX(x: CompilerAxisX): AxisXClassification {
  if (x === "engineAgnostic") return "selfContained";
  if (x === "profileScoped") return "profileScoped";
  if (x === "engineSpecific") return "engineSpecific";
  if (x === "externalized") return "externalCoupled";
  // unknown — treat as self-contained (optimistic default)
  return "selfContained";
}

// ── Finding mapping ───────────────────────────────────────────────────────────

function mapFinding(f: CompilerFindingInput, index: string | number): Finding {
  const category: Finding["category"] =
    f.category === "structural" || f.category === "ingestion" ? "structural" : "policy";

  return {
    id: f.id ? `${f.id}-${index}` : `finding-${index}`,
    elementId: f.targetId,
    severity: f.severity,
    category,
    title: f.ruleId,
    message: f.message,
    policyId: f.policyClause ?? "",
    recommendation: f.remediation ?? "",
  };
}

// ── Element-id reconciliation ─────────────────────────────────────────────────

function normalizeRawId(rawId: string): string {
  const parts = rawId.split(/[:/#]/);
  return parts[parts.length - 1] || rawId;
}

interface ElementIdResolver {
  resolve(evaluationPointId: string): string | null;
}

function buildElementIdResolver(diagram?: DiagramElementIndex): ElementIdResolver {
  const elementIdSet = new Set<string>();
  const elementIdAliases = new Map<string, string>();

  function addAlias(alias: string, canonicalId: string): void {
    if (!alias) return;
    if (!elementIdAliases.has(alias)) {
      elementIdAliases.set(alias, canonicalId);
    }
  }

  if (diagram) {
    for (const element of diagram.elements) {
      elementIdSet.add(element.id);
      addAlias(element.id, element.id);
      addAlias(element.id.toLowerCase(), element.id);

      const normalized = normalizeRawId(element.id);
      addAlias(normalized, element.id);
      addAlias(normalized.toLowerCase(), element.id);
    }
  }

  return {
    resolve(evaluationPointId: string): string | null {
      // No diagram supplied: trust the compiler's evaluation-point id as-is.
      if (!diagram) return evaluationPointId;

      if (elementIdSet.has(evaluationPointId)) {
        return evaluationPointId;
      }

      const direct = elementIdAliases.get(evaluationPointId);
      if (direct) return direct;

      const normalized = normalizeRawId(evaluationPointId);
      const viaNormalized =
        elementIdAliases.get(normalized) ||
        elementIdAliases.get(normalized.toLowerCase()) ||
        elementIdAliases.get(evaluationPointId.toLowerCase());

      return viaNormalized ?? null;
    },
  };
}

// ── Score / maturity derivation ───────────────────────────────────────────────

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Resolve the process-level governance score (0–100).
 *
 * Prefers the compiler's real `summary.maturitySignal`: its `deterministicTotal`
 * and `portableTotal` are already percentages, so the score is a 60/40 blend of
 * determinism and portability — no fabrication. Only when the compiler provides
 * no usable signal does it fall back to averaging the mapped matrix entries via
 * the existing AXIS_* score weights. Returns `null` when neither is available
 * (the badge renders "N/A" gracefully).
 */
function deriveScore(
  signal: CompilerMaturitySignalInput | undefined,
  determinismMap: Record<string, DeterminismEntry>,
): number | null {
  if (
    signal &&
    typeof signal.deterministicTotal === "number" &&
    typeof signal.portableTotal === "number"
  ) {
    return clampScore(signal.deterministicTotal * 0.6 + signal.portableTotal * 0.4);
  }

  const entries = Object.values(determinismMap);
  if (entries.length === 0) return null;
  const sum = entries.reduce(
    (acc, e) => acc + AXIS_Y_INFO[e.axisY].score * 0.6 + AXIS_X_INFO[e.axisX].score * 0.4,
    0,
  );
  return clampScore(sum / entries.length);
}

const RECOMMENDATION_SEVERITY: Record<Finding["severity"], RecommendationCard["severity"]> = {
  error: "high",
  warning: "medium",
  info: "low",
};

const FINDING_RANK: Record<Finding["severity"], number> = { error: 0, warning: 1, info: 2 };

/**
 * Derive recommendation cards from the worst findings (errors first), preferring
 * each finding's own remediation text. Used only when the compiler carries no
 * recommendations of its own.
 */
function deriveRecommendations(findings: Finding[]): RecommendationCard[] {
  return [...findings]
    .sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity])
    .slice(0, 5)
    .map((f) => ({
      id: `rec-${f.id}`,
      severity: RECOMMENDATION_SEVERITY[f.severity],
      message: f.recommendation || f.message,
    }));
}

// ── Public mapper ─────────────────────────────────────────────────────────────

/**
 * Map a compiler result onto the {@link AnalysisResult} view-model.
 *
 * @param cr      The compiler result (structurally `@francav/compiler-core`'s
 *                `CompilerResult`).
 * @param diagram Optional element index. When supplied, evaluation-point ids are
 *                reconciled against the diagram's canonical element ids (and
 *                entries that cannot be matched are dropped). When omitted, the
 *                compiler's evaluation-point ids are used verbatim.
 */
export function mapCompilerResult(
  cr: CompilerResultInput,
  diagram?: DiagramElementIndex,
): AnalysisResult {
  const resolver = buildElementIdResolver(diagram);

  // Map findings — prefix the index to guarantee uniqueness across merged arrays.
  const allFindings: Finding[] = [
    ...cr.structuralFindings.map((f, i) => mapFinding(f, `s${i}`)),
    ...cr.semanticFindings.map((f, i) => mapFinding(f, `m${i}`)),
  ];

  // Map determinismMap (compiler: array keyed by evaluationPointId → record).
  const determinismMap: Record<string, DeterminismEntry> = {};
  for (const entry of cr.determinismMap) {
    const elementId = resolver.resolve(entry.evaluationPointId);
    if (!elementId) continue;

    determinismMap[elementId] = {
      axisY: mapAxisY(entry.axisY),
      axisX: mapAxisX(entry.axisX),
      rationale:
        `Policy: ${entry.policyClause}` +
        (entry.runtimeProfileSection ? ` · Profile: ${entry.runtimeProfileSection}` : ""),
    };
  }

  // Map runtimeDependencyMap.
  const runtimeDependencyMap: Record<string, RuntimeDependencyEntry> = {};
  for (const entry of cr.runtimeDependencyMap) {
    const elementId = resolver.resolve(entry.evaluationPointId);
    if (!elementId) continue;

    runtimeDependencyMap[elementId] = {
      contracts: [
        {
          name: entry.dependency,
          type: "Runtime",
          owner: "Profile",
          status:
            entry.profileCoverage === "documented"
              ? "documented"
              : entry.profileCoverage === "undocumented"
                ? "undocumented"
                : "partial",
        },
      ],
    };
  }

  // Matrix counts from the mapped determinismMap.
  const axisY: AxisYCounts = {
    fullyDeterministic: 0,
    policyDependent: 0,
    runtimeBound: 0,
  };
  const axisX: AxisXCounts = {
    selfContained: 0,
    profileScoped: 0,
    engineSpecific: 0,
    externalCoupled: 0,
  };
  for (const entry of Object.values(determinismMap)) {
    axisY[entry.axisY]++;
    axisX[entry.axisX]++;
  }

  const degradedFlags: string[] = [];
  if (cr.metadata.degraded) degradedFlags.push(ANALYSIS_FLAGS.policyDefault);
  if (axisY.runtimeBound > 0) degradedFlags.push(ANALYSIS_FLAGS.runtimeBound);

  // Prefer the compiler's real maturity signal; bucket the score into a band.
  const score = deriveScore(cr.summary.maturitySignal, determinismMap);
  const maturitySignal: MaturitySignal | null =
    score === null ? null : scoreToMaturitySignal(score);

  return {
    process: {
      id: cr.metadata.modelId,
      name: cr.metadata.modelId,
    },
    summary: {
      maturitySignal,
      score,
      structuralFindings: cr.summary.structuralErrors,
      semanticFindings: cr.summary.semanticErrors,
      contractCoverageRatio: cr.summary.contractCoverageRatio,
      degradedFlags,
    },
    matrix: { axisY, axisX },
    findings: allFindings,
    determinismMap,
    runtimeDependencyMap,
    recommendations: deriveRecommendations(allFindings),
  };
}

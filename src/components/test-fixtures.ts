// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Shared test fixture: a realistic compiler result mapped through the real
 * adapter, so the component tests render against the same view-model a consumer
 * would build from `@francav/compiler-core` output. Not part of the published API.
 */

import { mapCompilerResult } from "../view-model/compilerAdapter.js";
import type { CompilerResultInput } from "../view-model/compilerResult.js";
import type { AnalysisResult } from "../view-model/types.js";

/** A multi-element compiler result spanning every axis classification + severity. */
export const SAMPLE_COMPILER_RESULT: CompilerResultInput = {
  metadata: { modelId: "loan-preapproval", degraded: true },
  structuralFindings: [
    {
      id: "S1",
      category: "structural",
      severity: "error",
      message: "Service task has no implementation.",
      ruleId: "STRUCT_IMPL_MISSING",
      targetId: "ServiceTask_Score",
      policyClause: "baseline-tier-2#impl",
      remediation: "Bind an implementation or document the contract.",
    },
  ],
  semanticFindings: [
    {
      id: "M1",
      category: "semantic",
      severity: "warning",
      message: "Gateway condition depends on a runtime variable.",
      ruleId: "SEM_RUNTIME_BOUND",
      targetId: "Gateway_Approval",
      policyClause: "baseline-tier-2#det",
    },
    {
      id: "M2",
      category: "semantic",
      severity: "info",
      message: "Decision evaluated under the supplied profile.",
      ruleId: "SEM_PROFILE_NOTE",
      targetId: "BusinessRule_Decision",
    },
  ],
  determinismMap: [
    {
      evaluationPointId: "ServiceTask_Score",
      axisY: "policyDependent",
      axisX: "externalized",
      policyClause: "baseline-tier-2#impl",
    },
    {
      evaluationPointId: "Gateway_Approval",
      axisY: "runtimeBound",
      axisX: "engineSpecific",
      policyClause: "baseline-tier-2#det",
    },
    {
      evaluationPointId: "BusinessRule_Decision",
      axisY: "deterministic",
      axisX: "profileScoped",
      policyClause: "baseline-tier-2#dmn",
      runtimeProfileSection: "camunda-7/dmn",
    },
  ],
  runtimeDependencyMap: [
    {
      evaluationPointId: "ServiceTask_Score",
      dependency: "scoring-service",
      profileCoverage: "undocumented",
    },
  ],
  summary: {
    structuralErrors: 1,
    semanticErrors: 0,
    contractCoverageRatio: 0.5,
    // Real compiler maturity signal → the adapter derives score 64 ("fair")
    // from a 60/40 determinism/portability blend (60*0.6 + 70*0.4 = 64).
    maturitySignal: { deterministicTotal: 60, portableTotal: 70, totalEvaluationPoints: 3 },
  },
};

/**
 * Build the sample analysis view-model. The adapter now derives score 64 /
 * "fair" from the fixture's real `summary.maturitySignal`, so no host override
 * is needed (this exercises the real maturity/score passthrough end-to-end).
 */
export function sampleAnalysis(): AnalysisResult {
  return mapCompilerResult(SAMPLE_COMPILER_RESULT);
}

/**
 * A compiler result that exercises all five Axis-Y classes — including the two
 * the view-model surfaces distinctly after the F.2 fidelity fix: a human task
 * (`nonDeterministic`) and a call activity (`unknown`). Used by the matrix /
 * inspector tests to assert the new rows/bars render with the real labels and
 * are NOT collapsed into Runtime-Bound.
 */
export const FIVE_CLASS_COMPILER_RESULT: CompilerResultInput = {
  metadata: { modelId: "five-class", degraded: false },
  structuralFindings: [],
  semanticFindings: [
    {
      id: "H1",
      category: "semantic",
      severity: "warning",
      message: "Human task outcome is operator-decided.",
      ruleId: "SEM_HUMAN_TASK",
      targetId: "UserTask_Review",
    },
  ],
  determinismMap: [
    {
      evaluationPointId: "Task_Calc",
      axisY: "deterministic",
      axisX: "engineAgnostic",
      policyClause: "p#det",
    },
    {
      evaluationPointId: "Gateway_Branch",
      axisY: "policyDependent",
      axisX: "profileScoped",
      policyClause: "p#policy",
    },
    {
      evaluationPointId: "Gateway_Runtime",
      axisY: "runtimeBound",
      axisX: "engineSpecific",
      policyClause: "p#runtime",
    },
    {
      evaluationPointId: "UserTask_Review",
      axisY: "nonDeterministic",
      axisX: "engineAgnostic",
      policyClause: "p#human",
    },
    {
      evaluationPointId: "CallActivity_Sub",
      axisY: "unknown",
      axisX: "externalized",
      policyClause: "p#sub",
    },
  ],
  runtimeDependencyMap: [],
  summary: {
    structuralErrors: 0,
    semanticErrors: 0,
    contractCoverageRatio: 1,
  },
};

/** Analysis view-model spanning all five Axis-Y classes. */
export function fiveClassAnalysis(): AnalysisResult {
  return mapCompilerResult(FIVE_CLASS_COMPILER_RESULT);
}

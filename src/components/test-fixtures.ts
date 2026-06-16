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
  },
};

/** Build the sample analysis view-model, with summary score/signal filled in. */
export function sampleAnalysis(): AnalysisResult {
  const result = mapCompilerResult(SAMPLE_COMPILER_RESULT);
  // The adapter leaves score/signal null; populate them as a host would.
  return {
    ...result,
    summary: { ...result.summary, score: 64, maturitySignal: "fair" },
  };
}

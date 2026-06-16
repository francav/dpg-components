// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

import { describe, expect, it } from "vitest";

import { mapCompilerResult } from "./compilerAdapter.js";
import { ANALYSIS_FLAGS } from "./constants.js";
import type { CompilerResultInput } from "./compilerResult.js";
import type { DiagramElementIndex } from "./types.js";

function baseResult(overrides: Partial<CompilerResultInput> = {}): CompilerResultInput {
  return {
    metadata: { modelId: "loan-process", degraded: false },
    structuralFindings: [],
    semanticFindings: [],
    determinismMap: [],
    runtimeDependencyMap: [],
    summary: {
      structuralErrors: 0,
      semanticErrors: 0,
      contractCoverageRatio: 1,
    },
    ...overrides,
  };
}

describe("mapCompilerResult", () => {
  it("maps process identity and summary scalars", () => {
    const result = mapCompilerResult(
      baseResult({
        summary: {
          structuralErrors: 2,
          semanticErrors: 3,
          contractCoverageRatio: 0.5,
        },
      }),
    );

    expect(result.process).toEqual({ id: "loan-process", name: "loan-process" });
    expect(result.summary.structuralFindings).toBe(2);
    expect(result.summary.semanticFindings).toBe(3);
    expect(result.summary.contractCoverageRatio).toBe(0.5);
    // No maturity signal AND no evaluated elements → score/signal stay null
    // (the badge renders "N/A" gracefully).
    expect(result.summary.maturitySignal).toBeNull();
    expect(result.summary.score).toBeNull();
  });

  it("maps the compiler's real maturity signal through to score + band", () => {
    const result = mapCompilerResult(
      baseResult({
        summary: {
          structuralErrors: 0,
          semanticErrors: 0,
          contractCoverageRatio: 1,
          // 60/40 blend: 90*0.6 + 80*0.4 = 86 → "excellent".
          maturitySignal: { deterministicTotal: 90, portableTotal: 80 },
        },
      }),
    );
    expect(result.summary.score).toBe(86);
    expect(result.summary.maturitySignal).toBe("excellent");
  });

  it("derives a fallback score from the matrix when the compiler has no signal", () => {
    const result = mapCompilerResult(
      baseResult({
        determinismMap: [
          // fullyDeterministic + selfContained → 100*0.6 + 100*0.4 = 100.
          {
            evaluationPointId: "A",
            axisY: "deterministic",
            axisX: "engineAgnostic",
            policyClause: "p",
          },
        ],
      }),
    );
    expect(result.summary.score).toBe(100);
    expect(result.summary.maturitySignal).toBe("excellent");
  });

  it("populates recommendations from the worst findings, errors first", () => {
    const result = mapCompilerResult(
      baseResult({
        structuralFindings: [
          {
            id: "S",
            category: "structural",
            severity: "error",
            message: "missing impl",
            ruleId: "STRUCT_001",
            remediation: "bind an implementation",
          },
        ],
        semanticFindings: [
          {
            id: "M",
            category: "semantic",
            severity: "info",
            message: "note",
            ruleId: "SEM_001",
          },
        ],
      }),
    );
    expect(result.recommendations).toHaveLength(2);
    // Error first; prefers the remediation text; severity → card severity.
    expect(result.recommendations[0]).toMatchObject({
      severity: "high",
      message: "bind an implementation",
    });
    // Info finding without remediation falls back to its message.
    expect(result.recommendations[1]).toMatchObject({ severity: "low", message: "note" });
  });

  it("merges structural and semantic findings with unique, prefixed ids", () => {
    const result = mapCompilerResult(
      baseResult({
        structuralFindings: [
          {
            id: "F",
            category: "structural",
            severity: "error",
            message: "missing start event",
            ruleId: "STRUCT_001",
            targetId: "Task_1",
          },
        ],
        semanticFindings: [
          {
            id: "F",
            category: "semantic",
            severity: "warning",
            message: "ambiguous gateway",
            ruleId: "SEM_002",
            policyClause: "policy.gateways",
            remediation: "add a default flow",
          },
        ],
      }),
    );

    expect(result.findings).toHaveLength(2);
    // Same source id "F" must not collide across the merged arrays.
    expect(new Set(result.findings.map((f) => f.id)).size).toBe(2);

    const [structural, semantic] = result.findings;
    expect(structural).toMatchObject({
      id: "F-s0",
      category: "structural",
      severity: "error",
      title: "STRUCT_001",
      elementId: "Task_1",
      policyId: "",
      recommendation: "",
    });
    expect(semantic).toMatchObject({
      id: "F-m0",
      category: "policy",
      severity: "warning",
      title: "SEM_002",
      policyId: "policy.gateways",
      recommendation: "add a default flow",
    });
  });

  it("classifies ingestion findings as structural", () => {
    const result = mapCompilerResult(
      baseResult({
        structuralFindings: [
          {
            id: "I",
            category: "ingestion",
            severity: "error",
            message: "unparseable xml",
            ruleId: "INGEST_001",
          },
        ],
      }),
    );
    expect(result.findings[0]!.category).toBe("structural");
  });

  it("falls back to a synthetic id when the finding has no id", () => {
    const result = mapCompilerResult(
      baseResult({
        structuralFindings: [
          {
            id: "",
            category: "structural",
            severity: "info",
            message: "note",
            ruleId: "INFO_001",
          },
        ],
      }),
    );
    expect(result.findings[0]!.id).toBe("finding-s0");
  });

  it("maps the compiler axis-Y vocabulary 1:1 to the five rendered classes", () => {
    const result = mapCompilerResult(
      baseResult({
        determinismMap: [
          {
            evaluationPointId: "A",
            axisY: "deterministic",
            axisX: "engineAgnostic",
            policyClause: "p1",
          },
          {
            evaluationPointId: "B",
            axisY: "policyDependent",
            axisX: "profileScoped",
            policyClause: "p2",
            runtimeProfileSection: "camunda-7.serviceTask",
          },
          {
            evaluationPointId: "C",
            axisY: "runtimeBound",
            axisX: "engineSpecific",
            policyClause: "p3",
          },
          // nonDeterministic stays its OWN class (NOT collapsed to runtimeBound);
          // unknown axisX → selfContained.
          {
            evaluationPointId: "D",
            axisY: "nonDeterministic",
            axisX: "unknown",
            policyClause: "p4",
          },
          // unknown axisY stays its OWN class; externalized → externalCoupled.
          {
            evaluationPointId: "E",
            axisY: "unknown",
            axisX: "externalized",
            policyClause: "p5",
          },
        ],
      }),
    );

    expect(result.determinismMap["A"]).toEqual({
      axisY: "fullyDeterministic",
      axisX: "selfContained",
      rationale: "Policy: p1",
    });
    expect(result.determinismMap["B"]!.rationale).toBe(
      "Policy: p2 · Profile: camunda-7.serviceTask",
    );
    expect(result.determinismMap["C"]!.axisY).toBe("runtimeBound");
    // The F.2 fidelity assertions: nonDeterministic / unknown are NOT runtimeBound.
    expect(result.determinismMap["D"]).toMatchObject({
      axisY: "nonDeterministic",
      axisX: "selfContained",
    });
    expect(result.determinismMap["D"]!.axisY).not.toBe("runtimeBound");
    expect(result.determinismMap["E"]).toMatchObject({
      axisY: "unknown",
      axisX: "externalCoupled",
    });
    expect(result.determinismMap["E"]!.axisY).not.toBe("runtimeBound");

    expect(result.matrix.axisY).toEqual({
      fullyDeterministic: 1,
      policyDependent: 1,
      runtimeBound: 1,
      nonDeterministic: 1,
      unknown: 1,
    });
    expect(result.matrix.axisX).toEqual({
      selfContained: 2,
      profileScoped: 1,
      engineSpecific: 1,
      externalCoupled: 1,
    });
  });

  it("maps runtime dependencies and their profile-coverage status", () => {
    const result = mapCompilerResult(
      baseResult({
        runtimeDependencyMap: [
          {
            evaluationPointId: "S1",
            dependency: "payments-api",
            profileCoverage: "documented",
          },
          {
            evaluationPointId: "S2",
            dependency: "scoring-api",
            profileCoverage: "undocumented",
          },
          {
            evaluationPointId: "S3",
            dependency: "ledger-api",
            profileCoverage: "missingProfile",
          },
        ],
      }),
    );

    expect(result.runtimeDependencyMap["S1"]!.contracts[0]).toMatchObject({
      name: "payments-api",
      type: "Runtime",
      owner: "Profile",
      status: "documented",
    });
    expect(result.runtimeDependencyMap["S2"]!.contracts[0]!.status).toBe("undocumented");
    // missingProfile degrades to "partial".
    expect(result.runtimeDependencyMap["S3"]!.contracts[0]!.status).toBe("partial");
  });

  it("raises the policy-default flag when the result is degraded", () => {
    const result = mapCompilerResult(baseResult({ metadata: { modelId: "m", degraded: true } }));
    expect(result.summary.degradedFlags).toContain(ANALYSIS_FLAGS.policyDefault);
  });

  it("raises the runtime-bound flag when any element is runtime-bound", () => {
    const result = mapCompilerResult(
      baseResult({
        determinismMap: [
          {
            evaluationPointId: "X",
            axisY: "runtimeBound",
            axisX: "engineSpecific",
            policyClause: "p",
          },
        ],
      }),
    );
    expect(result.summary.degradedFlags).toContain(ANALYSIS_FLAGS.runtimeBound);
  });

  describe("element-id reconciliation", () => {
    const diagram: DiagramElementIndex = {
      elements: [{ id: "ServiceTask_Pay" }, { id: "Gateway_Risk" }],
    };

    it("uses evaluation-point ids verbatim when no diagram is supplied", () => {
      const result = mapCompilerResult(
        baseResult({
          determinismMap: [
            {
              evaluationPointId: "bpmn:Gateway_Risk",
              axisY: "policyDependent",
              axisX: "profileScoped",
              policyClause: "p",
            },
          ],
        }),
      );
      expect(result.determinismMap["bpmn:Gateway_Risk"]).toBeDefined();
    });

    it("resolves namespace-prefixed ids against the diagram's canonical ids", () => {
      const result = mapCompilerResult(
        baseResult({
          determinismMap: [
            {
              evaluationPointId: "http://example/process#Gateway_Risk",
              axisY: "policyDependent",
              axisX: "profileScoped",
              policyClause: "p",
            },
          ],
        }),
        diagram,
      );
      expect(result.determinismMap["Gateway_Risk"]).toBeDefined();
      expect(result.determinismMap["http://example/process#Gateway_Risk"]).toBeUndefined();
    });

    it("resolves case-insensitively", () => {
      const result = mapCompilerResult(
        baseResult({
          determinismMap: [
            {
              evaluationPointId: "servicetask_pay",
              axisY: "deterministic",
              axisX: "engineAgnostic",
              policyClause: "p",
            },
          ],
        }),
        diagram,
      );
      expect(result.determinismMap["ServiceTask_Pay"]).toBeDefined();
    });

    it("drops entries that cannot be matched to a diagram element", () => {
      const result = mapCompilerResult(
        baseResult({
          determinismMap: [
            {
              evaluationPointId: "Unknown_Element",
              axisY: "deterministic",
              axisX: "engineAgnostic",
              policyClause: "p",
            },
          ],
        }),
        diagram,
      );
      expect(Object.keys(result.determinismMap)).toHaveLength(0);
    });
  });
});

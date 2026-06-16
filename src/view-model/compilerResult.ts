// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Structural description of the compiler result the adapter consumes.
 *
 * @dpg/components stays dependency-free at runtime: rather than importing the
 * compiler package, it declares the slice of the L1 compiler-result boundary it
 * reads. The real `CompilerResult` from `@dpg/compiler-core` is structurally
 * assignable to {@link CompilerResultInput}, so a consumer can pass it directly
 * with no adapter at the call site.
 *
 * Only the fields the adapter actually reads are modeled here.
 */

export type CompilerSeverity = "info" | "warning" | "error";

export type CompilerAxisY =
  | "deterministic"
  | "policyDependent"
  | "runtimeBound"
  | "nonDeterministic"
  | "unknown";

export type CompilerAxisX =
  | "engineAgnostic"
  | "profileScoped"
  | "engineSpecific"
  | "externalized"
  | "unknown";

export interface CompilerFindingInput {
  readonly id: string;
  readonly category: "structural" | "semantic" | "ingestion";
  readonly severity: CompilerSeverity;
  readonly message: string;
  readonly targetId?: string;
  readonly policyClause?: string;
  readonly ruleId: string;
  readonly remediation?: string;
}

export interface CompilerDeterminismEntryInput {
  readonly evaluationPointId: string;
  readonly axisY: CompilerAxisY;
  readonly axisX: CompilerAxisX;
  readonly policyClause: string;
  readonly runtimeProfileSection?: string;
}

export interface CompilerRuntimeDependencyEntryInput {
  readonly evaluationPointId: string;
  readonly dependency: string;
  readonly profileCoverage: "documented" | "undocumented" | "missingProfile";
}

export interface CompilerResultSummaryInput {
  readonly structuralErrors: number;
  readonly semanticErrors: number;
  readonly contractCoverageRatio: number;
}

export interface CompilerResultMetadataInput {
  readonly modelId: string;
  readonly degraded: boolean;
}

export interface CompilerResultInput {
  readonly metadata: CompilerResultMetadataInput;
  readonly structuralFindings: ReadonlyArray<CompilerFindingInput>;
  readonly semanticFindings: ReadonlyArray<CompilerFindingInput>;
  readonly determinismMap: ReadonlyArray<CompilerDeterminismEntryInput>;
  readonly runtimeDependencyMap: ReadonlyArray<CompilerRuntimeDependencyEntryInput>;
  readonly summary: CompilerResultSummaryInput;
}

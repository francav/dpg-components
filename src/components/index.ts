// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * @dpg/components custom-element layer.
 *
 * Framework-neutral Web Components that render the WU view-model
 * ({@link AnalysisResult}). Each is a standard custom element: set the `result`
 * property (and, where relevant, `elementId` / `profiles` / `policies`) and the
 * element renders. They are usable from React, vanilla JS, or any host that can
 * mount a custom element, and emit composed CustomEvents across the shadow
 * boundary for host wiring.
 */

import { DpgDeterminismBadge } from "./badge.js";
import { DpgGovernanceMatrix } from "./matrix.js";
import { DpgFindingsPanel } from "./findings.js";
import { DpgElementProvenance } from "./provenance.js";
import { DpgProfilePolicySelector } from "./selectors.js";

export { DpgElement } from "./base.js";
export { DpgDeterminismBadge } from "./badge.js";
export { DpgGovernanceMatrix } from "./matrix.js";
export type { ElementSelectDetail } from "./matrix.js";
export { DpgFindingsPanel } from "./findings.js";
export { DpgElementProvenance } from "./provenance.js";
export { DpgProfilePolicySelector } from "./selectors.js";
export type { SelectorOption, SelectionChangeDetail } from "./selectors.js";
export * from "./presentation.js";

/** The custom elements and their tag names, in registration order. */
export const DPG_ELEMENTS = [
  DpgDeterminismBadge,
  DpgGovernanceMatrix,
  DpgFindingsPanel,
  DpgElementProvenance,
  DpgProfilePolicySelector,
] as const;

/**
 * Register every L3 custom element in the global `customElements` registry.
 *
 * Idempotent: a tag already registered (by this call or a previous one) is
 * skipped, so calling it from multiple bundles is safe. Returns the tag names
 * that were registered by this call.
 */
export function defineDpgElements(registry: CustomElementRegistry = customElements): string[] {
  const defined: string[] = [];
  for (const ctor of DPG_ELEMENTS) {
    const tag = ctor.tagName;
    if (!registry.get(tag)) {
      registry.define(tag, ctor);
      defined.push(tag);
    }
  }
  return defined;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * {@link mountGovernancePanels} — the one shared way to mount the L3 governance
 * panels into a host container.
 *
 * Every integration (modeler, starter, Camunda plugin) used to hand-roll the
 * same loop: register the elements, `createElement` one panel per tag, append
 * them, set `.result` on each, and inject the adapter's overlay stylesheet once.
 * This helper owns that loop in one place so the integrations stay thin and
 * never drift apart.
 *
 * It is deliberately framework- and adapter-neutral:
 *  - `@francav/components` keeps NO dependency on `@francav/bpmn-js-adapter`.
 *    The adapter owns its overlay CSS, so the host passes it in as a string
 *    (`stylesheet`) and the helper injects it once, keyed by a stable id.
 *  - Canvas selection is wired via callbacks: the panels emit bubbling, composed
 *    `dpg-element-select` / `dpg-profile-change` / `dpg-policy-change` events;
 *    the helper attaches ONE delegated listener on the container and routes each
 *    to the matching callback. Hosts drive the canvas from those callbacks.
 *
 * F.3b ships `layout: "flat"` — the determinism badge, governance matrix, and
 * findings panel, in display order. The consolidated `dpg-governance-inspector`
 * (`layout: "inspector"`) and the real `setSelectedElement` drill-down arrive in
 * F.3c; the API is defined now so hosts can adopt it without churn.
 */

import type { AnalysisResult } from "../view-model/types.js";
import { defineDpgElements } from "./index.js";
import type { ElementSelectDetail } from "./matrix.js";
import type { SelectionChangeDetail } from "./selectors.js";

/** The flat-layout panel tags, in display order. */
export const FLAT_PANEL_TAGS = [
  "dpg-determinism-badge",
  "dpg-governance-matrix",
  "dpg-findings-panel",
] as const;

export type FlatPanelTag = (typeof FLAT_PANEL_TAGS)[number];

/** Stable id for the injected stylesheet `<style>` node (de-dupes mounts). */
const STYLE_ELEMENT_ID = "dpg-governance-panels-style";

/** The events the helper delegates from the panels to the host callbacks. */
const ELEMENT_SELECT_EVENT = "dpg-element-select";
const PROFILE_CHANGE_EVENT = "dpg-profile-change";
const POLICY_CHANGE_EVENT = "dpg-policy-change";

export interface GovernancePanelOptions {
  /**
   * Which panel set to mount. F.3b ships `"flat"` (badge + matrix + findings);
   * `"inspector"` (the consolidated `dpg-governance-inspector`) arrives in F.3c.
   * Defaults to `"flat"`.
   */
  layout?: "flat";
  /**
   * CSS text the host injects once into the container's root document, keyed by
   * a stable id so repeated mounts never duplicate it. The adapter owns its
   * overlay CSS; pass it in (e.g. `dpgStylesheet()`) so `@francav/components`
   * keeps NO dependency on `@francav/bpmn-js-adapter`. Omit to inject nothing.
   */
  stylesheet?: string;
  /**
   * Called when a panel emits `dpg-element-select` (matrix dot / element-bound
   * finding click). The host typically focuses the element on the canvas.
   */
  onElementSelect?: (elementId: string) => void;
  /**
   * Called when the (future inspector) profile selector changes. Defined now;
   * unused in the flat layout, which has no selector. Ready for F.3c.
   */
  onProfileChange?: (id: string) => void;
  /** Called when the (future inspector) policy selector changes. See above. */
  onPolicyChange?: (id: string) => void;
}

export interface GovernancePanelsHandle {
  /** The host container the panels were mounted into. */
  readonly container: HTMLElement;
  /** Re-render every panel with a new analysis result. */
  update(result: AnalysisResult): void;
  /**
   * Drive the canvas→panel direction: tell the panels which element is selected
   * on the canvas. A no-op for the flat layout (no element drill-down yet); it
   * drives the inspector in F.3c.
   */
  setSelectedElement(elementId: string | null): void;
  /** Remove the panel nodes, the injected stylesheet, and the delegated listener. */
  destroy(): void;
}

/**
 * Register the L3 elements (once), inject the host stylesheet (once), create the
 * flat panel set under `container`, wire one delegated event listener, and
 * return a handle to update/select/destroy.
 */
export function mountGovernancePanels(
  container: HTMLElement,
  options: GovernancePanelOptions = {},
): GovernancePanelsHandle {
  defineDpgElements();

  const ownerDoc = container.ownerDocument;
  const styleHost = injectStylesheet(ownerDoc, options.stylesheet);

  const elements = FLAT_PANEL_TAGS.map((tag): [FlatPanelTag, HTMLElement] => {
    const el = ownerDoc.createElement(tag);
    container.appendChild(el);
    return [tag, el];
  });

  const applyResult = (result: AnalysisResult): void => {
    for (const [, el] of elements) {
      (el as HTMLElement & { result?: AnalysisResult }).result = result;
    }
  };

  // One delegated listener on the container catches the bubbling, composed
  // events from any panel and routes them to the host callbacks. The panels are
  // the only emitters, so there are no double-listeners.
  const onContainerEvent = (event: Event): void => {
    switch (event.type) {
      case ELEMENT_SELECT_EVENT: {
        const id = (event as CustomEvent<ElementSelectDetail>).detail?.elementId;
        if (id) options.onElementSelect?.(id);
        break;
      }
      case PROFILE_CHANGE_EVENT: {
        const id = (event as CustomEvent<SelectionChangeDetail>).detail?.id;
        if (id) options.onProfileChange?.(id);
        break;
      }
      case POLICY_CHANGE_EVENT: {
        const id = (event as CustomEvent<SelectionChangeDetail>).detail?.id;
        if (id) options.onPolicyChange?.(id);
        break;
      }
    }
  };
  container.addEventListener(ELEMENT_SELECT_EVENT, onContainerEvent);
  container.addEventListener(PROFILE_CHANGE_EVENT, onContainerEvent);
  container.addEventListener(POLICY_CHANGE_EVENT, onContainerEvent);

  return {
    container,
    update: applyResult,
    setSelectedElement: (_elementId: string | null): void => {
      // No-op for the flat layout; drives the inspector drill-down in F.3c.
    },
    destroy: (): void => {
      container.removeEventListener(ELEMENT_SELECT_EVENT, onContainerEvent);
      container.removeEventListener(PROFILE_CHANGE_EVENT, onContainerEvent);
      container.removeEventListener(POLICY_CHANGE_EVENT, onContainerEvent);
      for (const [, el] of elements) el.remove();
      styleHost?.getElementById(STYLE_ELEMENT_ID)?.remove();
    },
  };
}

/**
 * Inject `css` once into `doc`, keyed by {@link STYLE_ELEMENT_ID}. Returns the
 * document the style was injected into (so `destroy()` can remove it), or
 * `undefined` when there is nothing to inject.
 */
function injectStylesheet(doc: Document, css: string | undefined): Document | undefined {
  if (!css) return undefined;
  if (!doc.getElementById(STYLE_ELEMENT_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = css;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  return doc;
}

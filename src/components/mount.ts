// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * {@link mountGovernancePanels} — the one shared way to mount the L3 governance
 * UI into a host container.
 *
 * Every integration (modeler, starter, Camunda plugin) used to hand-roll the
 * same loop: register the elements, `createElement` the panels, append them,
 * set `.result` on each, and inject the adapter's overlay stylesheet once. This
 * helper owns that loop in one place so the integrations stay thin and never
 * drift apart.
 *
 * It is deliberately framework- and adapter-neutral:
 *  - `@francav/components` keeps NO dependency on `@francav/bpmn-js-adapter`.
 *    The adapter owns its overlay CSS, so the host passes it in as a string
 *    (`stylesheet`) and the helper injects it once, keyed by a stable id.
 *  - Canvas selection is wired via callbacks: the elements emit bubbling,
 *    composed `dpg-element-select` / `dpg-profile-change` / `dpg-policy-change`
 *    events; the helper attaches ONE delegated listener on the container and
 *    routes each to the matching callback. Hosts drive the canvas from those.
 *
 * Two layouts:
 *  - `"inspector"` (the DEFAULT): a single `<dpg-governance-inspector>` giving the
 *    consolidated process-overview ↔ element drill-down UX. `setSelectedElement`
 *    drives the inspector's drill-down.
 *  - `"flat"` (back-compat): the determinism badge, governance matrix, and
 *    findings panel, in display order. `setSelectedElement` is a no-op (the flat
 *    set has no element drill-down).
 */

import type { AnalysisResult } from "../view-model/types.js";
import { defineDpgElements } from "./index.js";
import type { DpgGovernanceInspector } from "./inspector.js";
import type { ElementSelectDetail } from "./matrix.js";
import type { SelectorOption, SelectionChangeDetail } from "./selectors.js";

/** The flat-layout panel tags, in display order. */
export const FLAT_PANEL_TAGS = [
  "dpg-determinism-badge",
  "dpg-governance-matrix",
  "dpg-findings-panel",
] as const;

export type FlatPanelTag = (typeof FLAT_PANEL_TAGS)[number];

/** The consolidated inspector tag (the `"inspector"` layout). */
export const INSPECTOR_TAG = "dpg-governance-inspector";

export type GovernancePanelLayout = "inspector" | "flat";

/** Stable id for the injected stylesheet `<style>` node (de-dupes mounts). */
const STYLE_ELEMENT_ID = "dpg-governance-panels-style";

/** The events the helper delegates from the elements to the host callbacks. */
const ELEMENT_SELECT_EVENT = "dpg-element-select";
const PROFILE_CHANGE_EVENT = "dpg-profile-change";
const POLICY_CHANGE_EVENT = "dpg-policy-change";

export interface GovernancePanelOptions {
  /**
   * Which UI to mount. `"inspector"` (the consolidated container) is the DEFAULT;
   * `"flat"` keeps the badge + matrix + findings trio for back-compat.
   */
  layout?: GovernancePanelLayout;
  /**
   * CSS text the host injects once into the container's root document, keyed by
   * a stable id so repeated mounts never duplicate it. The adapter owns its
   * overlay CSS; pass it in (e.g. `dpgStylesheet()`) so `@francav/components`
   * keeps NO dependency on `@francav/bpmn-js-adapter`. Omit to inject nothing.
   */
  stylesheet?: string;
  /** Runtime-profile options for the inspector's profile/policy selector. */
  profiles?: SelectorOption[];
  /** Policy-pack options for the inspector's profile/policy selector. */
  policies?: SelectorOption[];
  /** The initially selected runtime profile id. */
  selectedProfile?: string | null;
  /** The initially selected policy id. */
  selectedPolicy?: string | null;
  /**
   * Called when an element is selected (matrix dot / element-bound finding
   * click). The host typically focuses the element on the canvas.
   */
  onElementSelect?: (elementId: string) => void;
  /** Called when the inspector's profile selector changes. */
  onProfileChange?: (id: string) => void;
  /** Called when the inspector's policy selector changes. */
  onPolicyChange?: (id: string) => void;
}

export interface GovernancePanelsHandle {
  /** The host container the UI was mounted into. */
  readonly container: HTMLElement;
  /** The layout that was mounted. */
  readonly layout: GovernancePanelLayout;
  /** Re-render the UI with a new analysis result. */
  update(result: AnalysisResult): void;
  /**
   * Drive the canvas→panel direction: tell the UI which element is selected on
   * the canvas. In the inspector layout this flips it into element drill-down
   * (or back to overview when `null`); a no-op for the flat layout.
   */
  setSelectedElement(elementId: string | null): void;
  /** Remove the mounted nodes, the injected stylesheet, and the delegated listener. */
  destroy(): void;
}

/**
 * Register the L3 elements (once), inject the host stylesheet (once), mount the
 * chosen layout under `container`, wire one delegated event listener, and return
 * a handle to update/select/destroy.
 */
export function mountGovernancePanels(
  container: HTMLElement,
  options: GovernancePanelOptions = {},
): GovernancePanelsHandle {
  defineDpgElements();

  const layout: GovernancePanelLayout = options.layout ?? "inspector";
  const ownerDoc = container.ownerDocument;
  const styleHost = injectStylesheet(ownerDoc, options.stylesheet);

  // Build the layout's nodes and an `applyResult` that paints them.
  const mounted =
    layout === "inspector"
      ? mountInspector(ownerDoc, container, options)
      : mountFlat(ownerDoc, container);

  // One delegated listener on the container catches the bubbling, composed
  // events from the mounted elements and routes them to the host callbacks.
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
    layout,
    update: mounted.applyResult,
    setSelectedElement: mounted.setSelectedElement,
    destroy: (): void => {
      container.removeEventListener(ELEMENT_SELECT_EVENT, onContainerEvent);
      container.removeEventListener(PROFILE_CHANGE_EVENT, onContainerEvent);
      container.removeEventListener(POLICY_CHANGE_EVENT, onContainerEvent);
      mounted.remove();
      styleHost?.getElementById(STYLE_ELEMENT_ID)?.remove();
    },
  };
}

interface MountedLayout {
  applyResult(result: AnalysisResult): void;
  setSelectedElement(elementId: string | null): void;
  remove(): void;
}

/** Mount the single consolidated inspector and wire profile/policy + selection. */
function mountInspector(
  doc: Document,
  container: HTMLElement,
  options: GovernancePanelOptions,
): MountedLayout {
  const inspector = doc.createElement(INSPECTOR_TAG) as DpgGovernanceInspector;
  if (options.profiles) inspector.profiles = options.profiles;
  if (options.policies) inspector.policies = options.policies;
  if (options.selectedProfile !== undefined) inspector.selectedProfile = options.selectedProfile;
  if (options.selectedPolicy !== undefined) inspector.selectedPolicy = options.selectedPolicy;
  container.appendChild(inspector);

  return {
    applyResult: (result: AnalysisResult): void => {
      inspector.result = result;
      if (options.profiles) inspector.profiles = options.profiles;
      if (options.policies) inspector.policies = options.policies;
    },
    setSelectedElement: (elementId: string | null): void => {
      inspector.selectedElementId = elementId;
    },
    remove: (): void => inspector.remove(),
  };
}

/** Mount the flat badge + matrix + findings trio (back-compat). */
function mountFlat(doc: Document, container: HTMLElement): MountedLayout {
  const elements = FLAT_PANEL_TAGS.map((tag): HTMLElement => {
    const el = doc.createElement(tag);
    container.appendChild(el);
    return el;
  });
  return {
    applyResult: (result: AnalysisResult): void => {
      for (const el of elements) (el as HTMLElement & { result?: AnalysisResult }).result = result;
    },
    setSelectedElement: (): void => {
      // No element drill-down in the flat layout.
    },
    remove: (): void => {
      for (const el of elements) el.remove();
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

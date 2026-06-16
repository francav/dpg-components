// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-governance-inspector> — the consolidated governance container.
 *
 * One element gives the rich governance UX: a single panel that switches between
 * a process-overview mode (badge + summary + matrix + findings + recommendations
 * + profile/policy selector) and an element drill-down mode (the per-element
 * provenance card), instead of three disconnected flat panels.
 *
 * It composes the existing L3 elements rather than re-implementing them: it
 * creates `<dpg-determinism-badge>`, `<dpg-governance-matrix>`,
 * `<dpg-findings-panel>`, `<dpg-element-provenance>`, and
 * `<dpg-profile-policy-selector>` inside its own shadow root and sets their
 * `.result` / props. The embedded children emit bubbling, composed events; this
 * container catches `dpg-element-select` on its own shadow root, flips into
 * drill-down mode, and RE-DISPATCHES it upward (so the mount helper still drives
 * canvas select+pan — the event is never swallowed). Profile/policy changes are
 * likewise re-dispatched upward.
 *
 * Modes:
 *  - `selectedElementId == null` → process-overview.
 *  - `selectedElementId` set     → element drill-down (Analysis view only; the
 *    Properties sub-tab is deferred to F.4, with a structural seam left here).
 *
 * F.4 seams left deliberately unbuilt: `filterCurrentElementOnly` and axis-class
 * filters (the `filterSeverity` field is the first of that family); the element
 * Properties sub-tab.
 */

import type { AnalysisResult, FindingSeverity } from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h } from "./dom.js";
import type { ElementSelectDetail } from "./matrix.js";
import type { SelectionChangeDetail } from "./selectors.js";
import { DpgProfilePolicySelector, type SelectorOption } from "./selectors.js";
import { DpgElementProvenance } from "./provenance.js";

/** Severity filter applied to the overview findings panel. */
type FilterSeverity = "all" | FindingSeverity;

const SEVERITY_FILTERS: ReadonlyArray<FilterSeverity> = ["all", "error", "warning", "info"];

/** Detail for the optional `dpg-inspector-mode` event. */
export interface InspectorModeDetail {
  mode: "overview" | "element";
  elementId: string | null;
}

export class DpgGovernanceInspector extends DpgElement {
  static readonly tagName = "dpg-governance-inspector";
  static readonly observedAttributes = ["selected-element-id"];

  private _selectedElementId: string | null = null;
  private _profiles: SelectorOption[] = [];
  private _policies: SelectorOption[] = [];
  private _selectedProfile: string | null = null;
  private _selectedPolicy: string | null = null;

  // Internal view state.
  private _filterSeverity: FilterSeverity = "all";
  private _matrixOpen = false;

  // F.4 seam: per-element + axis-class filters land alongside `filterSeverity`.
  // (filterCurrentElementOnly, axisYFilter, axisXFilter — deliberately unbuilt.)

  constructor() {
    super();
    // ONE listener on our own shadow root: the embedded children's bubbling,
    // composed events surface here. We update our own state AND re-dispatch
    // upward so the host (mount helper) still drives the canvas.
    this.root.addEventListener("dpg-element-select", (event: Event) => {
      const detail = (event as CustomEvent<ElementSelectDetail>).detail;
      if (detail?.elementId) {
        this.selectedElementId = detail.elementId;
        this.reemit<ElementSelectDetail>("dpg-element-select", detail);
      }
    });
    this.root.addEventListener("dpg-profile-change", (event: Event) => {
      const detail = (event as CustomEvent<SelectionChangeDetail>).detail;
      if (detail?.id) {
        this._selectedProfile = detail.id;
        this.reemit<SelectionChangeDetail>("dpg-profile-change", detail);
      }
    });
    this.root.addEventListener("dpg-policy-change", (event: Event) => {
      const detail = (event as CustomEvent<SelectionChangeDetail>).detail;
      if (detail?.id) {
        this._selectedPolicy = detail.id;
        this.reemit<SelectionChangeDetail>("dpg-policy-change", detail);
      }
    });
  }

  // ── Properties ────────────────────────────────────────────────────────────

  /** null ⇒ process-overview mode; set ⇒ element drill-down. Reflected to the attribute. */
  get selectedElementId(): string | null {
    return this._selectedElementId;
  }
  set selectedElementId(value: string | null) {
    if (this._selectedElementId === value) return;
    this._selectedElementId = value;
    // Reflect to the attribute without re-entering the setter.
    if (value === null) {
      if (this.getAttribute("selected-element-id") !== null)
        this.removeAttribute("selected-element-id");
    } else if (this.getAttribute("selected-element-id") !== value) {
      this.setAttribute("selected-element-id", value);
    }
    this.emit<InspectorModeDetail>("dpg-inspector-mode", {
      mode: value === null ? "overview" : "element",
      elementId: value,
    });
    this.rerender();
  }

  get profiles(): SelectorOption[] {
    return this._profiles;
  }
  set profiles(value: SelectorOption[]) {
    this._profiles = value ?? [];
    this.rerender();
  }

  get policies(): SelectorOption[] {
    return this._policies;
  }
  set policies(value: SelectorOption[]) {
    this._policies = value ?? [];
    this.rerender();
  }

  get selectedProfile(): string | null {
    return this._selectedProfile;
  }
  set selectedProfile(value: string | null) {
    this._selectedProfile = value;
    this.rerender();
  }

  get selectedPolicy(): string | null {
    return this._selectedPolicy;
  }
  set selectedPolicy(value: string | null) {
    this._selectedPolicy = value;
    this.rerender();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "selected-element-id") this.selectedElementId = value;
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  protected styles(): string {
    return `
    .inspector { display: flex; flex-direction: column; gap: 0.85rem; padding: 0.25rem; }
    .summary { display: flex; flex-direction: column; gap: 0.5rem; }
    .summary__counts { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 12px; }
    .summary__count { display: inline-flex; align-items: center; gap: 0.25rem; }
    .summary__count b { font-weight: 700; }
    .summary__count--error b { color: #ef4444; }
    .summary__count--warning b { color: #f59e0b; }
    .summary__count--info b { color: #3b82f6; }
    .summary__count--coverage b { color: #047857; }
    .disclosure { border: 1px solid #e5e7eb; border-radius: 6px; }
    .disclosure__tab {
      width: 100%; text-align: left; background: #f9fafb; border: 0; cursor: pointer;
      padding: 0.4rem 0.6rem; font: inherit; font-weight: 600; border-radius: 6px;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .disclosure__chevron { color: #6b7280; font-size: 11px; }
    .disclosure__body { padding: 0.5rem; border-top: 1px solid #e5e7eb; }
    .sevfilter { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .sevfilter__btn {
      font: inherit; font-size: 11px; cursor: pointer; border: 1px solid #d1d5db;
      background: #fff; border-radius: 999px; padding: 0.1rem 0.5rem; color: #374151;
    }
    .sevfilter__btn--active { background: #111827; color: #fff; border-color: #111827; }
    .recs { display: flex; flex-direction: column; gap: 0.3rem; }
    .recs__title { font-weight: 600; margin: 0; }
    .recs__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .recs__item {
      border-left: 3px solid #9ca3af; padding: 0.25rem 0.5rem; background: #f9fafb;
      border-radius: 0 4px 4px 0; color: #374151;
    }
    .recs__item--high { border-left-color: #ef4444; }
    .recs__item--medium { border-left-color: #f59e0b; }
    .recs__item--low { border-left-color: #3b82f6; }
    .section__title { font-weight: 600; margin: 0 0 0.3rem; }
    .back {
      font: inherit; cursor: pointer; border: 1px solid #d1d5db; background: #fff;
      border-radius: 6px; padding: 0.3rem 0.6rem; align-self: flex-start; color: #374151;
    }
    .back:hover { border-color: #9ca3af; }
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  protected render(result: AnalysisResult | null): void {
    if (!result) {
      this.root.append(this.emptyState("No analysis"));
      return;
    }
    if (this._selectedElementId === null) {
      this.root.append(this.renderOverview(result));
    } else {
      this.root.append(this.renderDrilldown(result, this._selectedElementId));
    }
  }

  // ── Process-overview mode ───────────────────────────────────────────────────

  private renderOverview(result: AnalysisResult): HTMLElement {
    const container = h("div", { class: "inspector" });

    // Header badge (score / maturity).
    const badge = this.child<DpgElement>("dpg-determinism-badge", result);
    container.append(badge);

    // Summary row: severity counts + contract coverage.
    container.append(this.buildSummaryRow(result));

    // Embedded matrix, collapsible via a disclosure pull-tab.
    container.append(this.buildMatrixDisclosure(result));

    // Findings with a severity toggle (honoring `filterSeverity`).
    container.append(this.buildFindings(result));

    // Recommendations.
    if (result.recommendations.length > 0) {
      container.append(this.buildRecommendations(result));
    }

    // Profile / policy selector (returns to the inspector after F.3b dropped it).
    if (this._profiles.length > 0 || this._policies.length > 0) {
      container.append(this.buildSelector());
    }

    return container;
  }

  private buildSummaryRow(result: AnalysisResult): HTMLElement {
    const counts = severityCounts(result);
    const coverage = Math.round(result.summary.contractCoverageRatio * 100);
    return h("div", { class: "summary" }, [
      h("div", { class: "summary__counts" }, [
        h("span", { class: "summary__count summary__count--error" }, [
          h("b", {}, String(counts.error)),
          " errors",
        ]),
        h("span", { class: "summary__count summary__count--warning" }, [
          h("b", {}, String(counts.warning)),
          " warnings",
        ]),
        h("span", { class: "summary__count summary__count--info" }, [
          h("b", {}, String(counts.info)),
          " info",
        ]),
        h("span", { class: "summary__count summary__count--coverage" }, [
          h("b", {}, `${coverage}%`),
          " contract coverage",
        ]),
      ]),
    ]);
  }

  private buildMatrixDisclosure(result: AnalysisResult): HTMLElement {
    const disclosure = h("div", { class: "disclosure" });
    const tab = h("button", { class: "disclosure__tab", type: "button" }, [
      h("span", { class: "disclosure__chevron" }, this._matrixOpen ? "▾" : "▸"),
      h("span", {}, "Governance Matrix"),
    ]);
    tab.addEventListener("click", () => {
      this._matrixOpen = !this._matrixOpen;
      this.rerender();
    });
    disclosure.append(tab);
    if (this._matrixOpen) {
      const body = h("div", { class: "disclosure__body" });
      body.append(this.child<DpgElement>("dpg-governance-matrix", result));
      disclosure.append(body);
    }
    return disclosure;
  }

  private buildFindings(result: AnalysisResult): HTMLElement {
    const counts = severityCounts(result);
    const section = h("div", { class: "section" }, [
      h("p", { class: "section__title" }, "Findings"),
      this.buildSeverityFilter(counts),
    ]);

    // Honor `filterSeverity` by feeding the panel a filtered result.
    const filtered: AnalysisResult =
      this._filterSeverity === "all"
        ? result
        : {
            ...result,
            findings: result.findings.filter((f) => f.severity === this._filterSeverity),
          };
    section.append(this.child<DpgElement>("dpg-findings-panel", filtered));
    return section;
  }

  private buildSeverityFilter(counts: Record<FindingSeverity, number>): HTMLElement {
    const bar = h("div", { class: "sevfilter" });
    for (const sev of SEVERITY_FILTERS) {
      const active = this._filterSeverity === sev;
      const label =
        sev === "all"
          ? "All"
          : `${sev[0]!.toUpperCase()}${sev.slice(1)} (${counts[sev as FindingSeverity]})`;
      const btn = h(
        "button",
        { class: `sevfilter__btn${active ? " sevfilter__btn--active" : ""}`, type: "button" },
        label,
      );
      btn.addEventListener("click", () => {
        this._filterSeverity = sev;
        this.rerender();
      });
      bar.append(btn);
    }
    return bar;
  }

  private buildRecommendations(result: AnalysisResult): HTMLElement {
    const list = h("ul", { class: "recs__list" });
    for (const rec of result.recommendations) {
      list.append(h("li", { class: `recs__item recs__item--${rec.severity}` }, rec.message));
    }
    return h("div", { class: "recs" }, [
      h("p", { class: "recs__title" }, `Recommendations (${result.recommendations.length})`),
      list,
    ]);
  }

  private buildSelector(): HTMLElement {
    const selector = document.createElement(
      DpgProfilePolicySelector.tagName,
    ) as DpgProfilePolicySelector;
    selector.profiles = this._profiles;
    selector.policies = this._policies;
    selector.selectedProfile = this._selectedProfile;
    selector.selectedPolicy = this._selectedPolicy;
    return selector;
  }

  // ── Element drill-down mode ─────────────────────────────────────────────────

  private renderDrilldown(result: AnalysisResult, elementId: string): HTMLElement {
    const container = h("div", { class: "inspector" });

    const back = h("button", { class: "back", type: "button" }, "← back to process");
    back.addEventListener("click", () => {
      this.selectedElementId = null;
    });
    container.append(back);

    // F.4 seam: an element-level tab strip (Analysis | Properties) lands here.
    // F.3c ships the Analysis view only — the provenance card.
    const provenance = document.createElement(DpgElementProvenance.tagName) as DpgElementProvenance;
    provenance.setAttribute("element-id", elementId);
    provenance.result = result;
    container.append(provenance);

    return container;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Create an embedded child element and set its `.result`. */
  private child<T extends HTMLElement & { result: AnalysisResult | null }>(
    tag: string,
    result: AnalysisResult,
  ): T {
    const el = document.createElement(tag) as T;
    el.result = result;
    return el;
  }

  /** Re-dispatch an event upward from the host so the canvas wiring still fires. */
  private reemit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }
}

function severityCounts(result: AnalysisResult): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of result.findings) counts[f.severity]++;
  return counts;
}

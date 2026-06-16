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
 *  - `selectedElementId` set     → element drill-down (Analysis | Properties).
 *
 * Large-process filters (WU-F.4) — all inspector-internal state, all default to
 * "all / off" so an unfiltered inspector looks unchanged, all COMPOSABLE:
 *  - severity filter (error/warning/info) — the F.3c control;
 *  - axis-class cross-filter — clickable per-class bars (Axis-Y determinism /
 *    Axis-X coupling) with a removable active-filter chip, mirroring the
 *    reference's clickable axis bars;
 *  - current-element-only toggle — narrows findings to the selected element.
 *  Every control carries a live count badge (the count it would yield, computed
 *  by intersecting the other active filters), so a user scanning hundreds of
 *  elements sees where the findings live before clicking.
 *
 * Drill-down adds the Analysis | Properties sub-tab seam deferred from F.3c:
 * Properties shows the element's raw metadata read-only (governance integrations
 * don't edit).
 */

import type {
  AnalysisResult,
  AxisXClassification,
  AxisYClassification,
  DeterminismEntry,
  Finding,
  FindingSeverity,
} from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h } from "./dom.js";
import type { ElementSelectDetail } from "./matrix.js";
import { AXIS_X_INFO, AXIS_Y_INFO } from "./presentation.js";
import type { SelectionChangeDetail } from "./selectors.js";
import { DpgProfilePolicySelector, type SelectorOption } from "./selectors.js";
import { DpgElementProvenance } from "./provenance.js";

/** Severity filter applied to the overview findings panel. */
type FilterSeverity = "all" | FindingSeverity;

const SEVERITY_FILTERS: ReadonlyArray<FilterSeverity> = ["all", "error", "warning", "info"];

/** An active axis-class cross-filter: one determinism row or one coupling column. */
type AxisFilter =
  | { axis: "Y"; value: AxisYClassification }
  | { axis: "X"; value: AxisXClassification };

const AXIS_Y_ORDER: ReadonlyArray<AxisYClassification> = [
  "fullyDeterministic",
  "policyDependent",
  "runtimeBound",
  "nonDeterministic",
  "unknown",
];
const AXIS_X_ORDER: ReadonlyArray<AxisXClassification> = [
  "selfContained",
  "profileScoped",
  "engineSpecific",
  "externalCoupled",
];

/** The drill-down sub-tab. */
type DrilldownTab = "analysis" | "properties";

/** Detail for the optional `dpg-inspector-mode` event. */
export interface InspectorModeDetail {
  mode: "overview" | "element";
  elementId: string | null;
}

export class DpgGovernanceInspector extends DpgElement {
  static readonly tagName = "dpg-governance-inspector";
  static readonly observedAttributes = ["selected-element-id"];

  private _selectedElementId: string | null = null;
  // The last element drilled into — retained after returning to the overview so
  // the current-element-only toggle can narrow the overview findings to it.
  private _lastElementId: string | null = null;
  private _profiles: SelectorOption[] = [];
  private _policies: SelectorOption[] = [];
  private _selectedProfile: string | null = null;
  private _selectedPolicy: string | null = null;

  // Internal view state — all default to "all / off" (composable filters).
  private _filterSeverity: FilterSeverity = "all";
  private _axisFilter: AxisFilter | null = null;
  private _currentElementOnly = false;
  private _matrixOpen = false;
  private _drilldownTab: DrilldownTab = "analysis";

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
    if (value !== null) this._lastElementId = value;
    // A fresh drill-down always opens on the Analysis tab.
    this._drilldownTab = "analysis";
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
    .axisbars { display: flex; flex-direction: column; gap: 0.5rem; }
    .axisbars__section { display: flex; flex-direction: column; gap: 0.2rem; }
    .axisbars__label {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      color: #6b7280;
    }
    .axisbar {
      display: grid; grid-template-columns: 7rem 1fr 2rem; align-items: center; gap: 0.4rem;
      font: inherit; font-size: 11px; text-align: left; cursor: pointer; color: #374151;
      background: transparent; border: 1px solid transparent; border-radius: 4px;
      padding: 0.1rem 0.3rem;
    }
    .axisbar:hover { background: #f9fafb; }
    .axisbar--active { border-color: #111827; background: #f3f4f6; }
    .axisbar__name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .axisbar__track { height: 8px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
    .axisbar__fill { height: 100%; border-radius: 999px; }
    .axisbar__count { text-align: right; color: #6b7280; font-variant-numeric: tabular-nums; }
    .activefilters { display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: center; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.3rem; font-size: 11px;
      background: #111827; color: #fff; border-radius: 999px; padding: 0.1rem 0.2rem 0.1rem 0.5rem;
    }
    .chip__x {
      font: inherit; cursor: pointer; border: 0; background: rgba(255,255,255,0.2);
      color: #fff; border-radius: 50%; width: 14px; height: 14px; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center; padding: 0;
    }
    .toggle { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 11px; color: #374151; cursor: pointer; }
    .toggle input { margin: 0; }
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
    .subtabs { display: flex; gap: 0.3rem; border-bottom: 1px solid #e5e7eb; }
    .subtabs__tab {
      font: inherit; font-size: 12px; cursor: pointer; border: 0; background: transparent;
      padding: 0.3rem 0.6rem; color: #6b7280; border-bottom: 2px solid transparent; font-weight: 600;
    }
    .subtabs__tab--active { color: #111827; border-bottom-color: #111827; }
    .props { display: flex; flex-direction: column; gap: 0.3rem; }
    .props__row { display: grid; grid-template-columns: 9rem 1fr; gap: 0.4rem; font-size: 12px; }
    .props__key { color: #6b7280; }
    .props__val { color: #1f2937; word-break: break-word; }
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

    // Axis-class cross-filter bars (Axis-Y / Axis-X), clickable.
    container.append(this.buildAxisBars(result));

    // Findings with the composed severity + axis-class + current-element filters.
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
    const counts = severityCounts(result.findings);
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

  /**
   * Clickable per-class bars for both axes. Each bar's count is the number of
   * evaluated ELEMENTS in that class (from `result.matrix`, the same tally the
   * matrix legend uses); the fill is proportional to the largest class on that
   * axis. Clicking a bar sets/clears the axis-class cross-filter, which then
   * narrows the findings list. Mirrors the reference's clickable axis bars.
   */
  private buildAxisBars(result: AnalysisResult): HTMLElement {
    const bars = h("div", { class: "axisbars" });

    const ySection = h("div", { class: "axisbars__section" }, [
      h("span", { class: "axisbars__label" }, "Determinism (Axis Y)"),
    ]);
    const yMax = Math.max(1, ...AXIS_Y_ORDER.map((k) => result.matrix.axisY[k]));
    for (const key of AXIS_Y_ORDER) {
      ySection.append(
        this.buildAxisBar(
          "Y",
          key,
          AXIS_Y_INFO[key].label,
          AXIS_Y_INFO[key].color,
          result.matrix.axisY[key],
          yMax,
        ),
      );
    }
    bars.append(ySection);

    const xSection = h("div", { class: "axisbars__section" }, [
      h("span", { class: "axisbars__label" }, "Coupling (Axis X)"),
    ]);
    const xMax = Math.max(1, ...AXIS_X_ORDER.map((k) => result.matrix.axisX[k]));
    for (const key of AXIS_X_ORDER) {
      xSection.append(
        this.buildAxisBar(
          "X",
          key,
          AXIS_X_INFO[key].label,
          AXIS_X_INFO[key].color,
          result.matrix.axisX[key],
          xMax,
        ),
      );
    }
    bars.append(xSection);

    return bars;
  }

  private buildAxisBar(
    axis: "Y" | "X",
    value: AxisYClassification | AxisXClassification,
    label: string,
    color: string,
    count: number,
    max: number,
  ): HTMLElement {
    const active = this._axisFilter?.axis === axis && this._axisFilter.value === value;
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    const bar = h(
      "button",
      {
        class: `axisbar${active ? " axisbar--active" : ""}`,
        type: "button",
        "aria-pressed": active ? "true" : "false",
        title: `${label}: ${count} element${count === 1 ? "" : "s"}`,
      },
      [
        h("span", { class: "axisbar__name" }, label),
        h("div", { class: "axisbar__track" }, [
          h("div", { class: "axisbar__fill", style: `width:${pct}%;background:${color}` }),
        ]),
        h("span", { class: "axisbar__count" }, String(count)),
      ],
    );
    bar.addEventListener("click", () => {
      this._axisFilter = active ? null : ({ axis, value } as AxisFilter);
      this.rerender();
    });
    return bar;
  }

  /** Active-filter chips (removable) for the axis-class + current-element filters. */
  private buildActiveFilters(): HTMLElement | null {
    const chips: HTMLElement[] = [];

    if (this._axisFilter) {
      const label =
        this._axisFilter.axis === "Y"
          ? AXIS_Y_INFO[this._axisFilter.value].label
          : AXIS_X_INFO[this._axisFilter.value].label;
      chips.push(
        this.buildChip(`Class: ${label}`, () => {
          this._axisFilter = null;
          this.rerender();
        }),
      );
    }

    if (this._currentElementOnly && this._lastElementId) {
      chips.push(
        this.buildChip(`Element: ${this._lastElementId}`, () => {
          this._currentElementOnly = false;
          this.rerender();
        }),
      );
    }

    if (chips.length === 0) return null;
    return h("div", { class: "activefilters" }, chips);
  }

  private buildChip(text: string, onRemove: () => void): HTMLElement {
    const x = h("button", { class: "chip__x", type: "button", "aria-label": "Remove filter" }, "×");
    x.addEventListener("click", onRemove);
    return h("span", { class: "chip" }, [h("span", {}, text), x]);
  }

  private buildFindings(result: AnalysisResult): HTMLElement {
    // Findings after the axis-class + current-element filters (severity is the
    // last axis, applied per-toggle so each toggle's badge shows its own count).
    const base = this.applyAxisAndElementFilters(result);
    const counts = severityCounts(base);

    const section = h("div", { class: "section" }, [
      h("p", { class: "section__title" }, "Findings"),
      this.buildSeverityFilter(counts),
    ]);

    // Current-element-only toggle (composable; narrows to the selected element).
    section.append(this.buildCurrentElementToggle(result));

    const active = this.buildActiveFilters();
    if (active) section.append(active);

    // Apply the severity filter on top of the axis/element-filtered base.
    const filtered: Finding[] =
      this._filterSeverity === "all"
        ? base
        : base.filter((f) => f.severity === this._filterSeverity);

    section.append(this.child<DpgElement>("dpg-findings-panel", { ...result, findings: filtered }));
    return section;
  }

  /**
   * Apply the axis-class and current-element filters to the findings list (NOT
   * severity — that is applied per-toggle so the toggle badges show composed
   * counts). A finding matches the axis filter when its element's determinism
   * entry is in the selected class; findings with no element / no classification
   * are dropped while a class filter is active.
   */
  private applyAxisAndElementFilters(result: AnalysisResult): Finding[] {
    let findings: Finding[] = result.findings;

    if (this._currentElementOnly && this._lastElementId) {
      const id = this._lastElementId;
      findings = findings.filter((f) => f.elementId === id);
    }

    const axisFilter = this._axisFilter;
    if (axisFilter) {
      findings = findings.filter((f) => {
        if (!f.elementId) return false;
        const entry = result.determinismMap[f.elementId];
        if (!entry) return false;
        return axisFilter.axis === "Y"
          ? entry.axisY === axisFilter.value
          : entry.axisX === axisFilter.value;
      });
    }

    return findings;
  }

  private buildSeverityFilter(counts: Record<FindingSeverity, number>): HTMLElement {
    const bar = h("div", { class: "sevfilter" });
    const all = counts.error + counts.warning + counts.info;
    for (const sev of SEVERITY_FILTERS) {
      const active = this._filterSeverity === sev;
      const count = sev === "all" ? all : counts[sev];
      const label = sev === "all" ? `All (${all})` : `${titleCase(sev)} (${count})`;
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

  /**
   * Current-element-only toggle. Targets the last element drilled into (retained
   * after returning to the overview); enabled once any element has been selected.
   * Its badge shows how many findings that element carries.
   */
  private buildCurrentElementToggle(result: AnalysisResult): HTMLElement {
    const id = this._lastElementId;
    const has = id !== null;
    const checkbox = h("input", { type: "checkbox" }) as HTMLInputElement;
    checkbox.checked = this._currentElementOnly;
    checkbox.disabled = !has;
    checkbox.addEventListener("change", () => {
      this._currentElementOnly = checkbox.checked;
      this.rerender();
    });

    const elementCount = has ? result.findings.filter((f) => f.elementId === id).length : 0;
    const text = has
      ? `Current element only (${elementCount})`
      : "Current element only (select an element)";

    return h("label", { class: "toggle" }, [checkbox, h("span", {}, text)]);
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

    // Element-level sub-tab strip: Analysis (the provenance card) | Properties
    // (the element's raw metadata, read-only — governance integrations don't edit).
    container.append(this.buildSubTabs());

    if (this._drilldownTab === "analysis") {
      const provenance = document.createElement(
        DpgElementProvenance.tagName,
      ) as DpgElementProvenance;
      provenance.setAttribute("element-id", elementId);
      provenance.result = result;
      container.append(provenance);
    } else {
      container.append(this.buildProperties(result, elementId));
    }

    return container;
  }

  private buildSubTabs(): HTMLElement {
    const strip = h("div", { class: "subtabs" });
    const tabs: ReadonlyArray<[DrilldownTab, string]> = [
      ["analysis", "Analysis"],
      ["properties", "Properties"],
    ];
    for (const [tab, label] of tabs) {
      const active = this._drilldownTab === tab;
      const btn = h(
        "button",
        {
          class: `subtabs__tab${active ? " subtabs__tab--active" : ""}`,
          type: "button",
          "aria-selected": active ? "true" : "false",
        },
        label,
      );
      btn.addEventListener("click", () => {
        if (this._drilldownTab === tab) return;
        this._drilldownTab = tab;
        this.rerender();
      });
      strip.append(btn);
    }
    return strip;
  }

  /**
   * Properties sub-tab: the element's raw metadata/attributes, read-only. The
   * governance view-model carries no editable BPMN attributes, so this surfaces
   * what is known about the element — its id, determinism/coupling classes and
   * rationale, runtime-dependency contracts, and finding count — as a flat
   * key/value table. Intentionally simple.
   */
  private buildProperties(result: AnalysisResult, elementId: string): HTMLElement {
    const rows: Array<[string, string]> = [["Element ID", elementId]];

    const entry: DeterminismEntry | undefined = result.determinismMap[elementId];
    if (entry) {
      rows.push(["Determinism", AXIS_Y_INFO[entry.axisY].label]);
      rows.push(["Coupling", AXIS_X_INFO[entry.axisX].label]);
      rows.push(["Rationale", entry.rationale]);
    } else {
      rows.push(["Classification", "Not classified"]);
    }

    const contracts = result.runtimeDependencyMap[elementId]?.contracts ?? [];
    if (contracts.length > 0) {
      rows.push([
        "Runtime dependencies",
        contracts.map((c) => `${c.name} (${c.status})`).join(", "),
      ]);
    }

    const findingCount = result.findings.filter((f) => f.elementId === elementId).length;
    rows.push(["Findings", String(findingCount)]);

    const props = h("div", { class: "props" }, [h("p", { class: "section__title" }, "Properties")]);
    for (const [key, val] of rows) {
      props.append(
        h("div", { class: "props__row" }, [
          h("span", { class: "props__key" }, key),
          h("span", { class: "props__val" }, val),
        ]),
      );
    }
    return props;
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

function severityCounts(findings: ReadonlyArray<Finding>): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

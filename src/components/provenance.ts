// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-element-provenance> — the per-element governance provenance card.
 *
 * For one element id it shows the determinism/coupling classification, the
 * weighted governance score, the rationale (where the verdict came from), the
 * runtime-dependency contracts, and the element's own findings. This is the
 * "provenance" host that explains a verdict; framework-neutral re-build of the
 * modeler element-analysis view.
 *
 * The element id is set via the `elementId` property (or `element-id`
 * attribute); `result` is the shared analysis view-model.
 */

import type { AnalysisResult, DeterminismEntry } from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h } from "./dom.js";
import {
  AXIS_X_INFO,
  AXIS_Y_INFO,
  elementGovernanceScore,
  scoreColor,
  SEVERITY_COLOR,
} from "./presentation.js";

export class DpgElementProvenance extends DpgElement {
  static readonly tagName = "dpg-element-provenance";
  static readonly observedAttributes = ["element-id"];

  private _elementId: string | null = null;

  get elementId(): string | null {
    return this._elementId;
  }

  set elementId(value: string | null) {
    this._elementId = value;
    this.rerender();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "element-id") this.elementId = value;
  }

  protected styles(): string {
    return `
    .prov { display: flex; flex-direction: column; gap: 0.75rem; }
    .score { display: flex; align-items: center; gap: 0.6rem; }
    .score__circle {
      width: 48px; height: 48px; border-radius: 50%; border: 3px solid;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .score__value { font-weight: 700; font-size: 16px; line-height: 1; }
    .score__max { font-size: 9px; color: #6b7280; }
    .score__meta { display: flex; flex-direction: column; gap: 0.1rem; font-size: 11px; }
    .score__meta b { font-weight: 600; }
    .section__title { font-weight: 600; margin: 0 0 0.3rem; }
    .class { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.5rem; }
    .class__badge { color: #fff; border-radius: 4px; padding: 0.15rem 0.45rem; align-self: flex-start; font-size: 12px; }
    .class__desc { margin: 0; color: #6b7280; font-size: 12px; }
    .rationale { margin: 0; color: #374151; background: #f9fafb; border-radius: 6px; padding: 0.5rem; }
    .contract { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.4rem 0.5rem; margin-bottom: 0.3rem; }
    .contract__name { font-weight: 600; }
    .contract__meta { display: flex; gap: 0.4rem; font-size: 11px; color: #6b7280; }
    .contract__status { border-radius: 4px; padding: 0 0.3rem; }
    .contract__status--documented { background: #10b98122; color: #047857; }
    .contract__status--undocumented { background: #ef444422; color: #b91c1c; }
    .contract__status--partial { background: #f59e0b22; color: #b45309; }
    .efinding { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.4rem 0.5rem; margin-bottom: 0.3rem; }
    .efinding__sev { font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .efinding__msg { margin: 0.15rem 0 0; color: #374151; }
    `;
  }

  protected render(result: AnalysisResult | null): void {
    if (!result || !this._elementId) {
      this.root.append(this.emptyState("Select an element to see its governance provenance."));
      return;
    }

    const entry = result.determinismMap[this._elementId];
    if (!entry) {
      this.root.append(this.emptyState("No classification for this element."));
      return;
    }

    const container = h("div", { class: "prov" }, [
      this.buildScore(entry),
      this.buildClassifications(entry),
      this.buildRationale(entry),
    ]);

    const contracts = result.runtimeDependencyMap[this._elementId]?.contracts ?? [];
    if (contracts.length > 0) container.append(this.buildContracts(contracts));

    const findings = result.findings.filter((f) => f.elementId === this._elementId);
    if (findings.length > 0) container.append(this.buildFindings(findings));

    this.root.append(container);
  }

  private buildScore(entry: DeterminismEntry): HTMLElement {
    const score = elementGovernanceScore(entry.axisY, entry.axisX);
    const color = scoreColor(score);
    return h("div", { class: "score" }, [
      h("div", { class: "score__circle", style: `border-color:${color}` }, [
        h("span", { class: "score__value" }, String(score)),
        h("span", { class: "score__max" }, "/100"),
      ]),
      h("div", { class: "score__meta" }, [
        h("span", {}, [h("b", {}, "Risk: "), AXIS_Y_INFO[entry.axisY].riskLevel]),
        h("span", {}, [h("b", {}, "Portability: "), AXIS_X_INFO[entry.axisX].portabilityLevel]),
      ]),
    ]);
  }

  private buildClassifications(entry: DeterminismEntry): HTMLElement {
    const y = AXIS_Y_INFO[entry.axisY];
    const x = AXIS_X_INFO[entry.axisX];
    return h("div", { class: "section" }, [
      h("p", { class: "section__title" }, "Classification"),
      h("div", { class: "class" }, [
        h("span", { class: "class__badge", style: `background:${y.color}` }, y.label),
        h("p", { class: "class__desc" }, y.description),
      ]),
      h("div", { class: "class" }, [
        h("span", { class: "class__badge", style: `background:${x.color}` }, x.label),
        h("p", { class: "class__desc" }, x.description),
      ]),
    ]);
  }

  private buildRationale(entry: DeterminismEntry): HTMLElement {
    return h("div", { class: "section" }, [
      h("p", { class: "section__title" }, "Rationale"),
      h("p", { class: "rationale" }, entry.rationale),
    ]);
  }

  private buildContracts(
    contracts: AnalysisResult["runtimeDependencyMap"][string]["contracts"],
  ): HTMLElement {
    const section = h("div", { class: "section" }, [
      h("p", { class: "section__title" }, `Runtime Dependencies (${contracts.length})`),
    ]);
    for (const c of contracts) {
      section.append(
        h("div", { class: "contract" }, [
          h("div", { class: "contract__name" }, c.name),
          h("div", { class: "contract__meta" }, [
            h("span", {}, c.type),
            h("span", {}, c.owner),
            h("span", { class: `contract__status contract__status--${c.status}` }, c.status),
          ]),
        ]),
      );
    }
    return section;
  }

  private buildFindings(findings: AnalysisResult["findings"]): HTMLElement {
    const section = h("div", { class: "section" }, [
      h("p", { class: "section__title" }, `Findings (${findings.length})`),
    ]);
    for (const f of findings) {
      section.append(
        h("div", { class: "efinding" }, [
          h(
            "span",
            { class: "efinding__sev", style: `color:${SEVERITY_COLOR[f.severity]}` },
            f.severity,
          ),
          h("p", { class: "efinding__msg" }, f.message),
        ]),
      );
    }
    return section;
  }
}

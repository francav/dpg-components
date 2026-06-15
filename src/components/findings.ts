// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-findings-panel> — the governance findings list, grouped by severity.
 *
 * Renders error/warning/info groups with category, policy clause, message, and
 * recommendation. A finding bound to an element emits `dpg-element-select` on
 * activation. Framework-neutral re-build of the modeler findings panel.
 */

import type { AnalysisResult, Finding, FindingSeverity } from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h } from "./dom.js";
import { SEVERITY_COLOR } from "./presentation.js";
import type { ElementSelectDetail } from "./matrix.js";

const SEVERITY_ORDER: FindingSeverity[] = ["error", "warning", "info"];

export class DpgFindingsPanel extends DpgElement {
  static readonly tagName = "dpg-findings-panel";

  protected styles(): string {
    return `
    .findings { display: flex; flex-direction: column; gap: 0.75rem; }
    .findings__header { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; }
    .findings__badge {
      background: #111827; color: #fff; border-radius: 999px;
      padding: 0.05rem 0.45rem; font-size: 11px;
    }
    .group__header {
      display: flex; align-items: center; gap: 0.4rem;
      border-left: 3px solid; padding-left: 0.5rem; margin-bottom: 0.4rem;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .group__count { color: #6b7280; font-weight: 400; }
    .group__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .finding {
      border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.6rem;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .finding--clickable { cursor: pointer; }
    .finding--clickable:hover { border-color: #9ca3af; }
    .finding__top { display: flex; align-items: center; gap: 0.4rem; }
    .finding__category {
      border-radius: 4px; padding: 0.05rem 0.35rem; font-size: 10px; font-weight: 600;
    }
    .finding__policy { color: #6b7280; font-size: 10px; }
    .finding__title { font-weight: 600; margin: 0; }
    .finding__message { margin: 0; color: #374151; }
    .finding__rec { margin: 0; color: #6b7280; font-style: italic; font-size: 12px; }
    `;
  }

  protected render(result: AnalysisResult | null): void {
    const findings = result?.findings ?? [];
    const header = h("div", { class: "findings__header" }, [
      h("span", {}, "Findings"),
      ...(findings.length > 0
        ? [h("span", { class: "findings__badge" }, String(findings.length))]
        : []),
    ]);

    if (findings.length === 0) {
      this.root.append(h("div", { class: "findings" }, [header, this.emptyState("No findings.")]));
      return;
    }

    const container = h("div", { class: "findings" }, [header]);
    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((f) => f.severity === severity);
      if (group.length === 0) continue;
      container.append(this.buildGroup(severity, group));
    }
    this.root.append(container);
  }

  private buildGroup(severity: FindingSeverity, findings: Finding[]): HTMLElement {
    const color = SEVERITY_COLOR[severity];
    const list = h("ul", { class: "group__list" });
    for (const f of findings) list.append(this.buildFinding(f, color));

    return h("div", { class: "group" }, [
      h("div", { class: "group__header", style: `border-left-color:${color};color:${color}` }, [
        h("span", {}, severity.toUpperCase()),
        h("span", { class: "group__count" }, `(${findings.length})`),
      ]),
      list,
    ]);
  }

  private buildFinding(finding: Finding, color: string): HTMLElement {
    const top = h("div", { class: "finding__top" }, [
      h(
        "span",
        {
          class: "finding__category",
          style: `background:${color}22;color:${color}`,
        },
        finding.category,
      ),
      ...(finding.policyId ? [h("span", { class: "finding__policy" }, finding.policyId)] : []),
    ]);

    const children: HTMLElement[] = [
      top,
      h("p", { class: "finding__title" }, finding.title),
      h("p", { class: "finding__message" }, finding.message),
    ];
    if (finding.recommendation) {
      children.push(h("p", { class: "finding__rec" }, `↳ ${finding.recommendation}`));
    }

    const clickable = Boolean(finding.elementId);
    const item = h("li", { class: `finding${clickable ? " finding--clickable" : ""}` }, children);
    if (clickable && finding.elementId) {
      const elementId = finding.elementId;
      item.addEventListener("click", () => {
        this.emit<ElementSelectDetail>("dpg-element-select", { elementId });
      });
    }
    return item;
  }
}

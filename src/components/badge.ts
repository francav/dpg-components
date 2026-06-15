// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-determinism-badge> — a compact process-level governance badge.
 *
 * Shows the maturity signal, score, and the first degradation flag. Rebuilt as a
 * framework-neutral custom element from the modeler's process determinism badge.
 */

import type { AnalysisResult } from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h, titleCase } from "./dom.js";
import { MATURITY_COLOR } from "./presentation.js";

export class DpgDeterminismBadge extends DpgElement {
  static readonly tagName = "dpg-determinism-badge";

  protected styles(): string {
    return `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.7rem;
      border-radius: 6px;
      color: #fff;
    }
    .badge__label { font-weight: 600; font-size: 13px; }
    .badge__meta { display: flex; gap: 0.5rem; align-items: center; opacity: 0.95; font-size: 11px; }
    .badge__degraded {
      background: rgba(255, 255, 255, 0.25);
      border-radius: 4px;
      padding: 0.1rem 0.35rem;
    }
    `;
  }

  protected render(result: AnalysisResult | null): void {
    if (!result) {
      this.root.append(this.emptyState("No analysis"));
      return;
    }

    const signal = result.summary.maturitySignal;
    const color = signal ? MATURITY_COLOR[signal] : "#9ca3af";
    const label = signal ? titleCase(signal) : "N/A";
    const scoreText = result.summary.score === null ? "N/A" : `${result.summary.score}/100`;

    const meta: HTMLElement[] = [h("span", { class: "badge__score" }, `Score: ${scoreText}`)];
    if (result.summary.degradedFlags.length > 0) {
      meta.push(h("span", { class: "badge__degraded" }, result.summary.degradedFlags[0] ?? ""));
    }

    this.root.append(
      h("div", { class: "badge", style: `background:${color}` }, [
        h("span", { class: "badge__label" }, label),
        h("span", { class: "badge__meta" }, meta),
      ]),
    );
  }
}

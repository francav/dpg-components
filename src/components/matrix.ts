// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-governance-matrix> — the two-axis governance scatter plot.
 *
 * Plots each evaluated element by determinism (Axis Y, rows) and coupling
 * (Axis X, columns), with a risk-tinted grid and a count legend. Clicking a dot
 * emits a `dpg-element-select` event carrying the element id.
 *
 * Framework-neutral re-implementation of the modeler matrix panel: same axis
 * ordering (top-right = best governance) and deterministic per-element jitter,
 * rendered with SVG via the DOM API instead of React.
 */

import type {
  AnalysisResult,
  AxisXClassification,
  AxisYClassification,
} from "../view-model/types.js";
import { DpgElement } from "./base.js";
import { h } from "./dom.js";
import { AXIS_X_INFO, AXIS_Y_INFO } from "./presentation.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Axis X columns left→right: worst coupling first (matches the legend order).
const AXIS_X_COL: Record<AxisXClassification, number> = {
  externalCoupled: 0,
  engineSpecific: 1,
  profileScoped: 2,
  selfContained: 3,
};

// Axis Y rows top→bottom: best determinism first.
const AXIS_Y_ROW: Record<AxisYClassification, number> = {
  fullyDeterministic: 0,
  policyDependent: 1,
  runtimeBound: 2,
};

const AXIS_X_ORDER: AxisXClassification[] = [
  "externalCoupled",
  "engineSpecific",
  "profileScoped",
  "selfContained",
];
const AXIS_Y_ORDER: AxisYClassification[] = [
  "fullyDeterministic",
  "policyDependent",
  "runtimeBound",
];

const COLS = 4;
const ROWS = 3;
const PAD_LEFT = 15;
const PAD_BOTTOM = 18;
const PLOT_W = 100 - PAD_LEFT;
const PLOT_H = 100 - PAD_BOTTOM;
const CELL_W = PLOT_W / COLS;
const CELL_H = PLOT_H / ROWS;
const MAX_JX = CELL_W * 0.3;
const MAX_JY = CELL_H * 0.3;

/** Deterministic per-element jitter so two ids never collide on the same point. */
function hashJitter(seed: string, salt: number, range: number): number {
  const hsum = seed.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1) * salt, 0);
  return ((hsum % 1000) / 1000 - 0.5) * 2 * range;
}

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

interface PlotPoint {
  elementId: string;
  axisY: AxisYClassification;
  axisX: AxisXClassification;
  col: number;
  row: number;
  rationale: string;
}

/** Event emitted when a matrix dot is activated. */
export interface ElementSelectDetail {
  elementId: string;
}

export class DpgGovernanceMatrix extends DpgElement {
  static readonly tagName = "dpg-governance-matrix";

  protected styles(): string {
    return `
    .matrix { display: flex; flex-direction: column; gap: 0.5rem; }
    .matrix__header { display: flex; align-items: baseline; gap: 0.5rem; }
    .matrix__title { font-weight: 600; }
    .matrix__subtitle { color: #6b7280; font-size: 11px; }
    .matrix__plot { position: relative; width: 100%; padding-top: 75%; }
    .matrix__svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .matrix__dot {
      position: absolute; width: 12px; height: 12px; border-radius: 50%;
      border: 1.5px solid #fff; transform: translate(-50%, -50%);
      cursor: pointer; padding: 0;
    }
    .matrix__dot:hover, .matrix__dot:focus-visible { outline: 2px solid #111827; outline-offset: 1px; }
    .matrix__axis-label { position: absolute; font-size: 10px; color: #6b7280; }
    .matrix__legend { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .matrix__legend-item { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 11px; }
    .matrix__legend-dot { width: 9px; height: 9px; border-radius: 50%; }
    .matrix__legend-count { color: #6b7280; }
    .matrix__legend-sep { width: 1px; height: 12px; background: #e5e7eb; }
    `;
  }

  protected render(result: AnalysisResult | null): void {
    if (!result || Object.keys(result.determinismMap).length === 0) {
      this.root.append(this.emptyState("No evaluated elements"));
      return;
    }

    const points: PlotPoint[] = Object.entries(result.determinismMap).map(([elementId, entry]) => ({
      elementId,
      axisY: entry.axisY,
      axisX: entry.axisX,
      col: AXIS_X_COL[entry.axisX],
      row: AXIS_Y_ROW[entry.axisY],
      rationale: entry.rationale,
    }));

    const header = h("div", { class: "matrix__header" }, [
      h("span", { class: "matrix__title" }, "Governance Matrix"),
      h("span", { class: "matrix__subtitle" }, `${points.length} elements`),
    ]);

    const plot = h("div", { class: "matrix__plot" });
    plot.append(this.buildGrid());

    // Axis labels.
    AXIS_Y_ORDER.forEach((key, i) => {
      plot.append(
        h(
          "span",
          {
            class: "matrix__axis-label",
            style: `left:0;top:${((i + 0.5) * CELL_H).toFixed(1)}%;width:${PAD_LEFT - 1}%;transform:translateY(-50%)`,
          },
          AXIS_Y_INFO[key].short,
        ),
      );
    });
    AXIS_X_ORDER.forEach((key, i) => {
      plot.append(
        h(
          "span",
          {
            class: "matrix__axis-label",
            style: `left:${(PAD_LEFT + (i + 0.5) * CELL_W).toFixed(1)}%;top:${PLOT_H + 2}%;width:${CELL_W}%;text-align:center;transform:translateX(-50%)`,
          },
          AXIS_X_INFO[key].short,
        ),
      );
    });

    for (const point of points) plot.append(this.buildDot(point));

    this.root.append(h("div", { class: "matrix" }, [header, plot, this.buildLegend(result)]));
  }

  private buildGrid(): SVGElement {
    const root = svg("svg", {
      class: "matrix__svg",
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
    });
    const gx = PAD_LEFT;
    const gw = PLOT_W;
    const gh = PLOT_H;

    // Risk-tinted cells: top-right best, bottom-left worst.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const risk = row + (COLS - 1 - col);
        const fill = risk <= 1 ? "#10b981" : risk <= 3 ? "#f59e0b" : "#ef4444";
        root.append(
          svg("rect", {
            x: gx + (col / COLS) * gw,
            y: (row / ROWS) * gh,
            width: gw / COLS,
            height: gh / ROWS,
            fill,
            "fill-opacity": (0.04 + risk * 0.02).toFixed(3),
          }),
        );
      }
    }
    // Grid lines + border.
    for (let i = 1; i < ROWS; i++) {
      root.append(
        svg("line", {
          x1: gx,
          y1: (i / ROWS) * gh,
          x2: gx + gw,
          y2: (i / ROWS) * gh,
          stroke: "#e5e7eb",
          "stroke-width": 0.4,
        }),
      );
    }
    for (let i = 1; i < COLS; i++) {
      root.append(
        svg("line", {
          x1: gx + (i / COLS) * gw,
          y1: 0,
          x2: gx + (i / COLS) * gw,
          y2: gh,
          stroke: "#e5e7eb",
          "stroke-width": 0.4,
        }),
      );
    }
    root.append(
      svg("rect", {
        x: gx,
        y: 0,
        width: gw,
        height: gh,
        fill: "none",
        stroke: "#d1d5db",
        "stroke-width": 0.6,
      }),
    );
    return root;
  }

  private buildDot(point: PlotPoint): HTMLElement {
    const jx = hashJitter(point.elementId, 13, MAX_JX);
    const jy = hashJitter(point.elementId, 7, MAX_JY);
    const cx = PAD_LEFT + (point.col + 0.5) * CELL_W + jx;
    const cy = (point.row + 0.5) * CELL_H + jy;
    const left = Math.max(PAD_LEFT + 0.5, Math.min(99.5, cx));
    const top = Math.max(0.5, Math.min(PLOT_H - 0.5, cy));

    const dot = h("button", {
      class: "matrix__dot",
      type: "button",
      "data-element-id": point.elementId,
      title: `${point.elementId}\n${point.axisY} · ${point.axisX}\n${point.rationale}`,
      "aria-label": `${point.elementId}: ${point.axisY}, ${point.axisX}`,
      style: `left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;background:${AXIS_Y_INFO[point.axisY].color}`,
    });
    dot.addEventListener("click", () => {
      this.emit<ElementSelectDetail>("dpg-element-select", { elementId: point.elementId });
    });
    return dot;
  }

  private buildLegend(result: AnalysisResult): HTMLElement {
    const legend = h("div", { class: "matrix__legend" });
    AXIS_Y_ORDER.forEach((key) => {
      legend.append(
        h("span", { class: "matrix__legend-item" }, [
          h("span", {
            class: "matrix__legend-dot",
            style: `background:${AXIS_Y_INFO[key].color}`,
          }),
          h("span", {}, AXIS_Y_INFO[key].short),
          h("span", { class: "matrix__legend-count" }, String(result.matrix.axisY[key])),
        ]),
      );
    });
    legend.append(h("span", { class: "matrix__legend-sep" }));
    AXIS_X_ORDER.forEach((key) => {
      legend.append(
        h("span", { class: "matrix__legend-item" }, [
          h("span", {}, AXIS_X_INFO[key].short),
          h("span", { class: "matrix__legend-count" }, String(result.matrix.axisX[key])),
        ]),
      );
    });
    return legend;
  }
}

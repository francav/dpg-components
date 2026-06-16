// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

// @vitest-environment jsdom

/**
 * React-host harness: proves the framework-neutral custom elements mount and
 * render inside a React tree. React owns the host elements; a callback ref
 * assigns the `result` property (custom elements take rich data via properties,
 * not string attributes), exactly as a real React consumer would wire them.
 */

import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";

import { defineDpgElements, DpgDeterminismBadge, DpgGovernanceMatrix } from "./index.js";
import { sampleAnalysis } from "./test-fixtures.js";

beforeAll(() => {
  defineDpgElements();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("React host harness", () => {
  it("mounts the matrix and badge as custom elements and renders the view-model", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const analysis = sampleAnalysis();

    const setResult = (el: HTMLElement | null): void => {
      if (el && "result" in el) {
        (el as { result: unknown }).result = analysis;
      }
    };

    act(() => {
      root.render(
        createElement("div", null, [
          createElement(DpgGovernanceMatrix.tagName, { key: "m", ref: setResult }),
          createElement(DpgDeterminismBadge.tagName, { key: "b", ref: setResult }),
        ]),
      );
    });

    const matrixEl = host.querySelector(DpgGovernanceMatrix.tagName) as DpgGovernanceMatrix;
    const badgeEl = host.querySelector(DpgDeterminismBadge.tagName) as DpgDeterminismBadge;

    expect(matrixEl).toBeInstanceOf(DpgGovernanceMatrix);
    expect(badgeEl).toBeInstanceOf(DpgDeterminismBadge);
    expect(matrixEl.shadowRoot?.querySelectorAll(".matrix__dot").length).toBe(3);
    expect(badgeEl.shadowRoot?.textContent).toContain("Fair");

    act(() => root.unmount());
    host.remove();
  });
});

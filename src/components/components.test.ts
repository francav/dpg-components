// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";

import {
  defineDpgElements,
  DpgDeterminismBadge,
  DpgElementProvenance,
  DpgFindingsPanel,
  DpgGovernanceMatrix,
  DpgProfilePolicySelector,
  FLAT_PANEL_TAGS,
  mountGovernancePanels,
} from "./index.js";
import type { ElementSelectDetail, SelectionChangeDetail } from "./index.js";
import { sampleAnalysis } from "./test-fixtures.js";

beforeAll(() => {
  defineDpgElements();
});

describe("defineDpgElements", () => {
  it("registers every L3 custom element and is idempotent", () => {
    expect(customElements.get(DpgGovernanceMatrix.tagName)).toBe(DpgGovernanceMatrix);
    expect(customElements.get(DpgFindingsPanel.tagName)).toBe(DpgFindingsPanel);
    // Second call defines nothing new.
    expect(defineDpgElements()).toEqual([]);
  });
});

describe("<dpg-determinism-badge>", () => {
  it("renders the maturity signal, score, and degraded flag", () => {
    const el = document.createElement(DpgDeterminismBadge.tagName) as DpgDeterminismBadge;
    document.body.append(el);
    el.result = sampleAnalysis();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Fair");
    expect(text).toContain("64/100");
    // The sample is degraded → first flag is surfaced.
    expect(text).toContain("policy-default");
    el.remove();
  });

  it("shows an empty state when there is no result", () => {
    const el = document.createElement(DpgDeterminismBadge.tagName) as DpgDeterminismBadge;
    document.body.append(el);
    expect(el.shadowRoot?.textContent).toContain("No analysis");
    el.remove();
  });
});

describe("<dpg-governance-matrix>", () => {
  it("plots one dot per evaluated element and a count legend", () => {
    const el = document.createElement(DpgGovernanceMatrix.tagName) as DpgGovernanceMatrix;
    document.body.append(el);
    el.result = sampleAnalysis();

    const dots = el.shadowRoot?.querySelectorAll(".matrix__dot");
    expect(dots?.length).toBe(3);
    expect(el.shadowRoot?.textContent).toContain("3 elements");
    el.remove();
  });

  it("emits dpg-element-select with the element id on dot click", () => {
    const el = document.createElement(DpgGovernanceMatrix.tagName) as DpgGovernanceMatrix;
    document.body.append(el);
    el.result = sampleAnalysis();

    let selected: string | null = null;
    el.addEventListener("dpg-element-select", (e) => {
      selected = (e as CustomEvent<ElementSelectDetail>).detail.elementId;
    });
    const dot = el.shadowRoot?.querySelector<HTMLButtonElement>(".matrix__dot");
    dot?.click();
    expect(selected).toBe(dot?.getAttribute("data-element-id"));
    expect(selected).not.toBeNull();
    el.remove();
  });
});

describe("<dpg-findings-panel>", () => {
  it("groups findings by severity with counts", () => {
    const el = document.createElement(DpgFindingsPanel.tagName) as DpgFindingsPanel;
    document.body.append(el);
    el.result = sampleAnalysis();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("ERROR");
    expect(text).toContain("WARNING");
    expect(text).toContain("INFO");
    expect(el.shadowRoot?.querySelectorAll(".finding").length).toBe(3);
    el.remove();
  });

  it("emits dpg-element-select for a finding bound to an element", () => {
    const el = document.createElement(DpgFindingsPanel.tagName) as DpgFindingsPanel;
    document.body.append(el);
    el.result = sampleAnalysis();

    let selected: string | null = null;
    el.addEventListener("dpg-element-select", (e) => {
      selected = (e as CustomEvent<ElementSelectDetail>).detail.elementId;
    });
    el.shadowRoot?.querySelector<HTMLElement>(".finding--clickable")?.click();
    expect(selected).toBe("ServiceTask_Score");
    el.remove();
  });
});

describe("<dpg-element-provenance>", () => {
  it("renders classification, score, rationale, contracts, and findings for an element", () => {
    const el = document.createElement(DpgElementProvenance.tagName) as DpgElementProvenance;
    document.body.append(el);
    el.result = sampleAnalysis();
    el.elementId = "ServiceTask_Score";

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("External-Coupled");
    expect(text).toContain("Policy-Dependent");
    expect(text).toContain("scoring-service");
    expect(text).toContain("undocumented");
    expect(text).toContain("Rationale");
    el.remove();
  });

  it("shows an empty state for an unknown element", () => {
    const el = document.createElement(DpgElementProvenance.tagName) as DpgElementProvenance;
    document.body.append(el);
    el.result = sampleAnalysis();
    el.elementId = "does-not-exist";
    expect(el.shadowRoot?.textContent).toContain("No classification");
    el.remove();
  });
});

describe("<dpg-profile-policy-selector>", () => {
  it("renders profile and policy options and emits change events", () => {
    const el = document.createElement(DpgProfilePolicySelector.tagName) as DpgProfilePolicySelector;
    document.body.append(el);
    el.profiles = [
      { id: "camunda-7", label: "Camunda 7" },
      { id: "camunda-8", label: "Camunda 8" },
    ];
    el.policies = [{ id: "baseline-tier-2", label: "Baseline Tier 2" }];
    el.selectedProfile = "camunda-7";

    const selects = el.shadowRoot?.querySelectorAll("select");
    expect(selects?.length).toBe(2);

    let changedProfile: string | null = null;
    el.addEventListener("dpg-profile-change", (e) => {
      changedProfile = (e as CustomEvent<SelectionChangeDetail>).detail.id;
    });
    const profileSelect = selects?.[0] as HTMLSelectElement;
    profileSelect.value = "camunda-8";
    profileSelect.dispatchEvent(new Event("change"));
    expect(changedProfile).toBe("camunda-8");
    el.remove();
  });
});

describe("mountGovernancePanels (flat layout)", () => {
  function mountFresh(options?: Parameters<typeof mountGovernancePanels>[1]) {
    const container = document.createElement("div");
    document.body.append(container);
    return { container, handle: mountGovernancePanels(container, options) };
  }

  it("mounts the flat panel set into the container", () => {
    const { container } = mountFresh();
    for (const tag of FLAT_PANEL_TAGS) {
      expect(container.querySelector(tag)).toBeTruthy();
    }
    // Flat layout drops the standalone selector (it returns inside the inspector).
    expect(container.querySelector("dpg-profile-policy-selector")).toBeNull();
  });

  it("update() propagates the result to every panel", () => {
    const { container, handle } = mountFresh();
    const result = sampleAnalysis();
    handle.update(result);

    for (const tag of FLAT_PANEL_TAGS) {
      const el = container.querySelector(tag) as HTMLElement & { result?: unknown };
      expect(el.result).toBe(result);
    }
    // Re-rendered content reflects the result.
    expect(container.querySelector("dpg-governance-matrix")?.shadowRoot?.textContent).toContain(
      "3 elements",
    );
  });

  it("routes a child dpg-element-select to onElementSelect", () => {
    let selected: string | null = null;
    const { container, handle } = mountFresh({ onElementSelect: (id) => (selected = id) });
    handle.update(sampleAnalysis());

    const matrix = container.querySelector("dpg-governance-matrix")!;
    matrix.dispatchEvent(
      new CustomEvent<ElementSelectDetail>("dpg-element-select", {
        detail: { elementId: "ServiceTask_Score" },
        bubbles: true,
        composed: true,
      }),
    );
    expect(selected).toBe("ServiceTask_Score");
  });

  it("routes dpg-profile-change / dpg-policy-change to their callbacks", () => {
    let profile: string | null = null;
    let policy: string | null = null;
    const { container } = mountFresh({
      onProfileChange: (id) => (profile = id),
      onPolicyChange: (id) => (policy = id),
    });
    const matrix = container.querySelector("dpg-governance-matrix")!;
    matrix.dispatchEvent(
      new CustomEvent<SelectionChangeDetail>("dpg-profile-change", {
        detail: { id: "camunda-8" },
        bubbles: true,
        composed: true,
      }),
    );
    matrix.dispatchEvent(
      new CustomEvent<SelectionChangeDetail>("dpg-policy-change", {
        detail: { id: "baseline-tier-1" },
        bubbles: true,
        composed: true,
      }),
    );
    expect(profile).toBe("camunda-8");
    expect(policy).toBe("baseline-tier-1");
  });

  it("setSelectedElement is a no-op stub for the flat layout", () => {
    const { handle } = mountFresh();
    expect(() => handle.setSelectedElement("ServiceTask_Score")).not.toThrow();
    expect(() => handle.setSelectedElement(null)).not.toThrow();
  });

  it("injects the passed stylesheet once (de-duped across mounts) and removes it on destroy", () => {
    const css = ".dpg-test-marker { color: red; }";
    const { handle } = mountFresh({ stylesheet: css });
    // A second mount with the same CSS must not duplicate the keyed style node.
    const { handle: handle2 } = mountFresh({ stylesheet: css });

    const styles = document.querySelectorAll("#dpg-governance-panels-style");
    expect(styles.length).toBe(1);
    expect(styles[0]?.textContent).toBe(css);

    handle.destroy();
    handle2.destroy();
    expect(document.getElementById("dpg-governance-panels-style")).toBeNull();
  });

  it("injects nothing when no stylesheet is passed", () => {
    const { handle } = mountFresh();
    expect(document.getElementById("dpg-governance-panels-style")).toBeNull();
    handle.destroy();
  });

  it("destroy() removes the panels and the delegated listener", () => {
    let selected: string | null = null;
    const { container, handle } = mountFresh({ onElementSelect: (id) => (selected = id) });
    handle.destroy();

    expect(container.children.length).toBe(0);
    // After destroy the delegated listener is gone — no further routing.
    container.dispatchEvent(
      new CustomEvent<ElementSelectDetail>("dpg-element-select", {
        detail: { elementId: "ServiceTask_Score" },
        bubbles: true,
        composed: true,
      }),
    );
    expect(selected).toBeNull();
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";

import {
  defineDpgElements,
  DpgDeterminismBadge,
  DpgElementProvenance,
  DpgFindingsPanel,
  DpgGovernanceInspector,
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
    return { container, handle: mountGovernancePanels(container, { layout: "flat", ...options }) };
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

describe("<dpg-governance-inspector>", () => {
  function mountInspector(): DpgGovernanceInspector {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.result = sampleAnalysis();
    return el;
  }

  it("process-overview renders badge, matrix, findings, and recommendations", () => {
    const el = mountInspector();
    const sr = el.shadowRoot!;

    // Header badge with the real score/maturity flowing through the adapter.
    expect(sr.querySelector("dpg-determinism-badge")).toBeTruthy();
    expect(sr.querySelector("dpg-determinism-badge")?.shadowRoot?.textContent).toContain("64/100");
    // Summary counts + contract coverage.
    expect(sr.textContent).toContain("contract coverage");
    // Matrix is collapsed behind a disclosure pull-tab; open it.
    const tab = sr.querySelector<HTMLButtonElement>(".disclosure__tab");
    expect(sr.querySelector("dpg-governance-matrix")).toBeNull();
    tab?.click();
    expect(el.shadowRoot?.querySelector("dpg-governance-matrix")).toBeTruthy();
    // Findings panel + recommendations.
    expect(el.shadowRoot?.querySelector("dpg-findings-panel")).toBeTruthy();
    expect(el.shadowRoot?.textContent).toContain("Recommendations");
    el.remove();
  });

  it("renders the profile/policy selector when profiles/policies are provided", () => {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.profiles = [{ id: "camunda-7", label: "Camunda 7" }];
    el.policies = [{ id: "baseline-tier-2", label: "Baseline Tier 2" }];
    el.result = sampleAnalysis();
    expect(el.shadowRoot?.querySelector("dpg-profile-policy-selector")).toBeTruthy();
    el.remove();
  });

  it("honors the severity filter on the overview findings panel", () => {
    const el = mountInspector();
    // All three severities present unfiltered.
    let findings = el.shadowRoot
      ?.querySelector("dpg-findings-panel")
      ?.shadowRoot?.querySelectorAll(".finding");
    expect(findings?.length).toBe(3);

    // Click the "Error" severity toggle → only the one error remains.
    const buttons = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".sevfilter__btn") ?? [],
    );
    const errorBtn = buttons.find((b) => b.textContent?.startsWith("Error"));
    errorBtn?.click();
    findings = el.shadowRoot
      ?.querySelector("dpg-findings-panel")
      ?.shadowRoot?.querySelectorAll(".finding");
    expect(findings?.length).toBe(1);
    el.remove();
  });

  it("flips to element drill-down on dpg-element-select AND re-dispatches upward", () => {
    const el = mountInspector();
    el.shadowRoot?.querySelector(".disclosure__tab")?.dispatchEvent(new MouseEvent("click"));

    let reemitted: string | null = null;
    el.addEventListener("dpg-element-select", (e) => {
      reemitted = (e as CustomEvent<ElementSelectDetail>).detail.elementId;
    });

    // A matrix dot is now in the DOM; click it.
    const dot = el.shadowRoot
      ?.querySelector("dpg-governance-matrix")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(".matrix__dot");
    dot?.click();

    // Inspector flipped into drill-down for that element …
    expect(el.selectedElementId).toBe(dot?.getAttribute("data-element-id"));
    expect(el.getAttribute("selected-element-id")).toBe(dot?.getAttribute("data-element-id"));
    // … shows the provenance card …
    expect(el.shadowRoot?.querySelector("dpg-element-provenance")).toBeTruthy();
    // … and re-dispatched the event upward (host still drives the canvas).
    expect(reemitted).toBe(dot?.getAttribute("data-element-id"));
    el.remove();
  });

  it("shows provenance for the selected element and the back control returns to overview", () => {
    const el = mountInspector();
    el.selectedElementId = "ServiceTask_Score";

    const provenance = el.shadowRoot?.querySelector("dpg-element-provenance");
    expect(provenance?.getAttribute("element-id")).toBe("ServiceTask_Score");
    expect(provenance?.shadowRoot?.textContent).toContain("External-Coupled");

    // Back control clears the selection and returns to the overview.
    el.shadowRoot?.querySelector<HTMLButtonElement>(".back")?.click();
    expect(el.selectedElementId).toBeNull();
    expect(el.shadowRoot?.querySelector("dpg-element-provenance")).toBeNull();
    expect(el.shadowRoot?.querySelector("dpg-determinism-badge")).toBeTruthy();
    el.remove();
  });

  it("re-dispatches profile/policy changes upward", () => {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.profiles = [
      { id: "camunda-7", label: "Camunda 7" },
      { id: "camunda-8", label: "Camunda 8" },
    ];
    el.policies = [{ id: "baseline-tier-2", label: "Baseline Tier 2" }];
    el.result = sampleAnalysis();

    let profile: string | null = null;
    el.addEventListener("dpg-profile-change", (e) => {
      profile = (e as CustomEvent<SelectionChangeDetail>).detail.id;
    });
    const profileSelect = el.shadowRoot
      ?.querySelector("dpg-profile-policy-selector")
      ?.shadowRoot?.querySelector<HTMLSelectElement>("select");
    profileSelect!.value = "camunda-8";
    profileSelect!.dispatchEvent(new Event("change"));
    expect(profile).toBe("camunda-8");
    el.remove();
  });
});

describe("mountGovernancePanels (inspector layout, default)", () => {
  function mountFresh(options?: Parameters<typeof mountGovernancePanels>[1]) {
    const container = document.createElement("div");
    document.body.append(container);
    return { container, handle: mountGovernancePanels(container, options) };
  }

  it("defaults to the inspector layout (one container element)", () => {
    const { container, handle } = mountFresh();
    expect(handle.layout).toBe("inspector");
    expect(container.querySelector("dpg-governance-inspector")).toBeTruthy();
    // The flat trio is NOT mounted at the container level.
    for (const tag of FLAT_PANEL_TAGS) {
      expect(container.querySelector(`:scope > ${tag}`)).toBeNull();
    }
  });

  it("update() drives the inspector and forwards profiles/policies", () => {
    const { container, handle } = mountFresh({
      profiles: [{ id: "camunda-7", label: "Camunda 7" }],
      policies: [{ id: "baseline-tier-2", label: "Baseline Tier 2" }],
    });
    handle.update(sampleAnalysis());
    const inspector = container.querySelector("dpg-governance-inspector") as DpgGovernanceInspector;
    expect(inspector.result).not.toBeNull();
    expect(inspector.shadowRoot?.querySelector("dpg-profile-policy-selector")).toBeTruthy();
  });

  it("setSelectedElement drives the inspector drill-down (canvas→panel)", () => {
    const { container, handle } = mountFresh();
    handle.update(sampleAnalysis());
    handle.setSelectedElement("ServiceTask_Score");

    const inspector = container.querySelector("dpg-governance-inspector") as DpgGovernanceInspector;
    expect(inspector.selectedElementId).toBe("ServiceTask_Score");
    expect(inspector.shadowRoot?.querySelector("dpg-element-provenance")).toBeTruthy();

    handle.setSelectedElement(null);
    expect(inspector.selectedElementId).toBeNull();
  });

  it("routes the inspector's re-dispatched dpg-element-select to onElementSelect", () => {
    let selected: string | null = null;
    const { handle } = mountFresh({ onElementSelect: (id) => (selected = id) });
    handle.update(sampleAnalysis());
    // Drive a selection through the inspector; it re-dispatches upward, the
    // helper's delegated listener routes it to the host callback.
    handle.setSelectedElement("Gateway_Approval");
    // setSelectedElement does not itself emit; simulate a child select instead.
    const inspector = handle.container.querySelector(
      "dpg-governance-inspector",
    ) as DpgGovernanceInspector;
    inspector.shadowRoot?.dispatchEvent(
      new CustomEvent<ElementSelectDetail>("dpg-element-select", {
        detail: { elementId: "ServiceTask_Score" },
        bubbles: true,
        composed: true,
      }),
    );
    expect(selected).toBe("ServiceTask_Score");
    handle.destroy();
  });
});

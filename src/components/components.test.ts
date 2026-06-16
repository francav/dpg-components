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
import { fiveClassAnalysis, sampleAnalysis } from "./test-fixtures.js";

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

  it("renders the five distinct Axis-Y rows in the legend (F.2 fidelity)", () => {
    const el = document.createElement(DpgGovernanceMatrix.tagName) as DpgGovernanceMatrix;
    document.body.append(el);
    el.result = fiveClassAnalysis();

    // One dot per element across all five Axis-Y classes.
    expect(el.shadowRoot?.querySelectorAll(".matrix__dot").length).toBe(5);
    const text = el.shadowRoot?.textContent ?? "";
    // The legend carries the two new classes as their own (short) labels.
    expect(text).toContain("Non-Det.");
    expect(text).toContain("Unknown");
    el.remove();
  });

  it("plots the human task (nonDeterministic) and call activity (unknown) on their own rows", () => {
    const el = document.createElement(DpgGovernanceMatrix.tagName) as DpgGovernanceMatrix;
    document.body.append(el);
    el.result = fiveClassAnalysis();

    const dotFor = (id: string) =>
      el.shadowRoot?.querySelector<HTMLButtonElement>(`.matrix__dot[data-element-id="${id}"]`);
    // The aria-label carries the real class — not "runtimeBound".
    expect(dotFor("UserTask_Review")?.getAttribute("aria-label")).toContain("nonDeterministic");
    expect(dotFor("CallActivity_Sub")?.getAttribute("aria-label")).toContain("unknown");
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

  // ── WU-F.4 large-process filters ─────────────────────────────────────────

  function findingCount(el: DpgGovernanceInspector): number {
    return (
      el.shadowRoot?.querySelector("dpg-findings-panel")?.shadowRoot?.querySelectorAll(".finding")
        .length ?? 0
    );
  }
  function axisBars(el: DpgGovernanceInspector): HTMLButtonElement[] {
    return Array.from(el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".axisbar") ?? []);
  }
  function severityBtn(el: DpgGovernanceInspector, prefix: string): HTMLButtonElement | undefined {
    return Array.from(
      el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".sevfilter__btn") ?? [],
    ).find((b) => b.textContent?.startsWith(prefix));
  }

  it("axis-class bars show per-class element counts from result.matrix", () => {
    const el = mountInspector();
    // All five Axis-Y rows + all four Axis-X rows always render (5 + 4 = 9),
    // even classes with zero elements (so the user sees the empty rows).
    const bars = axisBars(el);
    expect(bars.length).toBe(9);
    // Each populated Axis-Y class has exactly one element.
    const det = bars.find((b) => b.textContent?.includes("Fully Deterministic"));
    expect(det?.querySelector(".axisbar__count")?.textContent).toBe("1");
    // selfContained has zero elements.
    const self = bars.find((b) => b.textContent?.includes("Self-Contained"));
    expect(self?.querySelector(".axisbar__count")?.textContent).toBe("0");
    el.remove();
  });

  it("surfaces the Non-Deterministic + Unknown Axis-Y bars with live counts (F.2 fidelity)", () => {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.result = fiveClassAnalysis();
    const bars = axisBars(el);

    const nonDet = bars.find((b) => b.textContent?.includes("Non-Deterministic"));
    const unknown = bars.find((b) => b.textContent?.includes("Unknown"));
    expect(nonDet).toBeTruthy();
    expect(unknown).toBeTruthy();
    expect(nonDet?.querySelector(".axisbar__count")?.textContent).toBe("1");
    expect(unknown?.querySelector(".axisbar__count")?.textContent).toBe("1");
    el.remove();
  });

  it("filtering by the Non-Deterministic bar narrows findings to the human task", () => {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.result = fiveClassAnalysis();
    expect(findingCount(el)).toBe(1);

    axisBars(el)
      .find((b) => b.textContent?.includes("Non-Deterministic"))!
      .click();
    // The lone warning belongs to UserTask_Review (nonDeterministic).
    expect(findingCount(el)).toBe(1);
    expect(el.shadowRoot?.querySelector(".chip")?.textContent).toContain("Non-Deterministic");
    el.remove();
  });

  it("element drill-down shows the real Unknown class label, not Runtime-Bound", () => {
    const el = document.createElement(DpgGovernanceInspector.tagName) as DpgGovernanceInspector;
    document.body.append(el);
    el.result = fiveClassAnalysis();
    el.selectedElementId = "CallActivity_Sub";

    const text =
      el.shadowRoot?.querySelector("dpg-element-provenance")?.shadowRoot?.textContent ?? "";
    expect(text).toContain("Unknown");
    expect(text).not.toContain("Runtime-Bound");
    el.remove();
  });

  it("clicking an axis-class bar filters findings to that class and shows a removable chip", () => {
    const el = mountInspector();
    expect(findingCount(el)).toBe(3);

    // Click the runtime-bound (Axis-Y) bar → only Gateway_Approval's warning.
    axisBars(el)
      .find((b) => b.textContent?.includes("Runtime-Bound"))!
      .click();
    expect(findingCount(el)).toBe(1);
    const chip = el.shadowRoot?.querySelector(".chip");
    expect(chip?.textContent).toContain("Runtime-Bound");

    // Removing the chip clears the filter.
    el.shadowRoot?.querySelector<HTMLButtonElement>(".chip__x")?.click();
    expect(findingCount(el)).toBe(3);
    expect(el.shadowRoot?.querySelector(".chip")).toBeNull();
    el.remove();
  });

  it("clicking the active axis bar again clears the filter (toggle)", () => {
    const el = mountInspector();
    const bar = () => axisBars(el).find((b) => b.textContent?.includes("Engine-Specific"))!;
    bar().click();
    expect(findingCount(el)).toBe(1);
    bar().click();
    expect(findingCount(el)).toBe(3);
    el.remove();
  });

  it("severity badge counts compose with the active axis-class filter", () => {
    const el = mountInspector();
    // Unfiltered: 1 error, 1 warning, 1 info.
    expect(severityBtn(el, "Error")?.textContent).toBe("Error (1)");
    expect(severityBtn(el, "Warning")?.textContent).toBe("Warning (1)");

    // Filter to externalCoupled (only ServiceTask_Score, an error) → the warning
    // badge now reads 0, the error badge reads 1, "All" reads 1.
    axisBars(el)
      .find((b) => b.textContent?.includes("External-Coupled"))!
      .click();
    expect(severityBtn(el, "All")?.textContent).toBe("All (1)");
    expect(severityBtn(el, "Error")?.textContent).toBe("Error (1)");
    expect(severityBtn(el, "Warning")?.textContent).toBe("Warning (0)");
    el.remove();
  });

  it("composes severity AND axis-class filters on the findings list", () => {
    const el = mountInspector();
    // Axis-class = policyDependent (only ServiceTask_Score, an error).
    axisBars(el)
      .find((b) => b.textContent?.includes("Policy-Dependent"))!
      .click();
    expect(findingCount(el)).toBe(1);
    // Add severity = warning on top → nothing matches (intersection empty).
    severityBtn(el, "Warning")?.click();
    expect(findingCount(el)).toBe(0);
    // Severity = error → the one error returns.
    severityBtn(el, "Error")?.click();
    expect(findingCount(el)).toBe(1);
    el.remove();
  });

  it("current-element-only toggle narrows findings and composes with severity", () => {
    const el = mountInspector();
    el.selectedElementId = "ServiceTask_Score";
    // Back to overview (selection persists) so the toggle + findings are visible.
    el.shadowRoot?.querySelector<HTMLButtonElement>(".back")?.click();

    const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(".toggle input");
    expect(toggle?.disabled).toBe(false);
    // Badge shows the selected element's finding count (1).
    expect(el.shadowRoot?.querySelector(".toggle")?.textContent).toContain("(1)");

    toggle!.checked = true;
    toggle!.dispatchEvent(new Event("change"));
    expect(findingCount(el)).toBe(1);
    const chip = el.shadowRoot?.querySelector(".chip");
    expect(chip?.textContent).toContain("ServiceTask_Score");

    // Compose with a non-matching severity → empty.
    severityBtn(el, "Info")?.click();
    expect(findingCount(el)).toBe(0);
    el.remove();
  });

  it("current-element-only toggle is disabled with no selection (default off)", () => {
    const el = mountInspector();
    const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(".toggle input");
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.checked).toBe(false);
    // No filters active by default → all three findings, no chips.
    expect(findingCount(el)).toBe(3);
    expect(el.shadowRoot?.querySelector(".chip")).toBeNull();
    el.remove();
  });

  it("drill-down exposes Analysis | Properties sub-tabs; Properties shows read-only metadata", () => {
    const el = mountInspector();
    el.selectedElementId = "ServiceTask_Score";

    const tabs = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".subtabs__tab") ?? [],
    );
    expect(tabs.map((t) => t.textContent)).toEqual(["Analysis", "Properties"]);
    // Defaults to Analysis (the provenance card).
    expect(el.shadowRoot?.querySelector("dpg-element-provenance")).toBeTruthy();
    expect(el.shadowRoot?.querySelector(".props")).toBeNull();

    // Switch to Properties → provenance gone, key/value metadata shown.
    tabs.find((t) => t.textContent === "Properties")!.click();
    expect(el.shadowRoot?.querySelector("dpg-element-provenance")).toBeNull();
    const props = el.shadowRoot?.querySelector(".props");
    expect(props?.textContent).toContain("ServiceTask_Score");
    expect(props?.textContent).toContain("Policy-Dependent");
    expect(props?.textContent).toContain("External-Coupled");
    el.remove();
  });

  it("re-selecting an element resets the drill-down to the Analysis tab", () => {
    const el = mountInspector();
    el.selectedElementId = "ServiceTask_Score";
    el.shadowRoot?.querySelector<HTMLButtonElement>(".subtabs__tab:nth-child(2)")?.click(); // Properties
    expect(el.shadowRoot?.querySelector(".props")).toBeTruthy();
    // A new selection opens on Analysis again.
    el.selectedElementId = "Gateway_Approval";
    expect(el.shadowRoot?.querySelector("dpg-element-provenance")).toBeTruthy();
    expect(el.shadowRoot?.querySelector(".props")).toBeNull();
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

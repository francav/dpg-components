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

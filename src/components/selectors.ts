// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * <dpg-profile-policy-selector> — runtime-profile and policy-pack pickers.
 *
 * The compiler evaluates a model against a runtime profile + policy pack; this
 * control lets a host choose which. It is framework-neutral and data-driven: the
 * host supplies `profiles` / `policies` option lists and the current selection,
 * and the element emits `dpg-profile-change` / `dpg-policy-change` events when
 * the user picks a different one. It does not depend on the analysis result.
 *
 * Mirrors the modeler inspector's profile/policy host, decoupled from React and
 * from any specific profile/policy catalog (those live in @dpg/profiles and
 * @dpg/policies and are passed in).
 */

import { clear } from "./dom.js";
import { h } from "./dom.js";

export interface SelectorOption {
  id: string;
  label: string;
}

/** Detail for the `dpg-profile-change` / `dpg-policy-change` events. */
export interface SelectionChangeDetail {
  id: string;
}

const STYLES = `
:host {
  display: block;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  color: #1f2937;
}
:host *, :host *::before, :host *::after { box-sizing: border-box; }
.selectors { display: flex; flex-direction: column; gap: 0.6rem; }
.field { display: flex; flex-direction: column; gap: 0.2rem; }
.field__label { font-size: 11px; font-weight: 600; color: #374151; }
select {
  font: inherit; padding: 0.35rem 0.5rem; border: 1px solid #d1d5db;
  border-radius: 6px; background: #fff; color: inherit;
}
.dpg-empty { padding: 1rem; color: #9ca3af; font-size: 12px; text-align: center; }
`;

export class DpgProfilePolicySelector extends HTMLElement {
  static readonly tagName = "dpg-profile-policy-selector";

  private readonly root: ShadowRoot;
  private _connected = false;
  private _profiles: SelectorOption[] = [];
  private _policies: SelectorOption[] = [];
  private _selectedProfile: string | null = null;
  private _selectedPolicy: string | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
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

  connectedCallback(): void {
    this._connected = true;
    this.rerender();
  }

  disconnectedCallback(): void {
    this._connected = false;
  }

  private rerender(): void {
    if (!this._connected) return;
    clear(this.root);
    const style = document.createElement("style");
    style.textContent = STYLES;
    this.root.append(style);

    if (this._profiles.length === 0 && this._policies.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dpg-empty";
      empty.textContent = "No profiles or policies provided.";
      this.root.append(empty);
      return;
    }

    const container = h("div", { class: "selectors" });
    if (this._profiles.length > 0) {
      container.append(
        this.buildField("Runtime profile", this._profiles, this._selectedProfile, (id) => {
          this._selectedProfile = id;
          this.emit("dpg-profile-change", id);
        }),
      );
    }
    if (this._policies.length > 0) {
      container.append(
        this.buildField("Policy pack", this._policies, this._selectedPolicy, (id) => {
          this._selectedPolicy = id;
          this.emit("dpg-policy-change", id);
        }),
      );
    }
    this.root.append(container);
  }

  private buildField(
    label: string,
    options: SelectorOption[],
    selected: string | null,
    onChange: (id: string) => void,
  ): HTMLElement {
    const select = document.createElement("select");
    for (const opt of options) {
      const option = document.createElement("option");
      option.value = opt.id;
      option.textContent = opt.label;
      if (opt.id === selected) option.selected = true;
      select.append(option);
    }
    select.addEventListener("change", () => onChange(select.value));

    return h("label", { class: "field" }, [h("span", { class: "field__label" }, label), select]);
  }

  private emit(type: string, id: string): void {
    this.dispatchEvent(
      new CustomEvent<SelectionChangeDetail>(type, {
        detail: { id },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

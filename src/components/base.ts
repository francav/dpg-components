// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * DpgElement — the shared base for every L3 custom element.
 *
 * Framework-neutral: a standard `HTMLElement` with a Shadow DOM root and a
 * `result` property. Setting `result` (the {@link AnalysisResult} produced by
 * `mapCompilerResult`) re-renders the element. Components are usable from React
 * (assign the prop via a ref), vanilla JS (`el.result = …`), or any host.
 *
 * Subclasses implement {@link render} against `this.root` and may add their own
 * properties; the base owns connection lifecycle and style injection.
 */

import type { AnalysisResult } from "../view-model/types.js";
import { clear } from "./dom.js";

export abstract class DpgElement extends HTMLElement {
  protected readonly root: ShadowRoot;
  private _result: AnalysisResult | null = null;
  private _connected = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  /** The analysis view-model this element renders. */
  get result(): AnalysisResult | null {
    return this._result;
  }

  set result(value: AnalysisResult | null) {
    this._result = value;
    this.rerender();
  }

  connectedCallback(): void {
    this._connected = true;
    this.rerender();
  }

  disconnectedCallback(): void {
    this._connected = false;
  }

  /** Re-render only once mounted; setting `result` before connect is buffered. */
  protected rerender(): void {
    if (!this._connected) return;
    clear(this.root);
    const style = document.createElement("style");
    style.textContent = BASE_STYLES + this.styles();
    this.root.append(style);
    this.render(this._result);
  }

  /** Component-specific scoped CSS, concatenated after the shared base styles. */
  protected styles(): string {
    return "";
  }

  /** Build the element's content under {@link root}. */
  protected abstract render(result: AnalysisResult | null): void;

  /** Render a shared empty-state block when there is no result to show. */
  protected emptyState(message: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "dpg-empty";
    el.textContent = message;
    return el;
  }

  /** Dispatch a bubbling, composed CustomEvent so hosts can listen across the shadow boundary. */
  protected emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }
}

const BASE_STYLES = `
:host {
  display: block;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  color: #1f2937;
}
:host *, :host *::before, :host *::after { box-sizing: border-box; }
.dpg-empty {
  padding: 1rem;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}
button { font-family: inherit; }
`;

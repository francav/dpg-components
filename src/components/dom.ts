// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Tiny framework-neutral DOM helpers shared by the L3 custom elements.
 *
 * No UI framework, no virtual DOM — just typed wrappers over the standard DOM
 * API so the components stay dependency-free and embeddable from React, vanilla
 * JS, or any host that can mount a custom element.
 */

export type AttrMap = Record<string, string | number | boolean | null | undefined>;

/** Create an element, apply attributes, and append children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: AttrMap,
  children?: Array<Node | string> | string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "style") {
        el.setAttribute("style", String(value));
      } else if (value === true) {
        el.setAttribute(key, "");
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  if (typeof children === "string") {
    el.textContent = children;
  } else if (children) {
    for (const child of children) {
      el.append(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  return el;
}

/** Remove every child node of a node (element or shadow root). */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Capitalize the first letter of a string. */
export function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

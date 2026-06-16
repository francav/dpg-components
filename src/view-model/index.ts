// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * Framework-neutral view-model layer for @francav/components.
 *
 * Pure adapter + types + presentation constants — no UI framework, no DOM.
 * The L3 components (built in a later work unit) render this view-model.
 */

export * from "./types.js";
export * from "./compilerResult.js";
export * from "./constants.js";
export * from "./compilerAdapter.js";

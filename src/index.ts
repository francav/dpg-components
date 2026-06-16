// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * @dpg/components — L3 component layer.
 *
 * Exposes two layers:
 *  - the framework-neutral view-model: the adapter that maps compiler output
 *    onto the renderable {@link AnalysisResult} shape, plus its types and
 *    presentation constants; and
 *  - the custom-element layer: framework-neutral Web Components that render that
 *    view-model (`defineDpgElements()` registers them).
 */

export * from "./view-model/index.js";
export * from "./components/index.js";

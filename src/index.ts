// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Victor França

/**
 * @dpg/components — L3 component layer.
 *
 * This entrypoint currently exposes the framework-neutral view-model: the
 * adapter that maps compiler output onto the renderable {@link AnalysisResult}
 * shape, plus its types and presentation constants. The custom-element layer is
 * added in a later work unit and renders this view-model.
 */

export * from "./view-model/index.js";

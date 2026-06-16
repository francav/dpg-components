# @francav/components

Framework-neutral Web Components (custom elements) that render DPG governance
analysis — determinism classification, findings, contract coverage, and a
maturity signal — in any host: React, Angular, or plain HTML. They consume the
`CompilerResult` boundary via a view-model adapter and emit composed
CustomEvents for host wiring. The package ships built JavaScript and type
declarations.

## Install

```sh
npm install @francav/components
```

## Usage

```ts
import { defineDpgElements, mapCompilerResult } from "@francav/components";

// Register every L3 custom element once (idempotent).
defineDpgElements();

// Map a CompilerResult onto the renderable view-model and feed an element.
const result = mapCompilerResult(compilerResult);

const inspector = document.createElement("dpg-governance-inspector");
inspector.result = result;
document.body.appendChild(inspector);
```

The registered elements are `dpg-determinism-badge`, `dpg-governance-matrix`,
`dpg-findings-panel`, `dpg-element-provenance`, `dpg-profile-policy-selector`,
and the composed container `dpg-governance-inspector`. Set the `result`
property (and, where relevant, `elementId` / `profiles` / `policies`) and the
element renders.

To mount the standard panel set into a container in one call, use the
`mountGovernancePanels(container, options)` helper.

## License

Apache-2.0

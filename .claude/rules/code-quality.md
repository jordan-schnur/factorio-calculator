# Code quality tenets (MUST follow)

These hold for every file under `src/`, `tests/` and any config you touch.

## 1. No comments over one line

- A comment is a single line. No block comments, no multi-line `//` runs, no JSDoc paragraphs.
- If it takes more than a line to explain, rename, extract a function or a component until it doesn't.
- History and rationale go in the commit message, not the code.
- Licence notices use the one-line SPDX form: `// SPDX-License-Identifier: Apache-2.0 · Copyright 2019 Kirk McDonald`.
- Legacy files in `src/lib/` still carry long comments; when you touch a file, bring the comments you touch down to one line.

## 2. Reuse components

- Before writing markup, look in `src/components/` for one that already does it.
- The same markup in two places is a component. Extract it, then use it in both.
- Components take props for what differs; they don't fork into near-copies.

## 3. More than three classes means a component

- An element that needs more than 3 classes should usually be a component, likely with variants.
- Express the variation as props (`<Button variant="green" size="sm">`), and let the component map props to classes.
- Never build class strings by hand at call sites to get around this.

---
applyTo: "src/client/**/*.{ts,tsx,css}"
---
# Design To Code Standards

## Goal

Implement the approved design from design.pen into the existing app with high visual parity and zero architecture drift.

## Source Of Truth Priority

1. design.pen and approved design decisions in the handoff.
2. Existing reusable UI components and layout patterns in the codebase.
3. Existing design tokens, spacing scale, and typography scale.
4. New component creation only when reuse is impossible.

## Required Workflow

1. Read the design handoff fully before coding.
2. Search existing components first (especially src/client/components and src/client/components/ui).
3. Reuse existing layout primitives and UI components whenever possible.
4. If a required variant is missing, extend the existing component API before creating a new component.
5. Create a new reusable component in src/client/components/ui only if extension is not feasible.
6. Never implement one-off inline component copies inside pages.
7. Preserve existing routing, state, hooks, query patterns, and API contracts unless explicitly requested.

## Architecture Guardrails

- Keep business logic in hooks/services or existing logic layers, not in presentation-only components.
- Do not introduce new global state libraries or parallel data-fetching patterns.
- Follow existing naming, file structure, and import conventions.
- Keep code identifiers in English.

## Visual Rules

- Keep French labels from design.
- Keep French UI copy exactly as approved in design and product text.
- Use existing tokens/utilities; avoid hardcoded values unless already standard in codebase.
- Match spacing, hierarchy, and responsive behavior from design.
- Respect existing color, radius, elevation, and interaction patterns.

## Accessibility And UX Baseline

- Preserve keyboard navigation and visible focus states.
- Ensure form controls have proper labels and accessible names.
- Preserve semantic structure for headings, tables, and interactive controls.
- Do not remove validation messages, loading states, or empty states.

## Forbidden Changes (Unless Explicitly Requested)

- API contract changes (request/response shapes, endpoint behavior).
- Unrelated refactors in files outside implementation scope.
- Replacing existing reusable components with one-off markup.
- Silent text rewrites or translation changes outside the approved copy.

## Delivery Checklist

- List files changed.
- List reused components.
- List newly created components and why reuse was impossible.
- Confirm desktop/mobile parity.
- Confirm accessibility checks completed for modified UI.
- Confirm typecheck/test status.

## Required Final Report Format

The implementation response must include:

1. Scope implemented (what from design was delivered).
2. Files changed.
3. Reused components.
4. New components created and rationale.
5. Behavior preserved (routing/state/API confirmation).
6. Validation results (typecheck, tests, and any known remaining gaps).

## Quality Gate

Treat the task as incomplete if any of the following is missing:

- Visual parity for desktop and mobile.
- Reuse-first component strategy.
- Architecture and API preservation.
- Clear final report with validation outcomes.

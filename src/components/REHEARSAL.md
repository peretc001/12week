# Rehearsal: 12-week tracker prototype

Gold: `calendar` for the populated time grid and selected interval; `overlap`
for the raised goal dialog over the main product surface.

Beats: static interactive prototype — select a week, toggle checklist items,
change a theme, open the goal dialog, switch the goal type, select repeat days.

Captured: not captured.

Gate: not run.

Film: not run.

Review: not run.

Assumptions:

- desktop prototype at a 1600 × 1000 design size;
- product data is local mock state;
- Supabase environment values are intentionally unused at this stage;
- the StageShow kit may be extended only with explicit user approval.

Unresolved:

- a compact mobile composition;
- arbitrary date and time pickers;
- persistence and authentication.

Not checked:

- build, lint, typecheck and tests;
- StageShow film/rehearsal gate;
- screenshots in `light`, `dark`, `blueprint` and `glass`.

These checks were intentionally not run because the user requires explicit
permission before any build or verification command.

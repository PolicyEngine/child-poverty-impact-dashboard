# Adding a reform option

This guide is the checklist every PR that wires a new reform option must follow.
The goal of the architecture is simple: **whatever options a user selects in a
state, they reach the impact page with a real result — the dashboard never
breaks.** Two automated gates enforce that (see [How options are
guarded](#how-options-are-guarded)); a new option is "done" only when both pass.

## How an option becomes an impact

```
ReformOption (registry / builder)
   └─ id, e.g. "ca_ctc" / "ny_dependent_exemption" / "federal_afa"
        │  selected in the UI (ReformOptionsSelector)
        ▼
buildReformDict([...ids], parameterValues, year)   ← frontend/lib/reforms.ts
   └─ dispatches by ID suffix (_ctc / _eitc / _dependent_exemption) or a
      federal/universal switch case → a flat { "param.path": value } dict
        │  POSTed to Modal (frontend/lib/api.ts → modalApi.ts)
        ▼
scripts/modal_cpid_endpoint.py
   └─ _build_core_reform_dict → Reform.from_dict → Microsimulation → impact
```

If `buildReformDict` doesn't recognize an ID it **throws**
(`Unknown or unwired reform option`). If it emits a parameter path that doesn't
exist in the pinned `policyengine-us`, the Modal sim raises. Either way the user
gets "Analysis failed" instead of an impact — which is exactly what the gates
below prevent from shipping.

## Where options are registered

| Option kind | ID suffix | Where to register | Dispatch |
|---|---|---|---|
| State CTC | `{st}_ctc` | `CTC_REFORMS` + builders in `frontend/lib/state-programs.ts` | `buildStateCtcReform` |
| State EITC (match) | `{st}_eitc` | `frontend/data/eitc-reforms.json` | `buildStateEitcReform` |
| State EITC (structured) | `{st}_eitc` | `STRUCTURED_EITC` in `state-programs.ts` | `buildStructuredEitcReform` |
| Dependent exemption/credit | `{st}_dependent_exemption` | `frontend/data/dependent-exemption-reforms.json` | `buildDependentExemptionReform` |
| Federal / universal | exact ID | `switch` in `applyReformOption` (`frontend/lib/reforms.ts`) | inline literal paths |

The per-state options are surfaced by `getReformOptionsForState` in
`state-programs.ts` (the single enumeration entry point the tests use).

## Steps to wire a new option

1. **Confirm the PE-US lever exists in the pinned version.** Find the parameter
   path or contrib flag in `policyengine-us` (the version pinned in
   `pyproject.toml`). If the lever isn't shipped yet, you can still surface the
   option but mark it `in_development: true` (greyed out, not selectable) until a
   PE-US release adds it — never wire a path that doesn't exist.

2. **Register the option** in the right place from the table above. Give it a
   stable `id`, `name`, `description`, `category`, and — if the user can tune it
   — an `adjustable_params` array. Each adjustable param needs a sensible
   `default_value` that reproduces current law (so selecting the option at
   defaults is a no-op until the user changes something).

3. **Make sure it dispatches.** State options route by suffix automatically;
   a federal/universal option needs a new `case` in `applyReformOption`. Emit
   **only changed parameters** (keep the no-op-at-default guard).

4. **Keep the `policyengine-us` pin in sync** if you bump it — it appears in
   four places that must match: `pyproject.toml`, `backend/requirements.txt`,
   the Modal image in `scripts/modal_cpid_endpoint.py`, and the install step in
   `.github/workflows/ci.yml`.

5. **Run the gates locally** (see below). Fix any failure by correcting the
   path/registry — or marking the option `in_development` if PE-US support isn't
   there yet. Don't silently drop coverage.

## How options are guarded

Two layers, both run in CI (`.github/workflows/ci.yml`) and locally:

- **TS coverage sweep** — `frontend/__tests__/reform-coverage.test.ts`. Walks
  every selectable `(state, option)` via `getReformOptionsForState` and asserts
  `buildReformDict` builds a valid dict (no throw) at default params, at an
  edited value, and in an all-categories combo. Catches wiring/dispatch
  regressions instantly, no PE-US needed.

- **Python compute test** — `tests/calculations/test_reform_computes.py`,
  driven by the manifest (`npm run manifest` →
  `frontend/__generated__/reform-manifest.json`). Two layers against the
  *pinned* PE-US:
  - **path resolution (every entry)** — asserts every parameter path the option
    emits exists in the pinned system's parameter tree. Catches typos,
    renamed/removed params, out-of-range bracket indices, wrong breakdown keys —
    the failure mode most likely to silently break a state. Fast (one system
    build, then instant), so it covers *all* options.
  - **representative compute (curated subset)** — a real
    `Simulation(reform=…).calculate(…)` for one reform per dispatch branch /
    mechanism, catching the rare compute-time failure a path check can't.
    Building a reformed PE-US system costs ~30s, so full per-entry compute is
    opt-in via `CPID_FULL_COMPUTE=1` (a nightly/pre-release sweep, not PR CI).

Both consume the shared enumeration helpers in `frontend/lib/reform-coverage.ts`,
so a newly registered, non-`in_development` option is automatically covered — you
don't write a bespoke test per option, you just make the gates pass.

### Run the gates

```bash
cd frontend
npm run lint
npm run type-check
npm run test            # includes the coverage sweep
npm run manifest        # writes frontend/__generated__/reform-manifest.json
cd ..
pip install "policyengine-us==<pinned>" pytest
pytest tests/calculations/test_reform_computes.py -q
# Optional exhaustive sweep (slow): CPID_FULL_COMPUTE=1 pytest tests/calculations/test_reform_computes.py -q
```

If you mark an option `in_development`, note in the PR description why (e.g.
"awaiting PE-US release with `gov.states.xx.…`") so it isn't forgotten.

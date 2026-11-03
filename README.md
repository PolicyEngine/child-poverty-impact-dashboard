# Child Poverty Impact Dashboard

A specialized analytical interface for modeling and comparing policy reforms across all 50 US states and DC, with focus on child poverty reduction.

## Features

### Policy Reforms

Each reform below is wired end-to-end to a real PolicyEngine-US parameter,
so selecting it produces an actual microsimulated impact. Options that
don't yet map to a PE-US lever are not offered (no zero-impact placeholders).

- **Restore 2021 expanded CTC** (federal): $3,600 for children under 6,
  $3,000 for ages 6–17, fully refundable, with the ARPA phase-out
  structure (`gov.irs.credits.ctc.amount.arpa`,
  `…refundable.fully_refundable`, `…phase_out.arpa.in_effect`).
- **Child allowance** (federal, available in every state): annual cash
  payment per child across three composable age tiers — under 1, ages 1–5,
  and ages 6 up to an adjustable cutoff (under 18 or under 19) — via the
  ubi_center basic income (`gov.contrib.ubi_center.basic_income`). Set the
  three amounts equal for a flat allowance, or any tier to $0 to drop it.
  An optional **AGI phase-out** (toggle + rate + thresholds by filing
  status, via `…basic_income.phase_out`) income-tests it into a CTC-style
  credit — so states with no CTC can use this rather than a bespoke one.
- **State EITC** (40 states + DC): adjustable match rate as a percentage
  of the federal EITC; creates, expands, or converts-to-refundable
  depending on the state's current law.
- **State CTC** (current law, 14 states): when the selected state has a
  Child Tax Credit, its existing parameters — credit amount, age limit,
  and phase-out (threshold(s)/rate) — appear as typed input boxes so the
  credit can be modified. Only parameters you change from current law are
  sent, so an unmodified selection is a no-op.
  - Flat-amount: **CA** (young-child), **DC**, **GA**, **IL** (% of state
    EITC), **MD**, **MN**, **OR**, **UT**, **VT**.
  - Income-bracketed amount (per-tier inputs): **CO**, **NE**, **NJ**, **NM**.
  - **NY** (Empire State Child Credit): by-age amounts + phase-out by
    filing status. Its 2025–2027 structure reverts after 2027, so for
    analysis years 2028+ there's an **"extend"** toggle — on keeps the
    age-based credit, off reverts to the regular 33%-of-federal credit.

  States with no current-law CTC can use the federal child allowance above
  instead. (Excluded: NC — repealed; WV — its credit is for seniors, not
  children; ID — dormant; OK — childcare hybrid.)

**Fully wired**: SNAP reforms (gross income limit, net income test,
minimum benefit, earned-income deduction) are live, adjustable levers.
The 50% federal EITC expansion remains greyed out pending a PE-US lever.

### Results Display
- Fiscal costs (federal and state)
- Child poverty impact (overall and ages 0-3)
- Distributional effects by income decile
- State-by-state comparisons

## Architecture

```
child-poverty-impact-dashboard/
├── frontend/                 # Next.js + ui-kit (Vercel)
│   ├── app/                 # App-router pages
│   ├── components/          # React components (wizard, header, charts)
│   ├── data/                # Static state programs + EITC reform JSON
│   └── lib/                 # API clients + state-programs registry
├── scripts/
│   ├── modal_cpid_endpoint.py         # Modal-hosted compute backend
│   └── build_populace_state_slices.py # Per-state dataset files for it
├── backend/                 # Legacy FastAPI (the frontend no longer calls it)
├── cpid_calc/               # Shared Python calculation package
└── tests/
```

The production frontend on Vercel has no Python runtime — heavy
microsimulation work goes to **Modal** via the spawn-and-poll endpoint
in `scripts/modal_cpid_endpoint.py`. Static lookups (state programs,
reform options, EITC paths) live as JSON in `frontend/data/` so the
wizard can render reform options without any backend hop.

## Deploying the Modal backend

The backend runs on [policyengine.py](https://github.com/PolicyEngine/policyengine.py)
(`policyengine[us]` on PyPI). Its release bundle pins the policyengine-us,
policyengine-core and spm-calculator versions, and certifies the dataset that
US state and congressional-district regions use (the Microcosm ACS-local file
in `policyengine/populace-us`). The pin appears in
`scripts/modal_cpid_endpoint.py`, `scripts/build_populace_state_slices.py`,
`analysis/state_audit/state_audit_py_modal.py`, `pyproject.toml`,
`backend/requirements.txt` and `.github/workflows/ci.yml`; keep them equal.

```bash
# 1. Once per policyengine.py bump that changes the state dataset: split it
#    into one file per state on the cpid-populace-slices Volume (about 7
#    minutes; the endpoint refuses to compute until the files match the
#    installed bundle).
modal run scripts/build_populace_state_slices.py
# 2. Deploy.
modal deploy scripts/modal_cpid_endpoint.py
```

Modal prints a persistent URL. Set it as `NEXT_PUBLIC_MODAL_CPID_URL`
on the Vercel project (Production + Preview) and in
`frontend/.env.local` for dev. The frontend has no other backend: without the
variable, statewide and household analyses report an error.

`/healthz` reports the deployed policyengine.py, policyengine-us and
policyengine-core versions, the dataset URI and SHA-256, and `CPID_BUILD_REV`.
Bump `CPID_BUILD_REV` in `scripts/modal_cpid_endpoint.py` with every pin,
data or compute change: it is part of every results-cache key and Supabase row.

## Installation

### Quick Start (Recommended)
```bash
make install    # Install all dependencies
make dev        # Start both backend and frontend
```

### Manual Installation

#### Backend
```bash
# policyengine.py needs Python 3.11 or later.
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
uv pip install -r backend/requirements.txt
```

#### Frontend
```bash
cd frontend
bun install
```

### Available Make Commands
```bash
make install          # Install all dependencies (backend + frontend)
make install-backend  # Install backend only
make install-frontend # Install frontend only
make dev              # Run full stack
make dev-backend      # Run backend only (port 8000)
make dev-frontend     # Run frontend only (port 3000)
make test             # Run tests
make format           # Format code
make clean            # Remove all build artifacts
```

## Development

### Running Tests
```bash
make test
```

### Running the Full Stack
```bash
make dev
```

Or manually in separate terminals:
```bash
# Terminal 1 - Backend
make dev-backend

# Terminal 2 - Frontend
make dev-frontend
```

## Data Sources

- PolicyEngine US microsimulation model
- Current Population Survey (CPS) data
- State-specific tax and benefit parameters

## License

MIT License - see LICENSE file for details.

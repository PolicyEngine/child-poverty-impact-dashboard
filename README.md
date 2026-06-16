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

**Shown but in development** (greyed-out, non-selectable until wired to a
PE-US lever): SNAP benefit increases and the 50% federal EITC expansion.

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
│   └── modal_cpid_endpoint.py  # Modal-hosted compute backend
├── backend/                 # Legacy FastAPI (still used for local dev)
├── cpid_calc/               # Shared Python calculation package
└── tests/
```

The production frontend on Vercel has no Python runtime — heavy
microsimulation work goes to **Modal** via the spawn-and-poll endpoint
in `scripts/modal_cpid_endpoint.py`. Static lookups (state programs,
reform options, EITC paths) live as JSON in `frontend/data/` so the
wizard can render reform options without any backend hop.

## Deploying the Modal backend

```bash
modal deploy scripts/modal_cpid_endpoint.py
```

Modal prints a persistent URL. Set it as `NEXT_PUBLIC_MODAL_CPID_URL`
on the Vercel project (Production + Preview) and in
`frontend/.env.local` for dev. When the env var is empty, the frontend
falls back to the local FastAPI in `backend/` (handy for offline work).

The Modal image pins `policyengine-us==1.729.5` for reproducibility —
bump the version in `scripts/modal_cpid_endpoint.py` and redeploy when
we want to refresh.

## Installation

### Quick Start (Recommended)
```bash
make install    # Install all dependencies
make dev        # Start both backend and frontend
```

### Manual Installation

#### Backend
```bash
uv venv
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

# Child Poverty Impact Dashboard

A specialized analytical interface for modeling and comparing policy reforms across all 50 US states and DC, with focus on child poverty reduction.

## Features

### Policy Reforms
- **Child Tax Credit (CTC)**: Variations by amount, age eligibility (prenatal-3, 0-5, 0-17), income basis, and phaseout structure
- **Earned Income Tax Credit (EITC)**: Individualization and expansion options
- **Dependent Exemptions**: Federal and state-level modifications
- **Universal Basic Income**: Child allowance programs
- **SNAP Modifications**: Benefit expansions and eligibility changes
- **State-Specific Policy Levers**: Custom state CTC programs and local reforms

### Results Display
- Fiscal costs (federal and state)
- Child poverty impact (overall and ages 0-3)
- Distributional effects by income decile
- State-by-state comparisons

## Architecture

```
child-poverty-impact-dashboard/
├── backend/                 # FastAPI REST API
│   └── app/
│       ├── api/            # Route and model definitions
│       ├── core/           # Configuration and data management
│       └── services/       # Business logic
├── frontend/               # Next.js/React application
│   ├── app/               # Pages and layouts
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # API client and types
├── cpid_calc/             # Shared calculation package
│   ├── calculations/      # Core calculation logic
│   ├── reforms/           # Reform definitions
│   └── data/              # Static data and constants
└── tests/                 # Test suite
```

## Installation

### Backend
```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Calculation Package
```bash
pip install -e ".[dev]"
```

## Development

### Running Tests
```bash
pytest tests/
```

### Running the Full Stack
```bash
# Terminal 1 - Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Data Sources

- PolicyEngine US microsimulation model
- Current Population Survey (CPS) data
- State-specific tax and benefit parameters

## License

MIT License - see LICENSE file for details.

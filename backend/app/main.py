"""
FastAPI application for the Child Poverty Impact Dashboard.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import reforms, analysis, states, household
from app.core.config import settings

app = FastAPI(
    title="Child Poverty Impact Dashboard API",
    description="""
    API for analyzing child poverty impacts of policy reforms across US states.

    ## Features
    - Enter household details and see personalized impacts
    - View state-specific reform options based on existing programs
    - Model CTC, EITC, SNAP, UBI, and state-specific reforms
    - Calculate poverty impacts, fiscal costs, and distributional effects
    - Compare reforms across all 50 states and DC
    """,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(reforms.router, prefix="/api/reforms", tags=["reforms"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(states.router, prefix="/api/states", tags=["states"])
app.include_router(household.router, prefix="/api/household", tags=["household"])


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Child Poverty Impact Dashboard API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}

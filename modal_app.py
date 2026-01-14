"""
Modal deployment for Child Poverty Impact Dashboard.
Serves FastAPI backend with PolicyEngine-US calculations.
"""

import modal

app = modal.App("child-poverty-dashboard")

# Image with Python dependencies for backend
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi>=0.109.0",
        "uvicorn>=0.27.0",
        "policyengine-us>=1.0.0",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "microdf-python>=0.3.0",
    )
    .add_local_dir("backend", "/app/backend", copy=True)
    .add_local_dir("cpid_calc", "/app/cpid_calc", copy=True)
)


@app.function(
    image=image,
    cpu=2.0,
    memory=4096,
    timeout=300,
    allow_concurrent_inputs=10,
)
@modal.asgi_app()
def api():
    """Serve the FastAPI backend."""
    import sys
    sys.path.insert(0, "/app")

    from backend.app.main import app as fastapi_app
    return fastapi_app


# For local testing
if __name__ == "__main__":
    modal.serve(app)

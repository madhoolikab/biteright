import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dashboard, insights, meals, profile, water, weight

app = FastAPI(title="BiteRight API", version="0.1.0")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(meals.router, prefix="/api/v1")
app.include_router(water.router, prefix="/api/v1")
app.include_router(weight.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

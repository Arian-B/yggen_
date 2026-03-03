from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.connection import db
from app.routers import expedition_routes, auth_routes

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0"
)

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Event Handlers
@app.on_event("startup")
async def startup_event():
    db.connect()
    print(f"\n🚀 ArangoDB UI available at: {settings.ARANGO_HOST}\n")

# Include Routers
app.include_router(auth_routes.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Auth"])
app.include_router(expedition_routes.router, prefix=f"{settings.API_PREFIX}/expedition", tags=["Expedition"])

@app.get("/")
async def root():
    return {"message": "Yggen Backend Operational"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected" if db.db else "disconnected"}

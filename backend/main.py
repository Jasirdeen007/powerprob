from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from routers.historical import router as historical_router
from routers.profiles import router as profiles_router
from routers.sessions import router as sessions_router
from routers.websocket import router as websocket_router
from services.config import settings
from services.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="PowerProbe Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)
app.include_router(profiles_router)
app.include_router(historical_router)
app.include_router(websocket_router)


@app.middleware("http")
async def log_requests(request, call_next):
    response = await call_next(request)
    logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.get("/health")
def health_check():
    return {"status": "ok"}

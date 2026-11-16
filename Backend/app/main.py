from fastapi import FastAPI
from app.database import engine, Base
from app import models
from app.routes import auth, trip, encryption

from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from app.redis_client import redis_client, close_redis_connection


@asynccontextmanager
async def lifespan(app: FastAPI):

    # verify Redis is rechanble before serving requests.
    redis_client.ping()

    yield

    # close the shared redis connection during the shutdown
    close_redis_connection()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://32.236.88.110"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix="/auth")
app.include_router(trip.router)
app.include_router(encryption.router, prefix="/encryption")

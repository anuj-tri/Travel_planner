from fastapi import FastAPI
from app.database import engine, Base
from app import models
from app.routes import auth, trip

app = FastAPI()
Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix ="/auth")
app.include_router(trip.router)

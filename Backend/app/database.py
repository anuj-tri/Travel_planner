from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os
from dotenv import load_dotenv
load_dotenv("../.env")



url = os.getenv("DATABASE_URL")

engine = create_engine(url)

session = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = session()

    try:
        yield db
    finally:
        db.close()

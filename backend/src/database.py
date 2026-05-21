from typing import Generator
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy import create_engine


# TODO: zrobić pydantic BaseSetting config pod to
DATABASE_URL = "sqlite:///pz.db"


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    # też można zparametryzować pod łatwiejszy debugging:
    # jak jest "True", to printuje operacje na bazie dancych, konkretne SQL query
    echo=False,
)

SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
        )


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


class Base(DeclarativeBase):
    pass

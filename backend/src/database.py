from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from src.config import config


class Base(DeclarativeBase):
    pass


engine = create_engine(
    url=config.database_url,
    pool_pre_ping=True,
    echo=config.debug,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


def get_db():
    with SessionLocal() as session:
        yield session

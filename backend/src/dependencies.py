from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db

type DBDep = Annotated[Session, Depends(get_db)]

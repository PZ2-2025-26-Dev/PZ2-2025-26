from fastapi import FastAPI

from src.admin.router import router as admin_router
from src.borrowing.router import router as borrowing_router
from src.equipment.router import router as eq_router
from src.location.router import router as loc_router

app = FastAPI()

app.include_router(eq_router)
app.include_router(loc_router)
app.include_router(admin_router)
app.include_router(borrowing_router)

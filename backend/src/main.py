from fastapi import FastAPI

from src.equipment.router import router as eq_router

app = FastAPI()

app.include_router(eq_router)

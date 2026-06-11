from pydantic import BaseModel, ConfigDict

type GuestID = int

class Guest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: GuestID
    first_name: str
    last_name: str | None = None
    email: str | None = None
    description: str | None = None

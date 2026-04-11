from pydantic import BaseModel, ConfigDict, Field


class UniversityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    short_name: str | None = None
    is_active: bool = True


class UniversityCreate(BaseModel):
    name: str = Field(..., max_length=255)
    short_name: str | None = Field(None, max_length=50)

from pydantic import BaseModel, ConfigDict, Field


class UniversityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    short_name: str | None = None
    registration_code: str
    is_active: bool = True


class UniversityCreate(BaseModel):
    name: str = Field(..., max_length=255)
    short_name: str | None = Field(None, max_length=50)
    registration_code: str = Field(..., pattern=r"^\d{5}$")


class UniversityCodeUpdate(BaseModel):
    registration_code: str = Field(..., pattern=r"^\d{5}$")

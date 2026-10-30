"""Request validation independent of the transport framework."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ItemFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    sku: str = Field(min_length=2, max_length=48, pattern=r"^[A-Z0-9][A-Z0-9_-]*$")
    category: str = Field(min_length=2, max_length=64)
    unit: str = Field(min_length=1, max_length=16)
    reorder_level: int = Field(ge=0, le=1_000_000)

    @field_validator("sku", mode="before")
    @classmethod
    def normalize_sku(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value


class ItemCreate(ItemFields):
    quantity: int = Field(ge=0, le=1_000_000)


class ItemUpdate(ItemFields):
    pass


class StockMovementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    item_id: int = Field(ge=1)
    delta: int = Field(ge=-1_000_000, le=1_000_000)
    note: str = Field(default="", max_length=255)

    @field_validator("delta")
    @classmethod
    def not_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("delta must be non-zero")
        return value

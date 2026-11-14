from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FireHazRRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    fuel: Literal["Methanol", "Heptane"]
    pressure_mmhg: float = Field(gt=0, strict=True)
    o2_fraction: float = Field(ge=0, le=1, strict=True)
    n2_fraction: float = Field(ge=0, le=1, strict=True)
    co2_fraction: float = Field(ge=0, le=1, strict=True)
    he_fraction: float = Field(ge=0, le=1, strict=True)
    diameter_mm: float = Field(gt=0, strict=True)

    @model_validator(mode="after")
    def validate_mixture(self):
        total = self.o2_fraction + self.n2_fraction + self.co2_fraction + self.he_fraction
        if abs(total - 1) > 0.025:
            raise ValueError("Gas mole fractions must sum to 1 (rounding tolerance: 0.025).")
        return self

    def conditions(self):
        return (
            self.pressure_mmhg, self.o2_fraction, self.n2_fraction,
            self.co2_fraction, self.he_fraction, self.diameter_mm,
        )

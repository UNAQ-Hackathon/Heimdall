from pydantic import BaseModel


class FlammabilityPoint(BaseModel):
    oxygen_pct: float
    flow_velocity: float
    flammable: bool = True
    weight: float = 1.0


class GridSpec(BaseModel):
    o2_min: float = 15.0
    o2_max: float = 40.0
    vel_min: float = 0.0
    vel_max: float = 1.0
    resolution: int = 40


class FlammabilityRequest(BaseModel):
    points: list[FlammabilityPoint]
    grid: GridSpec = GridSpec()


class Cell(BaseModel):
    oxygen_pct: float
    flow_velocity: float
    probability: float | None = None   # None = no data (bounded, honest)
    lower: float | None = None
    upper: float | None = None


class FlammabilityResponse(BaseModel):
    cells: list[Cell]
    note: str = "Partial-gravity data is not available in PSI; Delaunay hull cells mark tested parameter-space bounds, never unmeasured predictions."

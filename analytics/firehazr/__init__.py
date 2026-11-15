from pathlib import Path

_SOURCE_CANDIDATES = (
    Path(__file__).resolve().parents[2] / "PredictorFireHazard-main" / "Sensibilidad de gases" / "knn",
    Path(__file__).resolve().parents[1] / "PredictorFireHazard-main" / "Sensibilidad de gases" / "knn",
)
SOURCE_DIR = next((candidate for candidate in _SOURCE_CANDIDATES if candidate.exists()), _SOURCE_CANDIDATES[0])
__path__.append(str(SOURCE_DIR))

from pathlib import Path

SOURCE_DIR = Path(__file__).resolve().parents[2] / "PredictorFireHazard-main" / "Sensibilidad de gases" / "knn"
__path__.append(str(SOURCE_DIR))

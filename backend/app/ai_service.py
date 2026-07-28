import logging
import warnings
from functools import lru_cache
from pathlib import Path

import joblib

from app import schemas
from app.config import settings

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "cpu_percent",
    "memory_percent",
    "traffic_in_mbps",
    "traffic_out_mbps",
    "latency_ms",
    "packet_loss_percent",
]
SCENARIO_ORDER = [
    "baseline",
    "stress_cpu",
    "high_traffic",
    "high_latency",
    "packet_loss",
    "attack_test",
]
_load_error_logged = False


@lru_cache(maxsize=1)
def load_model_artifact() -> dict:
    model_path = Path(settings.ai_model_path).expanduser().resolve()
    if not model_path.is_file():
        raise FileNotFoundError(f"AI model not found: {model_path}")

    artifact = joblib.load(model_path)
    if not isinstance(artifact, dict) or "model" not in artifact:
        raise ValueError("AI model artifact has an invalid structure")
    if artifact.get("feature_columns") != FEATURE_COLUMNS:
        raise ValueError("AI model feature order does not match the backend contract")
    return artifact


def model_status() -> dict[str, object]:
    try:
        artifact = load_model_artifact()
        return {
            "available": True,
            "model_path": str(Path(settings.ai_model_path).resolve()),
            "features": artifact["feature_columns"],
            "classes": artifact.get("classes", []),
        }
    except (FileNotFoundError, ValueError, OSError) as error:
        return {
            "available": False,
            "model_path": str(Path(settings.ai_model_path).resolve()),
            "error": str(error),
        }


def predict_metric(metric: schemas.MetricCreate) -> dict[str, object] | None:
    values = [getattr(metric, feature) for feature in FEATURE_COLUMNS]
    if any(value is None for value in values):
        return None

    global _load_error_logged
    try:
        artifact = load_model_artifact()
    except (FileNotFoundError, ValueError, OSError) as error:
        if not _load_error_logged:
            logger.warning("AI prediction disabled: %s", error)
            _load_error_logged = True
        return None

    model = artifact["model"]
    classes = list(artifact.get("classes") or model.classes_)
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="X does not have valid feature names")
            probabilities = model.predict_proba([[float(value) for value in values]])[0]
    except Exception:
        logger.exception("AI inference failed; metric collection will continue")
        return None

    probability_by_scenario = {
        scenario: float(probability)
        for scenario, probability in zip(classes, probabilities)
    }
    top_scenario = max(probability_by_scenario, key=probability_by_scenario.get)
    baseline_probability = probability_by_scenario.get("baseline", 0.0)

    return {
        "status": "normal" if top_scenario == "baseline" else "abnormal",
        "risk_score": round((1.0 - baseline_probability) * 100, 2),
        "top_scenario": top_scenario,
        "top_scenario_confidence": round(
            probability_by_scenario[top_scenario] * 100, 2
        ),
        "scenario_probabilities": {
            scenario: round(probability_by_scenario.get(scenario, 0.0) * 100, 2)
            for scenario in SCENARIO_ORDER
        },
    }

# scorer.py
import os
import joblib
import numpy as np
import pandas as pd

RESULTS_DIR = "ml_outputs"
BUNDLE_PATH = os.path.join(RESULTS_DIR, "risk_model_bundle.joblib")

def load_bundle(path=BUNDLE_PATH):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model bundle not found at: {os.path.abspath(path)}")
    return joblib.load(path)

def prob_to_risk_level(prob, n_levels=10):
    prob = float(prob)
    return int(np.clip(np.ceil(prob * n_levels), 1, n_levels))

def predict_one(payload: dict, bundle=None):
    if bundle is None:
        bundle = load_bundle()
    pipe = bundle["pipeline_calibrated"]
    feats = bundle["feature_names"]

    row = {k: payload.get(k, np.nan) for k in feats}
    X = pd.DataFrame([row], columns=feats)
    prob = float(pipe.predict_proba(X)[:, 1][0])
    return {
        "probability": prob,
        "risk_level": prob_to_risk_level(prob),
    }

def predict_batch(df: pd.DataFrame, bundle=None):
    if bundle is None:
        bundle = load_bundle()
    pipe = bundle["pipeline_calibrated"]
    feats = bundle["feature_names"]
    X = df[feats]
    probs = pipe.predict_proba(X)[:, 1]
    levels = [prob_to_risk_level(p) for p in probs]
    out = df.copy()
    out["probability"] = probs
    out["risk_level"] = levels
    return out

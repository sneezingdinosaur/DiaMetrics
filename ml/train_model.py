# ================================================================
# Diabetes Risk Prediction Tool (NHANES-based, Risk Level 1–10)
# ================================================================
import os
import warnings
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    roc_auc_score,
    roc_curve
)

# NOTE: use imblearn Pipeline so SMOTE happens only on training during .fit()
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import MinMaxScaler
from sklearn.inspection import permutation_importance
from sklearn.calibration import CalibratedClassifierCV

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.ensemble import VotingClassifier, StackingClassifier
from sklearn.base import clone

RANDOM_STATE = 42
N_JOBS = -1
RESULTS_DIR = "ml_outputs"

# ================================================================
# Load Data
# ================================================================
CSV_PATH = "clean.csv"
df = pd.read_csv(CSV_PATH)

missing_req = [c for c in ["SEQN", "DIQ010"] if c not in df.columns]
if missing_req:
    raise ValueError(f"Missing required columns: {missing_req}")

# Label mapping: keep only {1,2}
label_map = {1: 1, 1.0: 1, "1": 1, 2: 0, 2.0: 0, "2": 0}
y = df["DIQ010"].map(label_map)
mask = y.notna()
df = df.loc[mask].reset_index(drop=True)
y = y.loc[mask].astype(int).reset_index(drop=True)

candidate_features = [
    "RIAGENDR", "RIDAGEYR", "RIDRETH1",
    "BMXWT", "BMXHT", "BMXBMI", "BMXWAIST", "BMXHIP"
]
feature_names = [c for c in candidate_features if c in df.columns]
if not feature_names:
    raise ValueError("No usable feature columns found in the dataset.")

X = df[feature_names].select_dtypes(include=[np.number]).copy()
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
target_names = ["class_0", "class_1"]

# ================================================================
# Preprocessing + Models
# ================================================================
imputer = SimpleImputer(strategy="median")
scaler = MinMaxScaler()
smote = SMOTE(random_state=RANDOM_STATE)

models = {}

models["logreg"] = ImbPipeline([
    ("imputer", imputer),
    ("scaler", scaler),
    ("smote", smote),
    ("clf", LogisticRegression(max_iter=500, random_state=RANDOM_STATE))
])

models["rf"] = ImbPipeline([
    ("imputer", imputer),
    ("scaler", scaler),
    ("smote", smote),
    ("clf", RandomForestClassifier(
        n_estimators=400, n_jobs=N_JOBS, random_state=RANDOM_STATE
    ))
])

models["gboost"] = ImbPipeline([
    ("imputer", imputer),
    ("scaler", scaler),
    ("smote", smote),
    ("clf", GradientBoostingClassifier(random_state=RANDOM_STATE))
])

models["extratrees"] = ImbPipeline([
    ("imputer", imputer),
    ("scaler", scaler),
    ("smote", smote),
    ("clf", ExtraTreesClassifier(
        n_estimators=600, n_jobs=N_JOBS, random_state=RANDOM_STATE
    ))
])

try:
    from xgboost import XGBClassifier
    models["xgb"] = ImbPipeline([
        ("imputer", imputer),
        ("scaler", scaler),
        ("smote", smote),
        ("clf", XGBClassifier(
            n_estimators=600, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
            objective="binary:logistic", eval_metric="auc",
            tree_method="hist", random_state=RANDOM_STATE,
            n_jobs=N_JOBS, scale_pos_weight=1.0
        ))
    ])
except Exception as e:
    print(f"[xgboost] skipped: {e}")

try:
    from lightgbm import LGBMClassifier
    models["lgbm"] = ImbPipeline([
        ("imputer", imputer),
        ("scaler", scaler),
        ("smote", smote),
        ("clf", LGBMClassifier(
            n_estimators=800, learning_rate=0.03, num_leaves=31,
            subsample=0.8, colsample_bytree=0.8, objective="binary",
            random_state=RANDOM_STATE, n_jobs=N_JOBS,
            is_unbalance=False
        ))
    ])
except Exception as e:
    print(f"[lightgbm] skipped: {e}")

# ================================================================
# Ensembles: Soft Voting + Stacking
# ================================================================
# Build ensembles from available base classifiers by cloning only their "clf"
# and wrapping them in the same ImbPipeline so your loop works unchanged.

def _available_base_names():
    order = ["logreg", "rf", "gboost", "extratrees", "xgb", "lgbm"]
    return [n for n in order if n in models]

def _clone_base_estimators(names):
    ests = []
    for n in names:
        try:
            base = models[n].named_steps["clf"]
            ests.append((n, clone(base)))
        except Exception:
            pass
    return ests

base_names = _available_base_names()
base_ests = _clone_base_estimators(base_names)

if len(base_ests) >= 2:
    # Soft Voting (probability averaging)
    voting_soft = VotingClassifier(
        estimators=base_ests,
        voting="soft"
    )
    models["voting_soft"] = ImbPipeline([
        ("imputer", imputer),
        ("scaler", scaler),
        ("smote", smote),
        ("clf", voting_soft)
    ])

    # Stacking (meta-learner on base probas)
    meta_lr = LogisticRegression(max_iter=500, random_state=RANDOM_STATE)
    stacking = StackingClassifier(
        estimators=base_ests,
        final_estimator=meta_lr,
        stack_method="predict_proba",
        passthrough=False
    )
    models["stacking"] = ImbPipeline([
        ("imputer", imputer),
        ("scaler", scaler),
        ("smote", smote),
        ("clf", stacking)
    ])
else:
    print("[ensembles] Skipped: need at least 2 base models to build voting/stacking.")

# ================================================================
# Feature Importance Helpers
# ================================================================
def _coef_importance(clf):
    coef = getattr(clf, "coef_", None)
    if coef is None: return None
    coef = np.asarray(coef)
    return np.mean(np.abs(coef), axis=0) if coef.ndim == 2 else np.abs(coef).ravel()

def _native_importance(clf):
    imp = getattr(clf, "feature_importances_", None)
    if imp is not None: return np.asarray(imp)
    return _coef_importance(clf)

def _permutation_importance(pipe, X_val, y_val):
    try:
        r = permutation_importance(
            pipe, X_val, y_val, scoring="roc_auc",
            n_repeats=5, random_state=RANDOM_STATE, n_jobs=N_JOBS
        )
        return r.importances_mean
    except Exception as e:
        print(f"[perm-importance] fallback failed: {e}")
        return None

def compute_feature_importance(pipe, X_val, y_val, feat_names, top_k=10):
    clf = pipe.named_steps.get("clf", pipe)
    imp = _native_importance(clf)
    if imp is None: imp = _permutation_importance(pipe, X_val, y_val)
    if imp is None: imp = np.zeros(len(feat_names), dtype=float)
    fi_df = pd.DataFrame({"feature": feat_names, "importance": imp})
    fi_df = fi_df.sort_values("importance", ascending=False).reset_index(drop=True)
    return fi_df.head(top_k), fi_df

def print_topk_importances(model_name, topk_df):
    print(f"\nTop 10 Feature Importances — {model_name}")
    for i, row in topk_df.iterrows():
        print(f"  {i+1:>2}. {row['feature']}: {row['importance']:.6f}")

# ================================================================
# Train + Evaluate
# ================================================================
os.makedirs(RESULTS_DIR, exist_ok=True)
all_rows = []
auroc_scores = {}

def get_scores_for_auroc(pipeline, X):
    if hasattr(pipeline, "predict_proba"):
        return pipeline.predict_proba(X)[:, 1]
    if hasattr(pipeline, "decision_function"):
        s = pipeline.decision_function(X)
        s = (s - s.min()) / (s.max() - s.min() + 1e-12)
        return s
    return pipeline.predict(X).astype(float)

print("Using features:", feature_names)
for name, pipe in models.items():
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    y_score = get_scores_for_auroc(pipe, X_test)
    acc = accuracy_score(y_test, y_pred)
    prec, rec, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=[0, 1], average=None, zero_division=0
    )
    try:
        auroc = roc_auc_score(y_test, y_score)
    except Exception:
        auroc = np.nan
    print(f"\n=== {name} ===")
    print(f"Accuracy: {acc:.4f} | AUROC: {auroc:.4f}")
    print(classification_report(y_test, y_pred, target_names=target_names, digits=4, zero_division=0))

    topk_df, full_df = compute_feature_importance(pipe, X_test, y_test, feature_names, top_k=10)
    print_topk_importances(name, topk_df)
    full_df.to_csv(os.path.join(RESULTS_DIR, f"feature_importance_{name}.csv"), index=False)

    for lbl, tn in zip([0, 1], target_names):
        idx = [0, 1].index(lbl)
        all_rows.append({
            "model": name, "label": lbl, "class_name": tn,
            "precision": float(prec[idx]) if len(prec) > idx else 0.0,
            "recall": float(rec[idx]) if len(rec) > idx else 0.0,
            "f1": float(f1[idx]) if len(f1) > idx else 0.0,
            "support": int(support[idx]) if len(support) > idx else 0,
            "accuracy": float(acc), "auroc": float(auroc) if not np.isnan(auroc) else np.nan
        })

    joblib.dump(pipe, os.path.join(RESULTS_DIR, f"{name}.joblib"))
    auroc_scores[name] = auroc

metrics_df = pd.DataFrame(all_rows)
metrics_df.to_csv(os.path.join(RESULTS_DIR, "per_class_metrics.csv"), index=False)
print(f"\nSaved per-class metrics to: {os.path.abspath(os.path.join(RESULTS_DIR, 'per_class_metrics.csv'))}")

# ================================================================
# Pick best model and calibrate
# ================================================================
best_name = max((k for k in auroc_scores if auroc_scores[k] == auroc_scores[k]),
                key=lambda k: auroc_scores[k], default=None)
if best_name is None:
    raise RuntimeError("No valid model trained (AUROC all NaN).")

best_pipe = models[best_name]
print(f"\nBest model by AUROC: {best_name} ({auroc_scores[best_name]:.4f})")

X_tr, X_val, y_tr, y_val = train_test_split(
    X_train, y_train, test_size=0.2, stratify=y_train, random_state=RANDOM_STATE
)
best_pipe.fit(X_tr, y_tr)

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    calib = CalibratedClassifierCV(best_pipe, method="isotonic", cv="prefit")
    calib.fit(X_val, y_val)

test_probs = calib.predict_proba(X_test)[:, 1]
test_auroc_cal = roc_auc_score(y_test, test_probs)
print(f"Calibrated {best_name} AUROC on test: {test_auroc_cal:.4f}")

bundle = {
    "model_name": best_name,
    "pipeline_calibrated": calib,
    "feature_names": feature_names,
    "label_meaning": {0: "No diabetes (DIQ010=2)", 1: "Diabetes (DIQ010=1)"}
}
joblib.dump(bundle, os.path.join(RESULTS_DIR, "risk_model_bundle.joblib"))
print("Saved calibrated model bundle to ml_outputs/risk_model_bundle.joblib")

# ================================================================
# Risk Scoring Functions — Numeric Levels (1–10)
# ================================================================
def prob_to_risk_level(prob, n_levels=10):
    """Map probability (0–1) to integer risk level 1–10."""
    prob = float(prob)
    level = int(np.clip(np.ceil(prob * n_levels), 1, n_levels))
    return level

def top_feature_contributions(pipe, X_row, feature_names, top_k=3):
    try:
        import shap
        clf = pipe.named_steps.get("clf", pipe)
        pre_steps = [s for s in pipe.steps if s[0] != "clf"]
        from sklearn.pipeline import Pipeline
        pre = Pipeline(pre_steps)
        X_t = pre.transform(pd.DataFrame([X_row], columns=feature_names))
        if any(k in clf.__class__.__name__.lower() for k in ["forest","tree","boost","xgb","lgbm","extra"]):
            explainer = shap.TreeExplainer(clf)
            shap_vals = explainer.shap_values(X_t)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[1]
            vals = shap_vals[0]
        else:
            raise ImportError("Fallback to linear")
        pairs = list(zip(feature_names, vals))
        pairs.sort(key=lambda x: abs(x[1]), reverse=True)
        out = []
        for feat, v in pairs[:top_k]:
            direction = "↑" if v > 0 else "↓"
            out.append(f"{feat} {direction}")
        return out
    except Exception:
        try:
            clf = pipe.named_steps.get("clf", pipe)
            coef = getattr(clf, "coef_", None)
            if coef is None: return []
            coef = np.asarray(coef).ravel()
            pre_steps = [s for s in pipe.steps if s[0] != "clf"]
            from sklearn.pipeline import Pipeline
            pre = Pipeline(pre_steps)
            X_t = pre.transform(pd.DataFrame([X_row], columns=feature_names))
            contrib = coef * X_t.ravel()
            pairs = list(zip(feature_names, contrib))
            pairs.sort(key=lambda x: abs(x[1]), reverse=True)
            out = []
            for feat, v in pairs[:top_k]:
                direction = "↑" if v > 0 else "↓"
                out.append(f"{feat} {direction}")
            return out
        except Exception:
            return []

def score_dataframe(df_new, id_col="SEQN", top_k=3):
    """Produces numeric risk levels (1–10) per participant."""
    bundle = joblib.load(os.path.join(RESULTS_DIR, "risk_model_bundle.joblib"))
    calib = bundle["pipeline_calibrated"]
    feats = bundle["feature_names"]

    missing = [c for c in feats if c not in df_new.columns]
    if missing:
        raise ValueError(f"Missing required features for scoring: {missing}")

    X_new = df_new[feats].select_dtypes(include=[np.number]).copy()
    probs = calib.predict_proba(X_new)[:, 1]

    rows = []
    for i, prob in enumerate(probs):
        seqn = df_new.iloc[i][id_col] if id_col in df_new.columns else i
        risk_level = prob_to_risk_level(prob, n_levels=10)
        contribs = top_feature_contributions(calib, X_new.iloc[i].to_dict(), feats, top_k=top_k)
        rows.append({
            "SEQN": seqn,
            "probability": float(prob),
            "risk_level": int(risk_level),
            "top_features": "; ".join(contribs)
        })
    return pd.DataFrame(rows)

scored = score_dataframe(df)
out_path = os.path.join(RESULTS_DIR, "diabetes_risk_scores.csv")
scored.to_csv(out_path, index=False)
print(f"\nSaved numeric risk levels (1–10) to: {os.path.abspath(out_path)}")

# ================================================================
# Model Ranking Summary
# ================================================================
def _score_key(item):
    name, score = item
    return (-score) if (score == score) else float("inf")

print("\n=== Model Ranking by AUROC (high → low) ===")
for name, score in sorted(auroc_scores.items(), key=_score_key):
    print(f"{name:12s}  AUROC = {score:.4f}" if score == score else f"{name:12s}  AUROC = NaN")

print("\nDone. Open ml_outputs/diabetes_risk_scores.csv to view numeric risk levels (1–10).")

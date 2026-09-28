"""Shared train/test splitting and evaluation code.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Sequence

import matplotlib

matplotlib.use("Agg")  # no display needed
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split  # noqa: E402

from common import config  # noqa: E402


def safe_stratified_split(
    X: pd.DataFrame, y: pd.Series,
    test_size: float = config.TEST_SIZE, random_state: int = config.RANDOM_STATE,
):
    """Stratified split when possible, otherwise a random split with a loud warning.

    The split happens BEFORE any preprocessing is fitted.
    Returns X_train, X_test, y_train, y_test, stratified(bool).
    """
    counts = y.value_counts()
    n_classes = int(counts.size)
    n_test = math.ceil(test_size * len(y))
    can_stratify = (
        n_classes > 1 and int(counts.min()) >= 2
        and n_test >= n_classes and (len(y) - n_test) >= n_classes
    )
    if can_stratify:
        parts = train_test_split(X, y, test_size=test_size,
                                 random_state=random_state, stratify=y)
        return (*parts, True)
    print("WARNING: stratified split not possible (a class is too small); "
          "using a non-stratified random split.")
    parts = train_test_split(X, y, test_size=test_size, random_state=random_state)
    return (*parts, False)


def evaluate_classifier(
    pipeline: Any, X_test: pd.DataFrame, y_test: pd.Series,
    display_order: Sequence[str], model_name: str,
) -> dict[str, Any]:
    """Evaluate on the untouched test set, print and return all metrics."""
    y_pred = pipeline.predict(X_test)
    present = set(pipeline.classes_)
    labels = [l for l in display_order if l in present] + sorted(present - set(display_order))

    def _avg(fn, average):
        return float(fn(y_test, y_pred, labels=labels, average=average, zero_division=0))

    matrix = confusion_matrix(y_test, y_pred, labels=labels)
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, y_pred)),
        "precision_macro": _avg(precision_score, "macro"),
        "recall_macro": _avg(recall_score, "macro"),
        "f1_macro": _avg(f1_score, "macro"),
        "precision_weighted": _avg(precision_score, "weighted"),
        "recall_weighted": _avg(recall_score, "weighted"),
        "f1_weighted": _avg(f1_score, "weighted"),
        "classification_report": classification_report(
            y_test, y_pred, labels=labels, output_dict=True, zero_division=0),
        "confusion_matrix": {"labels": labels, "matrix": matrix.tolist()},
    }

    print("-" * 78)
    print(f"TEST-SET EVALUATION: {model_name}  (untouched test set, n={len(y_test)})")
    print(f"  accuracy           : {metrics['accuracy']:.4f}")
    print(f"  balanced accuracy  : {metrics['balanced_accuracy']:.4f}")
    print(f"  precision (macro / weighted): {metrics['precision_macro']:.4f} / {metrics['precision_weighted']:.4f}")
    print(f"  recall    (macro / weighted): {metrics['recall_macro']:.4f} / {metrics['recall_weighted']:.4f}")
    print(f"  F1        (macro / weighted): {metrics['f1_macro']:.4f} / {metrics['f1_weighted']:.4f}")
    print("\nClassification report:")
    print(classification_report(y_test, y_pred, labels=labels, zero_division=0))
    print(f"Confusion matrix (rows = true, columns = predicted; order = {labels}):")
    print(pd.DataFrame(matrix, index=[f"true_{l}" for l in labels],
                       columns=[f"pred_{l}" for l in labels]))
    print(f"\n{config.WARNING_TEXT}")
    return metrics


def save_confusion_matrix_plot(metrics: dict[str, Any], path: Path, title: str) -> None:
    labels = metrics["confusion_matrix"]["labels"]
    matrix = metrics["confusion_matrix"]["matrix"]
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", cbar=False,
                xticklabels=labels, yticklabels=labels, ax=ax)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title + "\n(test set; prototype only)")
    fig.tight_layout()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=150)
    plt.close(fig)
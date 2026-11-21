"""Train Seishin Lite and write src/services/lite/model.json.

    python3 ml/seishin-lite/train.py            # train, evaluate, export
    python3 ml/seishin-lite/train.py --hidden 48

A one-hidden-layer network over hashed text features, trained with Adam in
NumPy, then quantised to int8. Prints held-out accuracy (unseen phrasings).
"""
import argparse
import base64
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from dataset import build  # noqa: E402
from features import DIM, featurize, is_command  # noqa: E402
from probe import PROBE  # noqa: E402

# Intents whose answers overlap (each shows the day's events), so mixing them up is harmless.
FAMILY = {"agenda": "sched", "next_event": "sched", "free_time": "sched", "find_event": "sched",
          "tasks_due": "tasks", "overdue": "tasks", "greeting": "chat", "thanks": "chat", "help": "chat", "other": "other"}


def route(labels, P, texts, threshold):
    """What the app does: rules first, then the model; None = hand to the LLM."""
    out = []
    for p, t in zip(P, texts):
        k = int(p.argmax())
        if is_command(t) or labels[k] == "other" or p[k] < threshold:
            out.append(None)
        else:
            out.append(labels[k])
    return out


def score(name, labels, P, rows, threshold):
    got = route(labels, P, [t for t, _ in rows], threshold)
    truth = [labels[y] for _, y in rows]
    answered = [g is not None for g in got]
    harmful = [g is not None and FAMILY[g] != FAMILY[t] for g, t in zip(got, truth)]
    exact = [g == t for g, t in zip(got, truth) if g is not None]
    acts = sum(1 for g, t in zip(got, truth) if t == "other" and g is not None)
    print(f"{name}: answers {np.mean(answered):.2f} itself, exact {np.mean(exact) if exact else 0:.2f} of those, "
          f"wrong-family {np.mean(harmful):.3f}, actions/general answered by mistake {acts}/{truth.count('other')}")
    return got

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "services", "lite", "model.json")


def matrix(rows):
    X = np.zeros((len(rows), DIM), dtype=np.float32)
    y = np.zeros(len(rows), dtype=np.int64)
    for r, (text, label) in enumerate(rows):
        for i, v in featurize(text).items():
            X[r, i] = v
        y[r] = label
    return X, y


def forward(params, X):
    W1, b1, W2, b2 = params
    H = np.maximum(0, X @ W1.T + b1)
    Z = H @ W2.T + b2
    Z -= Z.max(1, keepdims=True)
    P = np.exp(Z)
    return H, P / P.sum(1, keepdims=True)


def train(X, y, k, hidden, epochs, lr, wd, seed):
    rng = np.random.default_rng(seed)
    params = [rng.normal(0, np.sqrt(2 / DIM), (hidden, DIM)).astype(np.float32), np.zeros(hidden, np.float32),
              rng.normal(0, np.sqrt(2 / hidden), (k, hidden)).astype(np.float32), np.zeros(k, np.float32)]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    step, batch = 0, 64
    Y = np.eye(k, dtype=np.float32)[y]
    for ep in range(epochs):
        order = rng.permutation(len(X))
        for s in range(0, len(X), batch):
            idx = order[s:s + batch]
            xb, yb = X[idx], Y[idx]
            # dropout on the hidden layer keeps it from leaning on single hashed features
            W1, b1, W2, b2 = params
            H = np.maximum(0, xb @ W1.T + b1)
            mask = (rng.random(H.shape) > 0.2).astype(np.float32) / 0.8
            Hd = H * mask
            Z = Hd @ W2.T + b2
            Z -= Z.max(1, keepdims=True)
            P = np.exp(Z); P /= P.sum(1, keepdims=True)
            dZ = (P - yb) / len(idx)
            gW2 = dZ.T @ Hd + wd * W2
            gb2 = dZ.sum(0)
            dH = (dZ @ W2) * mask * (H > 0)
            gW1 = dH.T @ xb + wd * W1
            gb1 = dH.sum(0)
            step += 1
            for i, g in enumerate((gW1, gb1, gW2, gb2)):
                m[i] = 0.9 * m[i] + 0.1 * g
                v[i] = 0.999 * v[i] + 0.001 * g * g
                mh = m[i] / (1 - 0.9 ** step)
                vh = v[i] / (1 - 0.999 ** step)
                params[i] -= lr * mh / (np.sqrt(vh) + 1e-8)
    return params


def quantize(W):
    scale = float(np.abs(W).max() / 127) or 1.0
    q = np.clip(np.round(W / scale), -127, 127).astype(np.int8)
    return q, scale


def report(name, params, X, y, labels):
    _, P = forward(params, X)
    pred = P.argmax(1)
    acc = (pred == y).mean()
    print(f"{name}: accuracy {acc:.3f} on {len(y)} examples")
    for li, lab in enumerate(labels):
        sel = y == li
        if sel.any():
            print(f"  {lab:11s} {(pred[sel] == li).mean():.2f}  (n={sel.sum()})")
    return P


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hidden", type=int, default=32)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--lr", type=float, default=0.01)
    ap.add_argument("--wd", type=float, default=3e-3)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--threshold", type=float, default=0.45)
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()

    labels, train_rows, test_rows = build()
    Xtr, ytr = matrix(train_rows)
    Xte, yte = matrix(test_rows)
    print(f"train {len(ytr)}  test {len(yte)}  features {DIM}  hidden {a.hidden}  classes {len(labels)}")
    params = train(Xtr, ytr, len(labels), a.hidden, a.epochs, a.lr, a.wd, a.seed)
    report("train", params, Xtr, ytr, labels)
    P = report("held-out phrasings", params, Xte, yte, labels)

    score("held-out routing", labels, P, test_rows, a.threshold)
    probe_rows = [(t, labels.index(l)) for t, l in PROBE]
    Xp0, _ = matrix(probe_rows)
    _, Pp0 = forward(params, Xp0)
    got = score("hand-written probe", labels, Pp0, probe_rows, a.threshold)
    if a.verbose:
        for (t, l), g, p in zip(PROBE, got, Pp0):
            if g != (None if l == "other" else l):
                print(f"    {t!r:45s} want {l:10s} got {g} ({labels[int(p.argmax())]} {p.max():.2f})")

    q1, s1 = quantize(params[0])
    q2, s2 = quantize(params[2])
    # Parity vectors: the TS port must reproduce these probabilities from the int8 weights.
    deq = [q1.astype(np.float32) * s1, params[1], q2.astype(np.float32) * s2, params[3]]
    probe = [t for t, _ in PROBE[::7]] + ["what's lined up today", "may meeting ba ako bukas?", "am i free at 3pm", "remind me to call mom tomorrow",
             "whats due this week", "kailan ang thesis defense", "Thanks!", "explain recursion"]
    Xp = np.zeros((len(probe), DIM), np.float32)
    for r, t in enumerate(probe):
        for i, v in featurize(t).items():
            Xp[r, i] = v
    _, Pp = forward(deq, Xp)
    model = {
        "version": 1,
        "dim": DIM,
        "hidden": a.hidden,
        "labels": labels,
        "threshold": a.threshold,
        "w1": base64.b64encode(q1.tobytes()).decode(),
        "s1": s1,
        "b1": [round(float(x), 6) for x in params[1]],
        "w2": base64.b64encode(q2.tobytes()).decode(),
        "s2": s2,
        "b2": [round(float(x), 6) for x in params[3]],
        "probe": [[t, l] for t, l in PROBE],
        "parity": [{"text": t, "probs": [round(float(x), 5) for x in Pp[r]]} for r, t in enumerate(probe)],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(model, f, separators=(",", ":"))
    print(f"wrote {os.path.relpath(OUT)} ({os.path.getsize(OUT) / 1024:.1f} KB)")
    for r, t in enumerate(probe):
        print(f"  {t!r:40s} -> {labels[int(Pp[r].argmax())]} {Pp[r].max():.2f}")


if __name__ == "__main__":
    main()

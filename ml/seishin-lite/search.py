"""Round-2 hyperparameter search on validation only (held-out templates + probe.py).
The final exam (final_exam.py) is not touched here."""
import itertools
import sys

import os

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import train as T
from dataset import build
from probe import PROBE


def routed(labels, P, rows, th):
    got = T.route(labels, P, [t for t, _ in rows], th)
    truth = [labels[y] for _, y in rows]
    ans = np.mean([g is not None for g in got])
    wf = np.mean([g is not None and T.FAMILY[g] != T.FAMILY[t] for g, t in zip(got, truth)])
    acts = sum(1 for g, t in zip(got, truth) if t == "other" and g is not None) / max(1, truth.count("other"))
    return ans, wf, acts


def main():
    composed = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    labels, tr, te = build(composed=composed)
    Xtr, ytr = T.matrix(tr)
    Xte, yte = T.matrix(te)
    pr = [(t, labels.index(l)) for t, l in PROBE]
    Xp, _ = T.matrix(pr)
    results = []
    for hidden, epochs, wd in itertools.product([32, 48], [6, 10, 14], [1e-3, 3e-3, 6e-3]):
        scores = []
        for seed in (1, 2, 3):
            p = T.train(Xtr, ytr, len(labels), hidden, epochs, 0.01, wd, seed)
            _, Pte = T.forward(p, Xte)
            _, Pp = T.forward(p, Xp)
            best = None
            for th in (0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75):
                a1, w1, c1 = routed(labels, Pte, te, th)
                a2, w2, c2 = routed(labels, Pp, pr, th)
                # answer as much as possible; wrong families and answered actions cost a lot
                obj = (a1 + a2) / 2 - 6 * (w1 + w2) / 2 - 4 * (c1 + c2) / 2
                if best is None or obj > best[0]:
                    best = (obj, th, a1, w1, a2, w2, c1 + c2)
            scores.append(best)
        objs = [s[0] for s in scores]
        mean = np.mean(objs)
        results.append((mean, np.std(objs), hidden, epochs, wd, scores))
        b = scores[int(np.argmax(objs))]
        print(f"h{hidden} e{epochs:2d} wd{wd:.0e}: obj {mean:.3f}±{np.std(objs):.3f}  best seed th{b[1]} heldout ans {b[2]:.2f} wf {b[3]:.3f} | probe ans {b[4]:.2f} wf {b[5]:.3f}", flush=True)
    results.sort(key=lambda r: -r[0])
    print("TOP:", [(r[2], r[3], r[4], round(r[0], 3)) for r in results[:3]])


if __name__ == "__main__":
    main()

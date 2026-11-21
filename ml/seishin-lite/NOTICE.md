# Data attribution

Seishin Lite's model (`src/services/lite/model.json`) was trained partly on these datasets. The model is adapted material under their licences. The datasets themselves are not redistributed here; `public_data.py --fetch` downloads them.

- **SLURP: A Spoken Language Understanding Resource Package.** Bastianelli, Vanzo, Swietojanski, Rieser, 2020. Text released under CC BY 4.0. https://github.com/pswietojanski/slurp
- **CLINC150: An Evaluation Dataset for Intent Classification and Out-of-Scope Prediction.** Larson et al., 2019. CC BY 3.0. https://github.com/clinc/oos-eval

Changes made: the intents were mapped onto Seishin Lite's 10 intents (rules in `public_data.py`), the data was de-duplicated, and "other" examples were subsampled.

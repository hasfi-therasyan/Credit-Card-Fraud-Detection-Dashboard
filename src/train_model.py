import pandas as pd
import pickle
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, RocCurveDisplay, ConfusionMatrixDisplay
)
from imblearn.over_sampling import SMOTE
from preprocessing import load_and_preprocess

print('[1/5] Loading & preprocessing data...')
X_train, X_test, y_train, y_test = load_and_preprocess('../data/creditcard.csv')

print('[2/5] Applying SMOTE untuk handle class imbalance...')
smote = SMOTE(random_state=42)
X_res, y_res = smote.fit_resample(X_train, y_train)
print(f'      Sebelum: {dict(pd.Series(y_train).value_counts())}')
print(f'      Setelah: {dict(pd.Series(y_res).value_counts())}')

print('[3/5] Training Random Forest...')
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    n_jobs=-1
)
model.fit(X_res, y_res)

print('[4/5] Evaluating model...')
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

print('\n=== Classification Report ===')
print(classification_report(y_test, y_pred, target_names=['Normal', 'Fraud']))
print(f'ROC-AUC Score: {roc_auc_score(y_test, y_prob):.4f}')

print('[5/5] Saving model & plots...')
with open('../src/fraud_model.pkl', 'wb') as f:
    pickle.dump(model, f)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
ConfusionMatrixDisplay.from_estimator(
    model, X_test, y_test,
    display_labels=['Normal', 'Fraud'],
    cmap='Blues', ax=axes[0]
)
axes[0].set_title('Confusion Matrix')
RocCurveDisplay.from_estimator(model, X_test, y_test, ax=axes[1])
axes[1].set_title('ROC Curve')
plt.tight_layout()
plt.savefig('../reports/model_evaluation.png', dpi=150, bbox_inches='tight')
plt.close()
print('Done! Model saved ke src/fraud_model.pkl')
print('Plot saved ke reports/model_evaluation.png')
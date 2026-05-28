import pandas as pd
import pickle
from preprocessing import load_and_preprocess

# Load model
with open('../src/fraud_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Load data asli untuk ambil kolom Amount & Time asli
df_raw = pd.read_csv('../data/creditcard.csv')
_, X_test, _, y_test = load_and_preprocess('../data/creditcard.csv')

# Prediksi
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

# Buat dataframe hasil
results = pd.DataFrame({
    'transaction_index': X_test.index,
    'actual_label':      y_test.values,
    'predicted_label':   y_pred,
    'fraud_probability': y_prob.round(4),
    'amount':            df_raw.loc[X_test.index, 'Amount'].values,
    'time_seconds':      df_raw.loc[X_test.index, 'Time'].values,
})

# Tambah kolom jam transaksi (Time dalam detik sejak transaksi pertama)
results['hour_of_day'] = ((results['time_seconds'] / 3600) % 24).astype(int)
results['is_off_hours'] = results['hour_of_day'].apply(
    lambda h: 'Ya' if (h < 8 or h >= 17) else 'Tidak'
)
results['status'] = results.apply(
    lambda r: 'True Positive'  if r['actual_label']==1 and r['predicted_label']==1
         else 'False Positive' if r['actual_label']==0 and r['predicted_label']==1
         else 'False Negative' if r['actual_label']==1 and r['predicted_label']==0
         else 'True Negative', axis=1
)

results.to_csv('../data/predictions.csv', index=False)
print(f'Exported {len(results)} rows ke data/predictions.csv')
print(results['status'].value_counts())
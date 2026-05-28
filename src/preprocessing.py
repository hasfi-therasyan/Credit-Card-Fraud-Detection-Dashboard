import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

def load_and_preprocess(filepath):
    df = pd.read_csv(filepath)
    
    # Scale kolom Amount dan Time
    # (V1-V28 sudah di-scale via PCA oleh pembuat dataset)
    scaler = StandardScaler()
    df['Amount_Scaled'] = scaler.fit_transform(df[['Amount']])
    df['Time_Scaled']   = scaler.fit_transform(df[['Time']])
    df = df.drop(['Amount', 'Time'], axis=1)
    
    X = df.drop('Class', axis=1)
    y = df['Class']
    
    # stratify=y supaya proporsi fraud tetap sama di train & test
    return train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

if __name__ == '__main__':
    X_train, X_test, y_train, y_test = load_and_preprocess('../data/creditcard.csv')
    print(f'Train: {X_train.shape} | Test: {X_test.shape}')
    print(f'Fraud di test set: {y_test.sum()} dari {len(y_test)} transaksi')
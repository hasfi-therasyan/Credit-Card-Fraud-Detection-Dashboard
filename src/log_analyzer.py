import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
from audit_logger import DB_PATH

def analyze():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query('SELECT * FROM access_log', conn)
    conn.close()
    
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour
    df['is_off_hours'] = df['hour'].apply(lambda h: h < 8 or h >= 17)
    
    off  = df[df['is_off_hours']]
    risk = df[df['action'].isin(['DELETE','MODIFY'])]
    fail = df[df['status'] == 'FAILED']
    
    print('='*45)
    print('         RINGKASAN AUDIT LOG')
    print('='*45)
    print(f'Total entri log         : {len(df)}')
    print(f'Akses di luar jam kerja : {len(off)}')
    print(f'Aksi berisiko tinggi    : {len(risk)}')
    print(f'Akses gagal (FAILED)    : {len(fail)}')
    print('='*45)
    
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    
    # Plot 1: Akses per jam
    df.groupby('hour').size().plot(kind='bar', ax=axes[0], color='steelblue', edgecolor='white')
    axes[0].axvspan(-0.5, 7.5,  alpha=0.15, color='red')
    axes[0].axvspan(17.5, 23.5, alpha=0.15, color='red')
    axes[0].set_title('Akses per Jam (merah = off-hours)')
    axes[0].set_xlabel('Jam')
    axes[0].set_ylabel('Jumlah Akses')
    
    # Plot 2: Distribusi aksi
    df['action'].value_counts().plot(
        kind='pie', ax=axes[1], autopct='%1.1f%%', startangle=90
    )
    axes[1].set_title('Distribusi Jenis Aksi')
    axes[1].set_ylabel('')
    
    # Plot 3: Akses per user
    df.groupby('user_id').size().sort_values().plot(
        kind='barh', ax=axes[2], color='coral', edgecolor='white'
    )
    axes[2].set_title('Jumlah Akses per User')
    axes[2].set_xlabel('Jumlah Akses')
    
    plt.tight_layout()
    plt.savefig('../reports/audit_analysis.png', dpi=150, bbox_inches='tight')
    plt.close()
    print('Plot saved ke reports/audit_analysis.png')

if __name__ == '__main__':
    analyze()
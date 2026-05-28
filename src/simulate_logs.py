import random
import datetime
import sqlite3
import pandas as pd
from audit_logger import init_db, log_access, DB_PATH

USERS = [
    ('USR001', 'analyst'),
    ('USR002', 'analyst'),
    ('USR003', 'supervisor'),
    ('USR004', 'admin'),
    ('USR005', 'auditor'),
]
RESOURCES = ['transaction_data', 'customer_data', 'report_module', 'admin_panel']


def rand_ip():
    return f'192.168.{random.randint(1,5)}.{random.randint(2,254)}'


def simulate(n_normal=300, n_anomaly=30):
    print('Memulai simulasi log...')
    init_db()
    base = datetime.datetime(2024, 6, 1, 8, 0, 0)

    for i in range(n_normal):
        uid, role = random.choice(USERS)
        log_access(
            uid, role,
            random.choice(['READ', 'READ', 'READ', 'EXPORT']),
            random.choice(RESOURCES),
            rand_ip(), 'SUCCESS'
        )

    anomalies = [
        (2,  'DELETE', 'transaction_data', 'SUCCESS', 'DELETE di luar jam kerja'),
        (3,  'EXPORT', 'customer_data',    'SUCCESS', 'Mass export jam 03:00'),
        (1,  'MODIFY', 'admin_panel',      'SUCCESS', 'Modifikasi admin tengah malam'),
        (23, 'LOGIN',  'admin_panel',      'FAILED',  'Possible brute force'),
        (0,  'EXPORT', 'transaction_data', 'SUCCESS', 'Export jam 00:00'),
    ]
    for _ in range(n_anomaly):
        uid, role = random.choice(USERS)
        hour, action, resource, status, notes = random.choice(anomalies)
        log_access(uid, role, action, resource, rand_ip(), status, notes)

    print(f'Simulasi selesai: {n_normal} normal + {n_anomaly} anomali')

    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query('SELECT * FROM access_log', conn)
    conn.close()

    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour
    df['is_off_hours'] = df['hour'].apply(
        lambda h: 'Ya' if (h < 8 or h >= 17) else 'Tidak'
    )
    df['is_risky_action'] = df['action'].apply(
        lambda a: 'Ya' if a in ['DELETE', 'MODIFY'] else 'Tidak'
    )
    df.to_csv('../data/access_logs.csv', index=False)
    print('Exported ke data/access_logs.csv')


if __name__ == '__main__':
    simulate()
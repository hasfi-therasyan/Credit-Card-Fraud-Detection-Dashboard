import sqlite3
import datetime
import os

DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'logs', 'audit_trail.db'
)


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS access_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            user_id     TEXT    NOT NULL,
            role        TEXT    NOT NULL,
            action      TEXT    NOT NULL,
            resource    TEXT    NOT NULL,
            ip_address  TEXT,
            status      TEXT    NOT NULL,
            notes       TEXT
        )
    ''')
    conn.commit()
    conn.close()
    print('DB initialized:', DB_PATH)


def log_access(user_id, role, action, resource, ip, status, notes=''):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO access_log
        (timestamp, user_id, role, action, resource, ip_address, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        datetime.datetime.now().isoformat(),
        user_id, role, action, resource, ip, status, notes
    ))
    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
    log_access('USR001', 'analyst', 'READ', 'transaction_data', '192.168.1.10', 'SUCCESS', 'test entry')
    print('Test log entry berhasil ditambahkan.')
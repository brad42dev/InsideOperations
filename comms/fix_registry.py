import sqlite3
con = sqlite3.connect('/home/io/io-dev/io/comms/tasks.db', timeout=10)
con.execute('PRAGMA journal_mode=WAL')
con.execute("UPDATE io_tasks SET status='verified', updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id='DD-26-011'")
con.execute("UPDATE io_queue SET verified_since_last_audit=verified_since_last_audit+1 WHERE unit='DD-26'")
con.commit()
row = con.execute("SELECT id, status FROM io_tasks WHERE id='DD-26-011'").fetchone()
print('Final status:', row)
con.close()

import json
import pymysql

try:
    conn = pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='peoplepay360',
        charset='utf8mb4'
    )
    cur = conn.cursor()
    
    # Show tables
    cur.execute("SHOW TABLES")
    tables = cur.fetchall()
    print("Tables:", tables)
    
    # Check working_schedules
    for table in tables:
        table_name = table[0]
        print(f"\n=== SHOW CREATE TABLE {table_name} ===")
        cur.execute(f"SHOW CREATE TABLE {table_name}")
        schema = cur.fetchone()
        print(schema[2])
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
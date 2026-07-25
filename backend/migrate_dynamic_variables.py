"""
Database Migration Script — call-time dynamic variables.

Adds `dynamic_variables` (JSON, nullable) to `calls`, so a caller can pass arbitrary
{"key": "value"} pairs (most notably a `language` override) when starting a call.
See app/services/dynamic_variables.py.

Run with: python migrate_dynamic_variables.py [path-to-db]
"""

import sqlite3
import sys


def migrate_database(db_path='./app.db'):
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(calls)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'dynamic_variables' not in columns:
            print("Adding 'dynamic_variables' column to calls...")
            cursor.execute("ALTER TABLE calls ADD COLUMN dynamic_variables JSON")
            print("✓ Added 'dynamic_variables' column to calls")
        else:
            print("✓ 'dynamic_variables' column already exists on calls")

        conn.commit()
        print("\n✅ Database migration completed successfully!")

    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else './app.db'
    print(f"Migrating database: {db_path}\n")
    migrate_database(db_path)

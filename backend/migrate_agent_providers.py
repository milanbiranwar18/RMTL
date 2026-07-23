"""
Database Migration Script — multi-provider LLM/STT/TTS/Telephony support on Agent.

Adds (all nullable / with safe defaults, so existing rows keep working unchanged):
- openai_api_key, anthropic_api_key, gemini_api_key       (per-agent LLM keys)
- cartesia_api_key, assemblyai_api_key, deepgram_api_key   (per-agent voice keys)
- stt_provider (default 'whisper')                        (independent Speech-to-Text selection)
- telephony_provider (default 'twilio')                   (which telephony provider this agent calls out through)

Run with: python migrate_agent_providers.py [path-to-db]
"""

import sqlite3
import sys

NEW_COLUMNS = [
    ("openai_api_key", "VARCHAR", None),
    ("anthropic_api_key", "VARCHAR", None),
    ("gemini_api_key", "VARCHAR", None),
    ("cartesia_api_key", "VARCHAR", None),
    ("assemblyai_api_key", "VARCHAR", None),
    ("deepgram_api_key", "VARCHAR", None),
    ("stt_provider", "VARCHAR", "'whisper'"),
    ("telephony_provider", "VARCHAR", "'twilio'"),
]


def migrate_database(db_path='./app.db'):
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(agents)")
        columns = [column[1] for column in cursor.fetchall()]

        for name, sql_type, default in NEW_COLUMNS:
            if name in columns:
                print(f"✓ '{name}' column already exists")
                continue
            default_clause = f" DEFAULT {default}" if default else ""
            print(f"Adding '{name}' column...")
            cursor.execute(f"ALTER TABLE agents ADD COLUMN {name} {sql_type}{default_clause}")
            print(f"✓ Added '{name}' column")

        # Calls now optionally track which user placed them, so outbound calls can be
        # priced/billed against — and can resolve telephony credentials from — the
        # right person's Integrations vault instead of only the global platform keys.
        cursor.execute("PRAGMA table_info(calls)")
        call_columns = [column[1] for column in cursor.fetchall()]
        if 'user_id' not in call_columns:
            print("Adding 'user_id' column to calls...")
            cursor.execute("ALTER TABLE calls ADD COLUMN user_id INTEGER")
            print("✓ Added 'user_id' column to calls")
        else:
            print("✓ 'user_id' column already exists on calls")

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

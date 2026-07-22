"""
Database Migration Script for Agent Settings Panel
This script adds the new columns to the agents table:
- llm_provider (default: 'gpt')
- llm_model (default: 'gpt-4o')
- voice_name (default: 'Rachel')

Run this script to update your database schema.
"""

import sqlite3
import sys

def migrate_database(db_path='./app.db'):
    """Add new columns to the agents table"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(agents)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Add llm_provider column if it doesn't exist
        if 'llm_provider' not in columns:
            print("Adding 'llm_provider' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN llm_provider VARCHAR DEFAULT 'gpt'")
            print("✓ Added 'llm_provider' column")
        else:
            print("✓ 'llm_provider' column already exists")
        
        # Add llm_model column if it doesn't exist
        if 'llm_model' not in columns:
            print("Adding 'llm_model' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN llm_model VARCHAR DEFAULT 'gpt-4o'")
            print("✓ Added 'llm_model' column")
        else:
            print("✓ 'llm_model' column already exists")
        
        # Add voice_name column if it doesn't exist
        if 'voice_name' not in columns:
            print("Adding 'voice_name' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN voice_name VARCHAR DEFAULT 'Rachel'")
            print("✓ Added 'voice_name' column")
        else:
            print("✓ 'voice_name' column already exists")
        
        conn.commit()
        print("\n✅ Database migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # You can pass a custom database path as an argument
    db_path = sys.argv[1] if len(sys.argv) > 1 else './app.db'
    print(f"Migrating database: {db_path}\n")
    migrate_database(db_path)

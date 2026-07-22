"""
Database Migration Script for Agent Model Updates
This script adds the new columns to the agents table:
- language (default: 'en')
- voice_provider (default: 'elevenlabs')
- elevenlabs_api_key (nullable)

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
        
        # Add language column if it doesn't exist
        if 'language' not in columns:
            print("Adding 'language' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN language VARCHAR DEFAULT 'en'")
            print("✓ Added 'language' column")
        else:
            print("✓ 'language' column already exists")
        
        # Add voice_provider column if it doesn't exist
        if 'voice_provider' not in columns:
            print("Adding 'voice_provider' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN voice_provider VARCHAR DEFAULT 'elevenlabs'")
            print("✓ Added 'voice_provider' column")
        else:
            print("✓ 'voice_provider' column already exists")
        
        if 'elevenlabs_api_key' not in columns:
            print("Adding 'elevenlabs_api_key' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN elevenlabs_api_key VARCHAR")
            print("✓ Added 'elevenlabs_api_key' column")
        else:
            print("✓ 'elevenlabs_api_key' column already exists")
            
        # Add webhook_url column if it doesn't exist
        if 'webhook_url' not in columns:
            print("Adding 'webhook_url' column...")
            cursor.execute("ALTER TABLE agents ADD COLUMN webhook_url VARCHAR")
            print("✓ Added 'webhook_url' column")
        else:
            print("✓ 'webhook_url' column already exists")
        
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

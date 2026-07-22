"""
PostgreSQL Migration Script for Agent Model Updates
This script adds all new columns to the agents table for PostgreSQL.

Adds columns from both migrations:
1. language, voice_provider, elevenlabs_api_key
2. llm_provider, llm_model, voice_name

Run this script to update your PostgreSQL database schema.
"""

import psycopg2
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_db_connection():
    """Get PostgreSQL connection from environment variables"""
    database_url = os.getenv('DATABASE_URL')
    
    if database_url:
        return psycopg2.connect(database_url)
    else:
        # Fallback to individual parameters
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )

def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        );
    """, (table_name, column_name))
    return cursor.fetchone()[0]

def migrate_database():
    """Add new columns to the agents table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("Connected to PostgreSQL database\n")
        
        # List of columns to add
        columns_to_add = [
            ('language', "VARCHAR DEFAULT 'en'", "Language code (e.g., 'en', 'es', 'fr', 'hi')"),
            ('voice_provider', "VARCHAR DEFAULT 'elevenlabs'", "'elevenlabs' or 'whisper'"),
            ('elevenlabs_api_key', "VARCHAR", "Optional ElevenLabs API key"),
            ('llm_provider', "VARCHAR DEFAULT 'gpt'", "'gpt', 'claude', 'gemini'"),
            ('llm_model', "VARCHAR DEFAULT 'gpt-4o'", "Model version"),
            ('voice_name', "VARCHAR DEFAULT 'Rachel'", "ElevenLabs voice name"),
            ('webhook_url', "VARCHAR", "Post-call webhook URL"),
        ]
        
        for column_name, column_type, description in columns_to_add:
            if not column_exists(cursor, 'agents', column_name):
                print(f"Adding '{column_name}' column...")
                cursor.execute(f"ALTER TABLE agents ADD COLUMN {column_name} {column_type}")
                print(f"✓ Added '{column_name}' column - {description}")
            else:
                print(f"✓ '{column_name}' column already exists")
        
        conn.commit()
        print("\n✅ Database migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("PostgreSQL Migration Script")
    print("=" * 50)
    migrate_database()

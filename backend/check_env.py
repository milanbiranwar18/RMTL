"""
Diagnostic script to check environment variables and API keys
Run this to verify your .env file is being loaded correctly
"""

import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

print("=" * 60)
print("Environment Variables Diagnostic")
print("=" * 60)

# Check if .env file exists
env_file_path = os.path.join(os.getcwd(), '.env')
if os.path.exists(env_file_path):
    print(f"✓ .env file found at: {env_file_path}")
else:
    print(f"✗ .env file NOT found at: {env_file_path}")

print("\n" + "=" * 60)
print("API Keys Status")
print("=" * 60)

# Check each API key
api_keys = {
    'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
    'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
    'ELEVENLABS_API_KEY': os.getenv('ELEVENLABS_API_KEY'),
    'GOOGLE_API_KEY': os.getenv('GOOGLE_API_KEY'),
}

for key_name, key_value in api_keys.items():
    if key_value:
        # Mask the key for security
        if len(key_value) > 12:
            masked = key_value[:8] + '*' * (len(key_value) - 12) + key_value[-4:]
        else:
            masked = '*' * len(key_value)
        print(f"✓ {key_name}: {masked} (length: {len(key_value)})")
    else:
        print(f"✗ {key_name}: NOT SET or EMPTY")

print("\n" + "=" * 60)
print("Database Configuration")
print("=" * 60)

db_url = os.getenv('DATABASE_URL')
if db_url:
    # Mask password in database URL
    if '@' in db_url:
        parts = db_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split(':')
            masked_db = f"{user_pass[0]}:****@{parts[1]}"
        else:
            masked_db = db_url
    else:
        masked_db = db_url
    print(f"✓ DATABASE_URL: {masked_db}")
else:
    print(f"✗ DATABASE_URL: NOT SET")

print("\n" + "=" * 60)
print("Recommendations")
print("=" * 60)

issues = []
if not api_keys['OPENAI_API_KEY']:
    issues.append("- Set OPENAI_API_KEY in .env file")
if api_keys['OPENAI_API_KEY'] and len(api_keys['OPENAI_API_KEY']) < 20:
    issues.append("- OPENAI_API_KEY looks too short, verify it's correct")
if not db_url:
    issues.append("- Set DATABASE_URL in .env file")

if issues:
    print("Issues found:")
    for issue in issues:
        print(issue)
    print("\nAfter fixing, RESTART your backend server!")
else:
    print("✓ All critical environment variables are set!")
    print("If you still have issues, RESTART your backend server.")

print("=" * 60)

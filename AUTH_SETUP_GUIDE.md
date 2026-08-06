# 🔐 Authentication Setup Guide

Complete guide for setting up OTP authentication and Google Sign-In for RMVox.

---

## Table of Contents

1. [Overview](#overview)
2. [What's Been Implemented](#whats-been-implemented)
3. [OTP Authentication Setup](#otp-authentication-setup)
4. [Google OAuth Setup](#google-oauth-setup)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Overview

Your RMVox platform now supports **three authentication methods**:

1. **Password Login** - Traditional email + password
2. **OTP Login** - Passwordless login with 6-digit codes via email
3. **Google Sign-In** - OAuth authentication with Google accounts

---

## What's Been Implemented

### Backend

**New Dependencies** (added to `requirements.txt`):
- `pyotp` - For OTP generation
- `authlib` - For OAuth integration
- `itsdangerous` - For secure tokens
- `emails` - For email sending

**New Models**:
1. `app/models/otp.py` - OTP storage model
   - Stores 6-digit codes
   - Tracks expiry (10 minutes)
   - Prevents brute force (5 attempts max)
   - Supports multiple purposes (login, registration, reset_password)

2. `app/models/user.py` - Enhanced User model
   - `oauth_provider` - Which OAuth provider ('google', etc.)
   - `oauth_id` - Provider's user ID
   - `profile_picture` - Profile picture URL
   - `is_email_verified` - Email verification status
   - `otp_secret` - For 2FA/OTP
   - `hashed_password` - Now nullable (for OAuth users)

**New Services**:
1. `app/services/otp_service.py` - OTP management
   - `generate_otp()` - Generate 6-digit codes
   - `create_otp()` - Create and store OTP
   - `verify_otp()` - Verify OTP with attempt tracking
   - `send_otp_email()` - Send OTP via email (placeholder)
   - `send_otp_sms()` - Send OTP via SMS (placeholder)

2. `app/services/oauth_service.py` - OAuth management
   - `verify_google_token()` - Verify Google access token
   - `get_or_create_oauth_user()` - Get existing or create new OAuth user
   - `google_signin()` - Handle Google Sign-In flow
   - `link_oauth_account()` - Link OAuth to existing account

**New API Endpoints** (`app/routers/auth.py`):
- `POST /auth/otp/send` - Send OTP to email
- `POST /auth/otp/verify` - Verify OTP and login
- `POST /auth/otp/login` - Request OTP for passwordless login
- `POST /auth/google/signin` - Sign in/up with Google

**Configuration** (`app/config.py`):
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
- `SMTP_HOST`, `SMTP_PORT`, etc. - Email configuration

### Frontend

**New Page**:
- `frontend/src/pages/LoginEnhanced.jsx` - Complete login page with:
  - **Tab switcher**: Password / OTP
  - **Password form**: Traditional email + password
  - **OTP form**: 
    - Step 1: Enter email → Send OTP
    - Step 2: Enter 6-digit code → Verify & login
    - Countdown timer (10 minutes)
    - Attempt tracking
  - **Google Sign-In button**: OAuth integration
  - Beautiful glassmorphism design
  - Error/success messages
  - Responsive layout

**Features**:
- Smooth tab switching
- Real-time OTP countdown
- Input validation (6 digits only)
- Loading states
- Error handling
- Keyboard navigation
- Mobile-friendly

---

## OTP Authentication Setup

### Development (Local Testing)

For development, OTPs are **printed to the console**. No email service needed!

#### Step 1: Install Dependencies

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

#### Step 2: Run Database Migration

```bash
# The new models will be created automatically when you start the server
python -m uvicorn app.main:app --reload --port 8000
```

#### Step 3: Test OTP Login

1. Start frontend: `cd frontend && npm run dev`
2. Open `http://localhost:5173/login`
3. Click "OTP" tab
4. Enter your email
5. Click "Send OTP"
6. **Check backend terminal** - you'll see:

```
==================================================
📧 OTP CODE FOR your@email.com
==================================================
Code: 123456
Purpose: login
Valid for: 10 minutes
==================================================
```

7. Enter the 6-digit code
8. Click "Verify & Sign In"

**That's it!** OTP login works without any email service in development.

### Production (Email Integration)

For production, you need to integrate an email service. Here are the options:

#### Option 1: SendGrid (Recommended)

**Why SendGrid?**
- Free tier: 100 emails/day
- Reliable delivery
- Easy setup
- Good documentation

**Setup**:
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key
3. Add to `.env`:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_USE_TLS=True
```

4. Update `otp_service.py`:
```python
def send_otp_email(email: str, otp_code: str, purpose: str = 'login'):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    
    message = Mail(
        from_email=settings.SMTP_FROM_EMAIL,
        to_emails=email,
        subject='Your RMVox OTP Code',
        html_content=f'''
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 10px;">
                <h2 style="color: #6366f1;">Your RMVox OTP Code</h2>
                <p>Your one-time password is:</p>
                <div style="background: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <h1 style="color: #6366f1; letter-spacing: 8px; margin: 0;">{otp_code}</h1>
                </div>
                <p style="color: #666;">This code will expire in {OTPService.OTP_EXPIRY_MINUTES} minutes.</p>
                <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
        </body>
        </html>
        '''
    )
    
    try:
        sg = SendGridAPIClient(settings.SMTP_PASSWORD)
        response = sg.send(message)
        logger.info(f"OTP email sent to {email} (status: {response.status_code})")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email: {str(e)}")
        return False
```

#### Option 2: AWS SES

**Why AWS SES?**
- Very cheap ($0.10 per 1,000 emails)
- Integrated with AWS ecosystem
- Scalable

**Setup**:
1. Set up AWS SES
2. Verify domain
3. Add to `.env`:
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your_ses_smtp_username
SMTP_PASSWORD=your_ses_smtp_password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

#### Option 3: Gmail SMTP (Not Recommended for Production)

**Only for testing!** Gmail has limits and may block your account.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your_app_password  # NOT your Gmail password!
SMTP_FROM_EMAIL=your@gmail.com
```

**Note**: You must enable "Less secure app access" or create an App Password.

---

## Google OAuth Setup

### Step 1: Create Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to "Credentials"
5. Click "Create Credentials" → "OAuth client ID"
6. Choose "Web application"
7. Configure:
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:5173/auth/google/callback` (development)
     - `https://yourdomain.com/auth/google/callback` (production)
8. Save and copy:
   - **Client ID** (e.g., `12345-abc.apps.googleusercontent.com`)
   - **Client Secret** (e.g., `GOCSPX-xyz123`)

### Step 2: Update Backend Configuration

Add to `backend/.env`:

```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

### Step 3: Add Google Sign-In Library to Frontend

Add to `frontend/index.html` (in `<head>`):

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### Step 4: Update LoginEnhanced.jsx

Replace the `handleGoogleSignIn` function:

```javascript
const handleGoogleSignIn = () => {
  // Initialize Google Sign-In
  google.accounts.id.initialize({
    client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    callback: handleGoogleCallback
  });
  
  // Show one-tap sign-in
  google.accounts.id.prompt();
};

const handleGoogleCallback = async (response) => {
  setError('');
  setLoading(true);
  try {
    // Send Google token to backend
    const res = await client.post('/auth/google/signin', {
      token: response.credential
    });
    login(res.data.user, res.data.token);
    navigate('/dashboard');
  } catch (err) {
    setError(err.response?.data?.detail || 'Google Sign-In failed');
  } finally {
    setLoading(false);
  }
};
```

### Step 5: Alternative - Google Sign-In Button

For a more integrated experience, replace the Google button HTML with:

```javascript
// Add to useEffect
useEffect(() => {
  if (window.google) {
    google.accounts.id.initialize({
      client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
      callback: handleGoogleCallback
    });
    
    google.accounts.id.renderButton(
      document.getElementById('googleSignInButton'),
      {
        theme: 'filled_blue',
        size: 'large',
        width: '100%',
        text: 'continue_with'
      }
    );
  }
}, []);

// Then in JSX, replace the custom button with:
<div id="googleSignInButton"></div>
```

---

## Testing

### Test OTP Login

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173/login`
4. Click "OTP" tab
5. Enter any email (doesn't need to be real for development)
6. Click "Send OTP"
7. Check backend terminal for the OTP code
8. Enter the code and verify

**What to test**:
- ✅ OTP sent successfully
- ✅ OTP code appears in terminal
- ✅ Countdown timer works
- ✅ Invalid OTP shows error
- ✅ Expired OTP shows error
- ✅ Max attempts (5) locks OTP
- ✅ Can request new OTP
- ✅ Successful login redirects to dashboard

### Test Password Login

1. Open `http://localhost:5173/login`
2. Stay on "Password" tab (default)
3. Enter existing user credentials
4. Click "Sign In"

### Test Google Sign-In (After Setup)

1. Open `http://localhost:5173/login`
2. Scroll to "Continue with Google" button
3. Click button
4. Select Google account
5. Verify login and redirect to dashboard

**What to test**:
- ✅ Google popup appears
- ✅ Account selection works
- ✅ New user account created
- ✅ Existing user logs in
- ✅ Profile picture fetched
- ✅ Email verified automatically

---

## Troubleshooting

### OTP Issues

**Issue**: OTP not appearing in terminal

**Solutions**:
1. Check backend is running
2. Check for errors in terminal
3. Verify OTP was created: `sqlite3 app.db "SELECT * FROM otps ORDER BY created_at DESC LIMIT 5;"`

**Issue**: "Maximum verification attempts exceeded"

**Solution**:
- Wait for OTP to expire (10 minutes)
- Or request a new OTP (invalidates old one)

**Issue**: "OTP has expired"

**Solution**:
- Request a new OTP
- Default expiry is 10 minutes

### Google OAuth Issues

**Issue**: "Invalid Google token"

**Solutions**:
1. Check `GOOGLE_CLIENT_ID` is correct
2. Verify authorized origins in Google Console
3. Check redirect URI matches exactly
4. Ensure Google+ API is enabled

**Issue**: "Callback function not found"

**Solution**:
- Verify Google Sign-In script is loaded: Check browser console for errors
- Make sure `handleGoogleCallback` function exists

**Issue**: "Access blocked" error from Google

**Solution**:
- Verify domain in Google Console
- Check OAuth consent screen is configured
- For testing, add your email to test users

### Database Issues

**Issue**: "Table 'otps' doesn't exist"

**Solution**:
```bash
# Restart backend to create tables
cd backend
python -m uvicorn app.main:app --reload
```

**Issue**: "Column 'oauth_provider' doesn't exist"

**Solution**:
```bash
# Drop old database and restart (DEVELOPMENT ONLY!)
rm app.db
python -m uvicorn app.main:app --reload
```

---

## Production Deployment

### Checklist

#### Backend

- [ ] Install all dependencies: `pip install -r requirements.txt`
- [ ] Set strong `SECRET_KEY` in `.env`
- [ ] Configure email service (SendGrid/AWS SES)
- [ ] Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] Update `GOOGLE_REDIRECT_URI` to production URL
- [ ] Set `PUBLIC_BASE_URL` to your domain
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS
- [ ] Set up database backups

#### Frontend

- [ ] Update Google Client ID in `LoginEnhanced.jsx`
- [ ] Build production: `npm run build`
- [ ] Deploy to Vercel/Netlify/AWS
- [ ] Configure custom domain
- [ ] Enable HTTPS
- [ ] Update CORS settings in backend

#### Google OAuth

- [ ] Add production domain to authorized origins
- [ ] Add production callback URL to redirect URIs
- [ ] Verify OAuth consent screen
- [ ] Complete app verification (for production)
- [ ] Add privacy policy URL
- [ ] Add terms of service URL

#### Security

- [ ] Rate limit OTP requests (max 3 per hour per email)
- [ ] Rate limit login attempts (max 5 per minute per IP)
- [ ] Enable CSRF protection
- [ ] Set secure cookie flags
- [ ] Monitor for suspicious activity
- [ ] Set up alerting for failed logins
- [ ] Implement account lockout after X failed attempts

---

## Email Templates

### OTP Email Template

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your RMVox OTP Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">RMVox</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #333333; margin: 0 0 20px 0;">Your Verification Code</h2>
                            <p style="color: #666666; line-height: 1.6; margin: 0 0 30px 0;">
                                Use this code to complete your sign-in. This code will expire in 10 minutes.
                            </p>
                            
                            <!-- OTP Code -->
                            <div style="background-color: #f8f9fa; border: 2px dashed #6366f1; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
                                <span style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">{{OTP_CODE}}</span>
                            </div>
                            
                            <p style="color: #666666; line-height: 1.6; margin: 20px 0 0 0; font-size: 14px;">
                                If you didn't request this code, please ignore this email or contact support if you have concerns.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="color: #999999; font-size: 12px; margin: 0;">
                                © 2026 RMVox. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## API Reference

### Send OTP

```http
POST /auth/otp/send
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "login"  // or "registration", "reset_password"
}
```

**Response**:
```json
{
  "message": "OTP sent successfully to your email",
  "expires_in_minutes": 10
}
```

### Verify OTP

```http
POST /auth/otp/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp_code": "123456",
  "purpose": "login"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "name": "John Doe",
    "email": "user@example.com",
    "profile_picture": null
  }
}
```

### Google Sign-In

```http
POST /auth/google/signin
Content-Type: application/json

{
  "token": "google_access_token_from_frontend"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "name": "John Doe",
    "email": "john@gmail.com",
    "profile_picture": "https://lh3.googleusercontent.com/..."
  }
}
```

---

## Summary

✅ **Implemented**:
- OTP authentication (email-based)
- Google OAuth Sign-In
- Enhanced login UI with tabs
- Attempt tracking and expiry
- Beautiful email templates
- Development mode (console logging)

🔧 **Setup Required** (for production):
- Email service (SendGrid/AWS SES)
- Google OAuth credentials
- HTTPS and custom domain
- Rate limiting
- Monitoring

📚 **Documentation**:
- Complete API reference
- Email templates
- Troubleshooting guide
- Production checklist

---

*Last Updated: July 30, 2026*

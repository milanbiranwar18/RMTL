"""OAuth service for Google Sign-In and other providers."""

import logging
import httpx
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import security_service

logger = logging.getLogger(__name__)


class OAuthService:
    """Service for OAuth authentication with various providers."""
    
    # Google OAuth endpoints
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    @staticmethod
    async def verify_google_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify Google ID token and get user info.
        
        Args:
            token: Google ID token from frontend
            
        Returns:
            User info dict or None if invalid
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    OAuthService.GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    user_info = response.json()
                    logger.info(f"Google token verified for: {user_info.get('email')}")
                    return user_info
                else:
                    logger.error(f"Google token verification failed: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error verifying Google token: {str(e)}")
            return None
    
    @staticmethod
    def get_or_create_oauth_user(
        db: Session,
        email: str,
        name: str,
        oauth_provider: str,
        oauth_id: str,
        profile_picture: Optional[str] = None
    ) -> User:
        """Get existing OAuth user or create new one.
        
        Args:
            db: Database session
            email: User email
            name: User name
            oauth_provider: Provider name ('google', 'github', etc.)
            oauth_id: Provider's user ID
            profile_picture: Profile picture URL (optional)
            
        Returns:
            User object
        """
        # Check if user exists with this email
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            # Update OAuth info if not set
            if not user.oauth_provider:
                user.oauth_provider = oauth_provider
                user.oauth_id = oauth_id
                user.is_email_verified = True  # OAuth emails are pre-verified
                if profile_picture:
                    user.profile_picture = profile_picture
                db.commit()
                db.refresh(user)
                logger.info(f"Updated existing user {email} with OAuth info")
            else:
                logger.info(f"Existing OAuth user logged in: {email}")
            return user
        
        # Create new user
        user = User(
            name=name,
            email=email,
            hashed_password=None,  # OAuth users don't have passwords
            oauth_provider=oauth_provider,
            oauth_id=oauth_id,
            profile_picture=profile_picture,
            is_email_verified=True,  # OAuth emails are pre-verified
            is_active=True
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        logger.info(f"Created new OAuth user: {email} (provider: {oauth_provider})")
        return user
    
    @staticmethod
    async def google_signin(
        db: Session,
        token: str
    ) -> tuple[Optional[User], Optional[str]]:
        """Handle Google Sign-In.
        
        Args:
            db: Database session
            token: Google access token from frontend
            
        Returns:
            Tuple of (User object, JWT token) or (None, error_message)
        """
        # Verify token and get user info
        user_info = await OAuthService.verify_google_token(token)
        
        if not user_info:
            return None, "Invalid Google token"
        
        # Extract user info
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        google_id = user_info.get('id')
        picture = user_info.get('picture')
        
        if not email or not google_id:
            return None, "Incomplete user information from Google"
        
        # Get or create user
        user = OAuthService.get_or_create_oauth_user(
            db=db,
            email=email,
            name=name,
            oauth_provider='google',
            oauth_id=google_id,
            profile_picture=picture
        )
        
        # Generate JWT token
        jwt_token = security_service.create_access_token({"sub": str(user.id)})
        
        return user, jwt_token
    
    @staticmethod
    def link_oauth_account(
        db: Session,
        user: User,
        oauth_provider: str,
        oauth_id: str,
        profile_picture: Optional[str] = None
    ) -> bool:
        """Link OAuth account to existing user.
        
        Args:
            db: Database session
            user: Existing user
            oauth_provider: Provider name
            oauth_id: Provider's user ID
            profile_picture: Profile picture URL (optional)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            user.oauth_provider = oauth_provider
            user.oauth_id = oauth_id
            if profile_picture:
                user.profile_picture = profile_picture
            db.commit()
            logger.info(f"Linked OAuth account ({oauth_provider}) to user {user.email}")
            return True
        except Exception as e:
            logger.error(f"Error linking OAuth account: {str(e)}")
            db.rollback()
            return False

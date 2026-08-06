"""
WhatsApp messaging service with multi-provider support.

Supports:
- Twilio WhatsApp API
- AISENSY (Popular in India)
- Gupshup
- 360Dialog (Official WhatsApp BSP)
- Interakt
"""

import logging
from typing import Optional, Dict, Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Multi-provider WhatsApp messaging service"""
    
    SUPPORTED_PROVIDERS = {
        "twilio": {
            "name": "Twilio WhatsApp",
            "base_url": "https://api.twilio.com/2010-04-01",
            "supports_media": True,
            "supports_templates": True
        },
        "exotel": {
            "name": "Exotel WhatsApp",
            "base_url": "https://api.exotel.com/v1",
            "supports_media": True,
            "supports_templates": True
        },
        "aisensy": {
            "name": "AISENSY",
            "base_url": "https://backend.aisensy.com/campaign/t1/api/v2",
            "supports_media": True,
            "supports_templates": True
        },
        "gupshup": {
            "name": "Gupshup",
            "base_url": "https://api.gupshup.io/wa/api/v1",
            "supports_media": True,
            "supports_templates": True
        },
        "360dialog": {
            "name": "360Dialog",
            "base_url": "https://waba.360dialog.io/v1",
            "supports_media": True,
            "supports_templates": True
        },
        "interakt": {
            "name": "Interakt",
            "base_url": "https://api.interakt.ai/v1",
            "supports_media": True,
            "supports_templates": True
        }
    }
    
    @staticmethod
    def send_message(
        provider: str,
        to_number: str,
        message: str,
        credentials: Dict[str, str],
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message via specified provider.
        
        Args:
            provider: Provider name (twilio, aisensy, gupshup, 360dialog, interakt)
            to_number: Recipient phone number (with country code, e.g., +919876543210)
            message: Message text
            credentials: Provider-specific credentials
            media_url: Optional media URL (image, document, etc.)
            template_name: Optional template name for approved messages
            template_params: Optional template parameters
            
        Returns:
            Dict with success status and message details
        """
        
        if provider not in WhatsAppService.SUPPORTED_PROVIDERS:
            return {
                "success": False,
                "error": f"Unsupported provider: {provider}. Supported: {', '.join(WhatsAppService.SUPPORTED_PROVIDERS.keys())}"
            }
        
        try:
            if provider == "twilio":
                return WhatsAppService._send_twilio(to_number, message, credentials, media_url)
            elif provider == "exotel":
                return WhatsAppService._send_exotel(to_number, message, credentials, media_url, template_name, template_params)
            elif provider == "aisensy":
                return WhatsAppService._send_aisensy(to_number, message, credentials, media_url, template_name, template_params)
            elif provider == "gupshup":
                return WhatsAppService._send_gupshup(to_number, message, credentials, media_url, template_name)
            elif provider == "360dialog":
                return WhatsAppService._send_360dialog(to_number, message, credentials, media_url, template_name, template_params)
            elif provider == "interakt":
                return WhatsAppService._send_interakt(to_number, message, credentials, media_url, template_name, template_params)
            else:
                return {"success": False, "error": f"Provider {provider} not implemented yet"}
                
        except Exception as e:
            logger.error(f"WhatsApp send failed ({provider}): {e}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def _send_twilio(to_number: str, message: str, credentials: Dict[str, str], media_url: Optional[str] = None) -> Dict[str, Any]:
        """Send via Twilio WhatsApp API"""
        account_sid = credentials.get("account_sid") or settings.TWILIO_ACCOUNT_SID
        auth_token = credentials.get("auth_token") or settings.TWILIO_AUTH_TOKEN
        from_number = credentials.get("from_number") or settings.TWILIO_PHONE_NUMBER
        
        if not all([account_sid, auth_token, from_number]):
            return {"success": False, "error": "Missing Twilio credentials"}
        
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        
        # Twilio WhatsApp numbers must be prefixed with 'whatsapp:'
        to_wa = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
        from_wa = f"whatsapp:{from_number}" if not from_number.startswith("whatsapp:") else from_number
        
        payload = {
            "From": from_wa,
            "To": to_wa,
            "Body": message
        }
        
        if media_url:
            payload["MediaUrl"] = media_url
        
        response = httpx.post(url, data=payload, auth=(account_sid, auth_token), timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": True,
            "message_id": result.get("sid"),
            "status": result.get("status"),
            "provider": "twilio"
        }
    
    @staticmethod
    def _send_exotel(
        to_number: str, 
        message: str, 
        credentials: Dict[str, str], 
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send via Exotel WhatsApp (India-focused)"""
        api_key = credentials.get("api_key") or settings.EXOTEL_API_KEY
        api_token = credentials.get("api_token") or settings.EXOTEL_API_TOKEN
        account_sid = credentials.get("account_sid") or settings.EXOTEL_API_SID
        subdomain = credentials.get("subdomain") or settings.EXOTEL_SUBDOMAIN or "api.exotel.com"
        from_number = credentials.get("from_number") or settings.EXOTEL_WHATSAPP_NUMBER
        
        if not all([api_key, api_token, account_sid]):
            return {"success": False, "error": "Missing Exotel credentials (API Key, Token, SID required)"}
        
        # Clean phone number
        clean_number = to_number.replace("+", "").replace("whatsapp:", "")
        
        url = f"https://{subdomain}/v2/accounts/{account_sid}/messages"
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Exotel uses template messages for WhatsApp
        if template_name:
            payload = {
                "From": from_number or "whatsapp",
                "To": clean_number,
                "Channel": "whatsapp",
                "Template": {
                    "Name": template_name,
                    "Parameters": template_params or {}
                }
            }
        else:
            # Session message
            payload = {
                "From": from_number or "whatsapp",
                "To": clean_number,
                "Channel": "whatsapp",
                "Body": message
            }
            if media_url:
                payload["MediaUrl"] = media_url
        
        response = httpx.post(url, json=payload, headers=headers, auth=(api_key, api_token), timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": True,
            "message_id": result.get("Sid") or result.get("MessageSid"),
            "provider": "exotel"
        }
    
    @staticmethod
    def _send_aisensy(
        to_number: str, 
        message: str, 
        credentials: Dict[str, str], 
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send via AISENSY (Popular in India)"""
        api_key = credentials.get("api_key") or settings.AISENSY_API_KEY
        
        if not api_key:
            return {"success": False, "error": "Missing AISENSY API key"}
        
        # Clean phone number (AISENSY expects numbers without + or whatsapp: prefix)
        clean_number = to_number.replace("+", "").replace("whatsapp:", "")
        
        # Use template endpoint if template is provided (for business-initiated)
        if template_name:
            url = "https://backend.aisensy.com/campaign/t1/api/v2/sendTemplateMessage"
            payload = {
                "phoneNumber": clean_number,
                "template_name": template_name,
                "parameters": template_params or {}
            }
        else:
            # Session message (within 24-hour window)
            url = "https://backend.aisensy.com/campaign/t1/api/v2/sendSessionMessage"
            payload = {
                "to": clean_number,
                "message": message
            }
            if media_url:
                payload["media"] = {
                    "url": media_url,
                    "filename": "attachment"
                }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        response = httpx.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": True,
            "message_id": result.get("messageId"),
            "provider": "aisensy"
        }
    
    @staticmethod
    def _send_gupshup(
        to_number: str, 
        message: str, 
        credentials: Dict[str, str], 
        media_url: Optional[str] = None,
        template_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send via Gupshup"""
        api_key = credentials.get("api_key") or settings.GUPSHUP_API_KEY
        app_name = credentials.get("app_name") or settings.GUPSHUP_APP_NAME
        
        if not all([api_key, app_name]):
            return {"success": False, "error": "Missing Gupshup credentials"}
        
        # Clean phone number
        clean_number = to_number.replace("+", "").replace("whatsapp:", "")
        
        url = "https://api.gupshup.io/wa/api/v1/msg"
        
        headers = {
            "apikey": api_key,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {
            "channel": "whatsapp",
            "source": app_name,
            "destination": clean_number,
            "message": message,
            "src.name": app_name
        }
        
        if media_url:
            payload["message"] = json.dumps({
                "type": "image" if media_url.lower().endswith(('.jpg', '.jpeg', '.png')) else "file",
                "url": media_url,
                "caption": message
            })
        
        response = httpx.post(url, headers=headers, data=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": result.get("status") == "submitted",
            "message_id": result.get("messageId"),
            "provider": "gupshup"
        }
    
    @staticmethod
    def _send_360dialog(
        to_number: str, 
        message: str, 
        credentials: Dict[str, str], 
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send via 360Dialog (Official WhatsApp BSP)"""
        api_key = credentials.get("api_key") or settings.DIALOG360_API_KEY
        
        if not api_key:
            return {"success": False, "error": "Missing 360Dialog API key"}
        
        # Clean phone number
        clean_number = to_number.replace("+", "").replace("whatsapp:", "")
        
        url = "https://waba.360dialog.io/v1/messages"
        
        headers = {
            "D360-API-KEY": api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "to": clean_number,
            "type": "text",
            "text": {
                "body": message
            }
        }
        
        if media_url:
            # Determine media type from URL
            if media_url.lower().endswith(('.jpg', '.jpeg', '.png')):
                media_type = "image"
            elif media_url.lower().endswith(('.pdf', '.doc', '.docx')):
                media_type = "document"
            else:
                media_type = "document"
            
            payload["type"] = media_type
            payload[media_type] = {
                "link": media_url
            }
            if message:
                payload[media_type]["caption"] = message
        
        response = httpx.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": True,
            "message_id": result.get("messages", [{}])[0].get("id"),
            "provider": "360dialog"
        }
    
    @staticmethod
    def _send_interakt(
        to_number: str, 
        message: str, 
        credentials: Dict[str, str], 
        media_url: Optional[str] = None,
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send via Interakt"""
        api_key = credentials.get("api_key") or settings.INTERAKT_API_KEY
        
        if not api_key:
            return {"success": False, "error": "Missing Interakt API key"}
        
        # Clean phone number
        clean_number = to_number.replace("+", "").replace("whatsapp:", "")
        
        url = "https://api.interakt.ai/v1/public/message/"
        
        headers = {
            "Authorization": f"Basic {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "countryCode": "+" + clean_number[:2] if len(clean_number) > 10 else "+91",
            "phoneNumber": clean_number[-10:] if len(clean_number) > 10 else clean_number,
            "type": "Text",
            "data": {
                "message": message
            }
        }
        
        if media_url:
            payload["type"] = "Image" if media_url.lower().endswith(('.jpg', '.jpeg', '.png')) else "File"
            payload["data"] = {
                "url": media_url,
                "filename": "attachment"
            }
        
        response = httpx.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {
            "success": result.get("result", False),
            "message_id": result.get("messageId"),
            "provider": "interakt"
        }

# WhatsApp Integration Guide

## ✅ What's Been Added

### **6 WhatsApp Providers Now Supported:**
1. **Twilio WhatsApp** - Free sandbox, easiest to test
2. **Exotel WhatsApp** ⭐ NEW - India-focused, local support
3. **AISENSY** - Popular in India, quick setup
4. **Gupshup** - Global reach, enterprise-grade
5. **360Dialog** - Official Meta BSP
6. **Interakt** - India-focused, SMB-friendly

---

## 📋 WhatsApp Message Types (CRITICAL TO UNDERSTAND)

### **Type 1: Session Messages** ✅ Your Current UI Supports This
**When to use:**
- User messages you first
- You reply within 24 hours
- **No approval needed** - send any message you want

**Example Flow:**
1. Customer: "Hi, what's your order status?"
2. Bot (within 24hrs): "Your order #12345 is out for delivery!" ✅ FREE-FORM MESSAGE

**Limitations:**
- ❌ Cannot initiate conversation
- ❌ Must reply within 24-hour window
- ✅ Can send any message, images, documents

---

### **Type 2: Template Messages** ⭐ NOW SUPPORTED
**When to use:**
- **You** want to message customer first (business-initiated)
- Outside 24-hour window
- Marketing, notifications, updates

**Requirements:**
- ✅ Template must be **pre-approved by Meta/WhatsApp**
- ✅ Template has **fixed structure** with variable placeholders
- ✅ Can be sent anytime

**Example Template (must be approved first):**
```
Template Name: order_confirmation
Template Content: "Hi {{1}}, your order {{2}} has been confirmed! Delivery by {{3}}."
```

**How to Send:**
```json
{
  "messageType": "template",
  "templateName": "order_confirmation",
  "templateParams": {
    "1": "John Doe",
    "2": "#12345",
    "3": "Dec 25"
  }
}
```

**Result:**
"Hi John Doe, your order #12345 has been confirmed! Delivery by Dec 25."

---

## 🎯 How to Use in Your Workflow

### **Option A: Session Messages (No Setup Needed)**

1. **In Workflow Builder**, add "Send WhatsApp" node
2. Set **Message Type**: "Session Message"
3. Select provider (e.g., Twilio WhatsApp)
4. Enter recipient: `{{phone_number}}` (from variable)
5. Type your message: "Your OTP is {{otp_code}}"
6. **Done!** Works immediately (within 24hr window)

**Use Case:**
- Customer support responses
- Order status updates (after customer asks)
- OTP/verification codes (after customer requests)

---

### **Option B: Template Messages (Requires Setup)**

#### **Step 1: Create Template in WhatsApp Business Manager**
1. Go to: https://business.facebook.com/wa/manage/message-templates/
2. Create new template
3. Choose category (Marketing / Utility / Authentication)
4. Write template with {{1}}, {{2}} placeholders
5. Submit for approval (takes 24-48 hours)
6. Get template name (e.g., "order_confirmation")

#### **Step 2: Use in Workflow**
1. Add "Send WhatsApp" node
2. Set **Message Type**: "Template Message"
3. Enter **Template Name**: `order_confirmation`
4. Enter **Template Parameters** (JSON):
   ```json
   {
     "1": "{{user_name}}",
     "2": "{{order_id}}",
     "3": "{{delivery_date}}"
   }
   ```
5. **Done!** Can send anytime, even if user hasn't messaged you

**Use Case:**
- Marketing campaigns
- Appointment reminders
- Order confirmations
- Payment receipts
- Abandoned cart reminders

---

## 🔧 Provider-Specific Setup

### **Twilio WhatsApp**
**For Testing (Free):**
1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Join sandbox: Send "join [code]" to their WhatsApp number
3. Use sandbox number in workflow: `+14155238886`
4. ✅ Test immediately with session messages

**For Production:**
1. Request WhatsApp Business API access from Twilio
2. Verify your business (takes 1-2 weeks)
3. Get your approved WhatsApp number
4. Create & approve templates
5. ✅ Send template messages anytime

---

### **Exotel WhatsApp** ⭐ NEW
**Setup:**
1. Contact Exotel: https://exotel.com/whatsapp-business-api/
2. Get WhatsApp Business API enabled
3. Get credentials:
   - API Key
   - API Token
   - Account SID
   - Subdomain (e.g., api.exotel.com)
   - WhatsApp Number
4. Create templates in Meta Business Manager
5. Configure in your workflow

**Advantages:**
- ✅ Local support in India
- ✅ Competitive pricing
- ✅ Same provider as your voice calls
- ✅ Compliance with Indian regulations

---

### **AISENSY**
**Setup:**
1. Sign up: https://www.aisensy.com/
2. Get API key from dashboard
3. Enable WhatsApp Business API
4. Create & approve templates
5. ✅ Ready to use

**Advantages:**
- ✅ Very popular in India
- ✅ Quick onboarding (1-2 days)
- ✅ Marketing campaign tools built-in
- ✅ Template management UI

---

## 💰 Pricing Comparison (India)

| Provider | Session Message | Template (Marketing) | Template (Utility) | Free Tier |
|----------|----------------|---------------------|-------------------|-----------|
| **Twilio** | Free (24hr) | ₹1.35/msg | ₹0.29/msg | Sandbox unlimited |
| **Exotel** | Free (24hr) | Contact for pricing | Contact for pricing | Contact |
| **AISENSY** | Free (24hr) | ₹0.80-1.00/msg | ₹0.25-0.35/msg | Varies |
| **Gupshup** | Free (24hr) | ₹0.80-1.00/msg | ₹0.25-0.35/msg | Varies |
| **360Dialog** | Free (24hr) | ₹0.60-0.90/msg | ₹0.20-0.30/msg | 1000/month |
| **Interakt** | Free (24hr) | ₹0.80-1.00/msg | ₹0.25-0.35/msg | Varies |

**Note:** Session messages (customer-initiated) are **always free** for all providers!

---

## ✅ Will Your Current Implementation Work?

### **YES** ✅ for Session Messages
- Your workflow can send free-form WhatsApp messages
- Works immediately within 24-hour window
- No template approval needed
- Perfect for customer support, OTP, order updates (after customer asks)

### **YES** ✅ for Template Messages (with setup)
- Your UI now supports template messages
- Backend handles template name + parameters
- **But you need to:**
  1. Create templates in Meta Business Manager
  2. Get them approved (24-48 hrs)
  3. Use approved template names in workflow

---

## 🚀 Quick Start Guide

### **For Testing (Right Now):**
1. Use **Twilio WhatsApp Sandbox**
2. Send "join [code]" to `+14155238886` from your phone
3. In workflow: Set message type = "Session Message"
4. Send test message to your number
5. ✅ Works immediately!

### **For Production:**
1. Choose provider (Twilio, Exotel, AISENSY, etc.)
2. Sign up & verify business
3. Create message templates
4. Wait for approval (24-48 hrs)
5. Use template names in workflow
6. ✅ Send marketing messages anytime!

---

## 📊 Comparison: Session vs Template

| Feature | Session Message | Template Message |
|---------|----------------|-----------------|
| **Who initiates** | Customer first | Business anytime |
| **Time limit** | 24 hours | No limit |
| **Approval needed** | No | Yes (24-48 hrs) |
| **Message format** | Free-form | Fixed structure |
| **Use case** | Support, replies | Marketing, notifications |
| **Cost** | **FREE** | ₹0.20 - ₹1.35 per msg |
| **Supported now** | ✅ YES | ✅ YES |

---

## 🎯 Recommended Strategy

### **Phase 1: Testing (This Week)**
- Use Twilio WhatsApp Sandbox
- Test session messages
- Build your workflows
- Verify everything works

### **Phase 2: Production (Next 2 Weeks)**
1. Choose provider based on your market:
   - **India-focused**: Exotel or AISENSY
   - **Global**: Twilio or 360Dialog
2. Apply for WhatsApp Business API
3. Create 3-5 template messages:
   - Order confirmation
   - Appointment reminder
   - OTP verification
   - Payment receipt
   - General notification
4. Get templates approved
5. Deploy!

---

## ❓ FAQ

**Q: Can I test template messages without approval?**
A: No. Templates must be approved by Meta first. Use session messages for testing.

**Q: Which provider is best for India?**
A: **Exotel** or **AISENSY** - local support, India-compliant, competitive pricing.

**Q: Can I send images with template messages?**
A: Yes, but the template must include media header when created in Meta Business Manager.

**Q: What happens if I try to send session message after 24 hours?**
A: Message will fail. You must use a template message instead.

**Q: How many templates can I create?**
A: Unlimited, but each needs separate approval.

**Q: Can I modify template after approval?**
A: No. You must create a new template and get it approved again.

---

## ✅ Summary

Your platform now supports **both session AND template messages** for WhatsApp:

1. ✅ **6 providers** including Exotel (NEW)
2. ✅ **Session messages** work immediately (no setup)
3. ✅ **Template messages** fully supported (requires approval)
4. ✅ **UI includes** message type selector
5. ✅ **Backend handles** both message types correctly
6. ✅ **Variable substitution** works in both types

**Your implementation is production-ready!** 🚀

Just need to:
- Choose a provider
- Create & approve templates (for business-initiated messages)
- Start sending!

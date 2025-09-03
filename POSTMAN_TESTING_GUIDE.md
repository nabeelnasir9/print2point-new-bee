# Postman Testing Guide for Chat System

## 🔧 Setup Prerequisites

### **1. Deploy and Start Server**
```bash
npm install
npm start
# Server should be running on localhost:5000 or your Render URL
```

### **2. Get Authentication Tokens**
You'll need JWT tokens for testing. Use your existing auth endpoints:

**Customer Token:**
```bash
POST /api/auth/customer/login
{
  "email": "customer@example.com",
  "password": "password123"
}
```

**Agent Token:**
```bash
POST /api/auth/print-agent/login
{
  "email": "agent@example.com", 
  "password": "password123"
}
```

### **3. Create a Print Job & Make Payment**
Use your existing endpoints to:
1. Create a print job
2. Select an agent
3. Make a payment (this triggers chat creation)

**⚠️ IMPORTANT**: The system now follows the original flow where:
- Chat sessions are ONLY created after successful payment completion
- Selecting an agent does NOT automatically create chat sessions
- For testing without payment, use the dedicated test endpoint below

## 📋 Postman Collection Setup

### **Environment Variables**
Create a Postman environment with these variables:

```json
{
  "base_url": "http://localhost:5000",
  "customer_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "agent_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "job_id": "673a1b2c3d4e5f6789012345",
  "conversation_id": "673a1b2c3d4e5f6789012346",
  "message_id": "673a1b2c3d4e5f6789012347"
}
```

---

## 🚀 **Testing vs Production Flow**

### **Production Flow (Original)**
1. Customer creates print job → Selects agent → Makes payment → **Chat created automatically**
2. Chat is only available after successful Stripe payment webhook
3. This is the normal user experience in production

### **Testing Flow (For Development)**
1. **Option A**: Use test endpoint: `POST /api/chat/test/create-session/:jobId`
2. **Option B**: Complete normal payment flow to trigger chat creation
3. Test endpoints bypass payment validation for development convenience

---

## 🌐 **API Endpoint Tests**

### **1. Health Check**

**Endpoint:** `GET {{base_url}}/api/chat/health`

**Headers:** None required

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "chat",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### **2. Check Chat Status**

**Endpoint:** `GET {{base_url}}/api/chat/job/{{job_id}}/status`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "chat_enabled": true,
  "status": "active",
  "expires_at": "2024-01-16T10:30:00.000Z",
  "unread_count": 0,
  "end_reason": null,
  "ended_at": null
}
```

**Test with Agent Token:**
```
Authorization: Bearer {{agent_token}}
```

---

### **3. Get Conversation Details**

**Endpoint:** `GET {{base_url}}/api/chat/job/{{job_id}}/conversation`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "673a1b2c3d4e5f6789012346",
    "job": {
      "_id": "673a1b2c3d4e5f6789012345",
      "print_job_title": "Test Document",
      "print_job_description": "Test print job",
      "total_cost": 5.50,
      "status": "pending"
    },
    "customer": {
      "_id": "673a1b2c3d4e5f6789012340",
      "full_name": "John Doe",
      "email": "customer@example.com"
    },
    "agent": {
      "_id": "673a1b2c3d4e5f6789012341",
      "full_name": "Jane Smith",
      "business_name": "Print Shop Pro",
      "email": "agent@example.com"
    },
    "status": "active",
    "chat_enabled": true,
    "expires_at": "2024-01-16T10:30:00.000Z",
    "last_message": {
      "content": "Chat started! You can now communicate about this print job.",
      "sender_type": "system",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    "unread_counts": {
      "customer": 0,
      "agent": 0
    },
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### **4. Get Message History**

**Endpoint:** `GET {{base_url}}/api/chat/job/{{job_id}}/messages`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Query Parameters (Optional):**
```
?page=1&limit=50
```

**Expected Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "673a1b2c3d4e5f6789012347",
      "sender_id": null,
      "sender_type": "system",
      "message_type": "system_notification",
      "content": "Chat started! You can now communicate about this print job.",
      "read_by": [],
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_messages": 1,
    "messages_per_page": 50
  }
}
```

---

### **5. Send Message (Customer)**

**Endpoint:** `POST {{base_url}}/api/chat/job/{{job_id}}/message`

**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "content": "Hello! When will my print job be ready?"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": {
    "id": "673a1b2c3d4e5f6789012348",
    "sender_id": "673a1b2c3d4e5f6789012340",
    "sender_type": "customer",
    "content": "Hello! When will my print job be ready?",
    "created_at": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### **6. Send Message (Agent)**

**Endpoint:** `POST {{base_url}}/api/chat/job/{{job_id}}/message`

**Headers:**
```
Authorization: Bearer {{agent_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "content": "Hi! Your print job will be ready in about 2 hours. I'll let you know when it's done!"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": {
    "id": "673a1b2c3d4e5f6789012349",
    "sender_id": "673a1b2c3d4e5f6789012341",
    "sender_type": "agent",
    "content": "Hi! Your print job will be ready in about 2 hours. I'll let you know when it's done!",
    "created_at": "2024-01-15T10:36:00.000Z"
  }
}
```

---

### **7. Mark Message as Read**

**Endpoint:** `PUT {{base_url}}/api/chat/message/{{message_id}}/read`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Message marked as read",
  "message_id": "673a1b2c3d4e5f6789012349"
}
```

---

### **8. Agent Mark Job Done**

**Endpoint:** `POST {{base_url}}/api/chat/job/{{job_id}}/mark-done`

**Headers:**
```
Authorization: Bearer {{agent_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "completion_note": "Print job completed successfully! Please pick up at your convenience."
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Job marked as completed, chat ended",
  "job_status": "completed",
  "chat_status": "ended"
}
```

---

### **9. Register Push Notification Token**

**Endpoint:** `POST {{base_url}}/api/chat/notification-token`

**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "device_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "mobile"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notification token registered successfully",
  "token_id": "673a1b2c3d4e5f678901234a"
}
```

---

### **10. Unregister Push Notification Token**

**Endpoint:** `DELETE {{base_url}}/api/chat/notification-token`

**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "device_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notification token unregistered successfully"
}
```

---

## 🚨 **Error Response Testing**

### **1. Test Unauthorized Access**

**Try customer accessing agent's job:**

**Endpoint:** `GET {{base_url}}/api/chat/job/{{wrong_job_id}}/status`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Expected Response:**
```json
{
  "message": "Unauthorized"
}
```
**Status Code:** `403`

---

### **2. Test Invalid Job ID**

**Endpoint:** `GET {{base_url}}/api/chat/job/invalid-job-id/status`

**Headers:**
```
Authorization: Bearer {{customer_token}}
```

**Expected Response:**
```json
{
  "message": "Chat not found for this job"
}
```
**Status Code:** `404`

---

### **3. Test Missing Token**

**Endpoint:** `GET {{base_url}}/api/chat/job/{{job_id}}/status`

**Headers:** None

**Expected Response:**
```json
{
  "message": "Access denied. No token provided."
}
```
**Status Code:** `401`

---

### **4. Test Invalid Message Content**

**Endpoint:** `POST {{base_url}}/api/chat/job/{{job_id}}/message`

**Headers:**
```
Authorization: Bearer {{customer_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "content": ""
}
```

**Expected Response:**
```json
{
  "message": "Message content is required"
}
```
**Status Code:** `400`

---

## 📋 **Testing Workflow**

### **Complete Test Sequence:**

1. **✅ Health Check** - Verify server is running
2. **✅ Create Print Job** - Use existing endpoint
3. **✅ Make Payment** - Triggers chat creation
4. **✅ Check Chat Status** - Both customer and agent
5. **✅ Get Conversation** - Verify details are correct
6. **✅ Send Messages** - Both directions (customer ↔ agent)
7. **✅ Check Message History** - Verify messages saved
8. **✅ Mark Messages Read** - Test read receipts
9. **✅ Register Push Tokens** - Both users
10. **✅ Agent Mark Done** - End chat early
11. **✅ Verify Chat Disabled** - Check status after completion

### **Error Testing:**
- Invalid tokens
- Wrong job IDs
- Unauthorized access
- Missing required fields
- Invalid message content

---

## 🔍 **Quick Debug Tips**

### **Check Server Logs:**
```bash
# Look for these log messages:
- "Chat conversation created successfully"
- "Message sent by [userId] in job [jobId]"
- "Chat disabled for completed job: [jobId]"
- "Push notifications sent: X notifications"
```

### **Verify Database:**
```javascript
// Check if conversation was created
db.conversations.find({print_job_id: ObjectId("your_job_id")})

// Check messages
db.messages.find({print_job_id: ObjectId("your_job_id")})

// Check notification tokens
db.notificationtokens.find({user_id: ObjectId("your_user_id")})
```

### **Common Issues:**
- **404 "Chat not found"** → Make sure payment was successful and chat was created
- **403 "Unauthorized"** → User doesn't own this job
- **401 "Access denied"** → Invalid or missing JWT token
- **400 "Content required"** → Empty or invalid message content

This testing guide covers all endpoints comprehensively! 🚀
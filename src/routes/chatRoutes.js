const express = require("express");
const router = express.Router();
const ChatSession = require("../models/chat-session-schema");
const Message = require("../models/message-schema");
const { 
  getChatHistory, 
  getActiveChatsForUser, 
  disableChatForJob,
  getChatStatistics
} = require("../services/chatService");
const verifyToken = require("../middleware/verifyToken");

// Custom middleware to verify multiple user types for chat
const verifyChatAccess = (allowedRoles) => {
  return (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;

      if (req.user.role === "admin") {
        return next();
      }

      if (allowedRoles && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied, insufficient permissions" });
      }

      next();
    } catch (err) {
      console.error("Token verification failed:", err.message);
      res.status(401).json({ message: "Token is not valid" });
    }
  };
};

/**
 * Get all active chat sessions for the authenticated user
 * GET /api/chat/sessions
 */
router.get("/sessions", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;

    const chats = await getActiveChatsForUser(userId, userType);

    res.status(200).json({
      success: true,
      message: "Active chat sessions retrieved successfully",
      data: {
        chats,
        count: chats.length
      }
    });

  } catch (error) {
    console.error("Error getting chat sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat sessions",
      error: error.message
    });
  }
});

/**
 * Get chat history for a specific session
 * GET /api/chat/sessions/:sessionId/messages
 */
router.get("/sessions/:sessionId/messages", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;
    const userType = req.user.role;

    // Verify user has access to this chat session
    const chatSession = await ChatSession.findById(sessionId);
    
    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Check if user is participant in this chat
    const isCustomer = userType === "customer" && 
                     chatSession.customer_id.toString() === userId;
    const isAgent = userType === "printAgent" && 
                   chatSession.agent_id.toString() === userId;

    if (!isCustomer && !isAgent) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to chat session"
      });
    }

    // Get chat history
    const history = await getChatHistory(sessionId, parseInt(page), parseInt(limit));

    // Mark messages as read
    if (userType === "customer") {
      await Message.markAllAsReadByCustomer(sessionId);
    } else {
      await Message.markAllAsReadByAgent(sessionId);
    }

    res.status(200).json({
      success: true,
      message: "Chat history retrieved successfully",
      data: history
    });

  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat history",
      error: error.message
    });
  }
});

/**
 * Get details of a specific chat session
 * GET /api/chat/sessions/:sessionId
 */
router.get("/sessions/:sessionId", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const chatSession = await ChatSession.findById(sessionId)
      .populate("printJob")
      .populate("customer", "full_name email")
      .populate("agent", "full_name email business_name");

    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Check if user is participant in this chat
    const isCustomer = userType === "customer" && 
                     chatSession.customer_id.toString() === userId;
    const isAgent = userType === "printAgent" && 
                   chatSession.agent_id.toString() === userId;

    if (!isCustomer && !isAgent) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to chat session"
      });
    }

    res.status(200).json({
      success: true,
      message: "Chat session details retrieved successfully",
      data: {
        chatSession
      }
    });

  } catch (error) {
    console.error("Error getting chat session details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat session details",
      error: error.message
    });
  }
});

/**
 * Mark a chat session as completed (agent only)
 * POST /api/chat/sessions/:sessionId/complete
 */
router.post("/sessions/:sessionId/complete", verifyToken("printAgent"), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agentId = req.user.id;

    const chatSession = await ChatSession.findById(sessionId);

    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Verify agent owns this chat session
    if (chatSession.agent_id.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to complete this chat session"
      });
    }

    // Check if already completed
    if (chatSession.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Chat session is already completed"
      });
    }

    // Mark as completed
    await chatSession.markCompleted("agent");

    // Create system message
    const systemMessage = new Message({
      chat_session_id: sessionId,
      sender_id: null,
      sender_type: "system",
      message_text: "This chat has been marked as completed by the print agent.",
      message_type: "system"
    });

    await systemMessage.save();

    // Notify via socket if available
    const { io } = require("../services/chatService");
    if (io) {
      io.to(`chat_${sessionId}`).emit("chat_completed", {
        chatSessionId: sessionId,
        completedBy: "agent",
        message: systemMessage
      });
    }

    res.status(200).json({
      success: true,
      message: "Chat session marked as completed successfully",
      data: {
        chatSession: await ChatSession.findById(sessionId)
      }
    });

  } catch (error) {
    console.error("Error completing chat session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete chat session",
      error: error.message
    });
  }
});

/**
 * Send a message via REST API (fallback for when socket is not available)
 * POST /api/chat/sessions/:sessionId/messages
 */
router.post("/sessions/:sessionId/messages", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message_text, message_type = "text" } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;

    // Validate input
    if (!message_text || message_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message text is required"
      });
    }

    // Verify chat session exists and user has access
    const chatSession = await ChatSession.findById(sessionId);
    
    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }

    // Check if chat is still active
    if (chatSession.status !== "active" || chatSession.isExpired()) {
      return res.status(400).json({
        success: false,
        message: "Chat session is no longer active"
      });
    }

    // Verify user participation
    const isCustomer = userType === "customer" && 
                     chatSession.customer_id.toString() === userId;
    const isAgent = userType === "printAgent" && 
                   chatSession.agent_id.toString() === userId;

    if (!isCustomer && !isAgent) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to send message in this chat"
      });
    }

    // Create new message
    const newMessage = new Message({
      chat_session_id: sessionId,
      sender_id: userId,
      sender_type: userType === "printAgent" ? "agent" : userType,
      message_text: message_text.trim(),
      message_type: message_type
    });

    await newMessage.save();

    // Populate sender details
    await newMessage.populate("sender", "full_name email business_name");

    // Update chat session last message time
    await chatSession.updateLastMessage();

    // Emit via socket if available
    const { io } = require("../services/chatService");
    if (io) {
      io.to(`chat_${sessionId}`).emit("new_message", {
        message: newMessage,
        chatSessionId: sessionId
      });
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        message: newMessage
      }
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message
    });
  }
});

/**
 * Get chat session by print job ID
 * GET /api/chat/jobs/:jobId/session
 */
router.get("/jobs/:jobId/session", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const chatSession = await ChatSession.findOne({ print_job_id: jobId })
      .populate("printJob")
      .populate("customer", "full_name email")
      .populate("agent", "full_name email business_name");

    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: "No chat session found for this print job"
      });
    }

    // Check if user is participant in this chat
    const isCustomer = userType === "customer" && 
                     chatSession.customer_id.toString() === userId;
    const isAgent = userType === "printAgent" && 
                   chatSession.agent_id.toString() === userId;

    if (!isCustomer && !isAgent) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this chat session"
      });
    }

    res.status(200).json({
      success: true,
      message: "Chat session found",
      data: {
        chatSession
      }
    });

  } catch (error) {
    console.error("Error getting chat session by job ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat session",
      error: error.message
    });
  }
});

/**
 * Get unread message count for user
 * GET /api/chat/unread-count
 */
router.get("/unread-count", verifyChatAccess(["customer", "printAgent"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;

    // Get all active chat sessions for user
    const chats = await getActiveChatsForUser(userId, userType);
    
    let totalUnreadCount = 0;
    const chatUnreadCounts = [];

    for (let chat of chats) {
      let unreadCount;
      
      if (userType === "customer") {
        unreadCount = await Message.getUnreadCountForCustomer(chat._id);
      } else {
        unreadCount = await Message.getUnreadCountForAgent(chat._id);
      }

      totalUnreadCount += unreadCount;
      
      if (unreadCount > 0) {
        chatUnreadCounts.push({
          chatSessionId: chat._id,
          unreadCount: unreadCount
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Unread count retrieved successfully",
      data: {
        totalUnreadCount,
        chatUnreadCounts
      }
    });

  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve unread count",
      error: error.message
    });
  }
});

/**
 * Admin endpoint to get chat statistics
 * GET /api/chat/admin/statistics
 */
router.get("/admin/statistics", verifyToken("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await getChatStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.status(200).json({
      success: true,
      message: "Chat statistics retrieved successfully",
      data: stats
    });

  } catch (error) {
    console.error("Error getting chat statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat statistics",
      error: error.message
    });
  }
});

/**
 * TEST ENDPOINT - Create chat session for any print job (for testing purposes)
 * POST /api/chat/test/create-session/:jobId
 */
router.post("/test/create-session/:jobId", verifyToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Get print job details
    const PrintJob = require("../../models/print-job-schema");
    const printJob = await PrintJob.findById(jobId);
    
    if (!printJob) {
      return res.status(404).json({
        success: false,
        message: "Print job not found"
      });
    }

    // Create chat session
    const session = await createChatSession(printJob._id, printJob.customer_id, printJob.print_agent_id);

    res.status(201).json({
      success: true,
      message: "Test chat session created successfully",
      data: { session }
    });
  } catch (error) {
    console.error("Error creating test chat session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create test chat session",
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 * GET /api/chat/health
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Chat service is healthy",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
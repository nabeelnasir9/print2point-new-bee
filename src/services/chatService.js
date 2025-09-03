const jwt = require("jsonwebtoken");
const ChatSession = require("../models/chat-session-schema");
const Message = require("../models/message-schema");
const Customer = require("../models/customer-schema");
const PrintAgent = require("../models/print-agent-schema");
const PrintJob = require("../models/print-job-schema");

// Store active socket connections
const activeConnections = new Map();

/**
 * Initialize Socket.io chat handlers
 */
function initializeChatSocketHandlers(io) {
  // JWT Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Extract user info from JWT payload structure
      const userId = decoded.user.id;
      const userType = decoded.user.role;
      
      // Fetch user details based on user type
      let user;
      if (userType === "customer") {
        user = await Customer.findById(userId);
      } else if (userType === "printAgent") {
        user = await PrintAgent.findById(userId);
      } else {
        return next(new Error("Invalid user type"));
      }

      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user info to socket
      socket.userId = userId;
      socket.userType = userType;
      socket.userData = user;

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Invalid authentication token"));
    }
  });

  // Handle socket connections
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userType} ${socket.userId}`);
    
    // Store active connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      userType: socket.userType,
      socket: socket
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Handle joining chat rooms
    socket.on("join_chat", async (data) => {
      try {
        const { chatSessionId } = data;
        
        // Verify user has access to this chat
        const chatSession = await ChatSession.findById(chatSessionId);
        
        if (!chatSession) {
          socket.emit("error", { message: "Chat session not found" });
          return;
        }

        // Check if user is participant in this chat
        const isCustomer = socket.userType === "customer" && 
                         chatSession.customer_id.toString() === socket.userId;
        const isAgent = socket.userType === "printAgent" && 
                       chatSession.agent_id.toString() === socket.userId;

        if (!isCustomer && !isAgent) {
          socket.emit("error", { message: "Unauthorized access to chat" });
          return;
        }

        // Join the chat room
        socket.join(`chat_${chatSessionId}`);
        
        // Mark messages as read
        if (socket.userType === "customer") {
          await Message.markAllAsReadByCustomer(chatSessionId);
        } else {
          await Message.markAllAsReadByAgent(chatSessionId);
        }

        // Emit successful join
        socket.emit("chat_joined", { chatSessionId });
        
        // Notify other participant that user is online
        socket.to(`chat_${chatSessionId}`).emit("user_online", {
          userId: socket.userId,
          userType: socket.userType
        });

        console.log(`${socket.userType} ${socket.userId} joined chat ${chatSessionId}`);

      } catch (error) {
        console.error("Error joining chat:", error);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Handle leaving chat rooms
    socket.on("leave_chat", (data) => {
      const { chatSessionId } = data;
      socket.leave(`chat_${chatSessionId}`);
      
      // Notify other participant that user is offline
      socket.to(`chat_${chatSessionId}`).emit("user_offline", {
        userId: socket.userId,
        userType: socket.userType
      });
      
      console.log(`${socket.userType} ${socket.userId} left chat ${chatSessionId}`);
    });

    // Handle sending messages
    socket.on("send_message", async (data) => {
      try {
        const { chatSessionId, messageText, messageType = "text" } = data;

        // Validate input
        if (!chatSessionId || !messageText || messageText.trim().length === 0) {
          socket.emit("error", { message: "Invalid message data" });
          return;
        }

        // Verify chat session exists and user has access
        const chatSession = await ChatSession.findById(chatSessionId);
        
        if (!chatSession) {
          socket.emit("error", { message: "Chat session not found" });
          return;
        }

        // Check if chat is still active
        if (chatSession.status !== "active" || chatSession.isExpired()) {
          socket.emit("error", { message: "Chat session is no longer active" });
          return;
        }

        // Verify user participation
        const isCustomer = socket.userType === "customer" && 
                         chatSession.customer_id.toString() === socket.userId;
        const isAgent = socket.userType === "printAgent" && 
                       chatSession.agent_id.toString() === socket.userId;

        if (!isCustomer && !isAgent) {
          socket.emit("error", { message: "Unauthorized to send message" });
          return;
        }

        // Create new message
        const senderType = socket.userType === "printAgent" ? "agent" : socket.userType;
        
        const newMessage = new Message({
          chat_session_id: chatSessionId,
          sender_id: socket.userId,
          sender_type: senderType,
          message_text: messageText.trim(),
          message_type: messageType
        });

        await newMessage.save();

        // Populate sender details
        await newMessage.populate("sender");

        // Update chat session last message time
        await chatSession.updateLastMessage();

        // Emit message to all participants in the chat room
        io.to(`chat_${chatSessionId}`).emit("new_message", {
          message: newMessage,
          chatSessionId: chatSessionId
        });

        // Send push notification to offline users (if implemented)
        await sendPushNotificationIfOffline(chatSession, newMessage, socket.userId);

        console.log(`Message sent in chat ${chatSessionId} by ${socket.userType} ${socket.userId}`);

      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      const { chatSessionId } = data;
      socket.to(`chat_${chatSessionId}`).emit("user_typing", {
        userId: socket.userId,
        userType: socket.userType,
        isTyping: true
      });
    });

    socket.on("typing_stop", (data) => {
      const { chatSessionId } = data;
      socket.to(`chat_${chatSessionId}`).emit("user_typing", {
        userId: socket.userId,
        userType: socket.userType,
        isTyping: false
      });
    });

    // Handle marking messages as read
    socket.on("mark_messages_read", async (data) => {
      try {
        const { chatSessionId } = data;

        if (socket.userType === "customer") {
          await Message.markAllAsReadByCustomer(chatSessionId);
        } else {
          await Message.markAllAsReadByAgent(chatSessionId);
        }

        // Notify other participant
        socket.to(`chat_${chatSessionId}`).emit("messages_read", {
          userId: socket.userId,
          userType: socket.userType
        });

      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userType} ${socket.userId}`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);
      
      // Notify all chat rooms this user was in that they're offline
      socket.rooms.forEach(room => {
        if (room.startsWith("chat_")) {
          socket.to(room).emit("user_offline", {
            userId: socket.userId,
            userType: socket.userType
          });
        }
      });
    });
  });

  // Store io instance for use in other parts of the application
  chatService.io = io;
}

/**
 * Create a new chat session when payment is successful
 */
async function createChatSession(printJobId, customerId, agentId) {
  try {
    // Check if chat session already exists for this print job
    let existingSession = await ChatSession.findOne({ print_job_id: printJobId });
    
    if (existingSession) {
      console.log("Chat session already exists for print job:", printJobId);
      return existingSession;
    }

    // Get print job details for the auto message
    const printJob = await PrintJob.findById(printJobId);
    if (!printJob) {
      throw new Error("Print job not found");
    }

    // Create new chat session
    const chatSession = new ChatSession({
      print_job_id: printJobId,
      customer_id: customerId,
      agent_id: agentId
    });

    await chatSession.save();

    // Create the initial auto message
    const autoMessage = new Message({
      chat_session_id: chatSession._id,
      sender_id: customerId,
      sender_type: "system",
      message_text: `Hi! I have placed an order #${printJob._id.toString().slice(-6)} for ${printJob.pages} pages ${printJob.is_color ? 'color' : 'black & white'} printing`,
      message_type: "auto"
    });

    await autoMessage.save();

    console.log("Chat session created successfully:", chatSession._id);

    // Notify agent if they're online
    if (chatService.io) {
      chatService.io.to(`user_${agentId}`).emit("new_chat_session", {
        chatSession: await ChatSession.findById(chatSession._id).populate("printJob customer"),
        initialMessage: autoMessage
      });
    }

    return chatSession;

  } catch (error) {
    console.error("Error creating chat session:", error);
    throw error;
  }
}

/**
 * Disable chat for a completed job
 */
async function disableChatForJob(printJobId, completedBy = "agent") {
  try {
    const chatSession = await ChatSession.findOne({ print_job_id: printJobId });
    
    if (!chatSession) {
      console.log("No chat session found for print job:", printJobId);
      return null;
    }

    if (chatSession.status === "completed") {
      console.log("Chat session already completed for print job:", printJobId);
      return chatSession;
    }

    // Mark session as completed
    await chatSession.markCompleted(completedBy);

    // Send system message about completion
    const systemMessage = new Message({
      chat_session_id: chatSession._id,
      sender_id: null,
      sender_type: "system",
      message_text: completedBy === "auto_24h" 
        ? "This chat has been automatically closed after 24 hours."
        : "This chat has been marked as completed by the print agent.",
      message_type: "system"
    });

    await systemMessage.save();

    // Notify both participants if they're online
    if (chatService.io) {
      chatService.io.to(`chat_${chatSession._id}`).emit("chat_completed", {
        chatSessionId: chatSession._id,
        completedBy: completedBy,
        message: systemMessage
      });
    }

    console.log("Chat session disabled for print job:", printJobId);
    return chatSession;

  } catch (error) {
    console.error("Error disabling chat for job:", error);
    throw error;
  }
}

/**
 * Get chat history for a session
 */
async function getChatHistory(chatSessionId, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ chat_session_id: chatSessionId })
      .populate("sender", "full_name email business_name")
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Message.countDocuments({ chat_session_id: chatSessionId });

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    console.error("Error getting chat history:", error);
    throw error;
  }
}

/**
 * Get active chat sessions for a user
 */
async function getActiveChatsForUser(userId, userType) {
  try {
    let chats;
    
    if (userType === "customer") {
      chats = await ChatSession.findActiveForCustomer(userId);
    } else if (userType === "printAgent") {
      chats = await ChatSession.findActiveForAgent(userId);
    } else {
      throw new Error("Invalid user type");
    }

    // Get the latest message for each chat
    for (let chat of chats) {
      const latestMessage = await Message.findOne({ 
        chat_session_id: chat._id 
      }).sort({ timestamp: -1 });
      
      chat.latestMessage = latestMessage;
    }

    return chats;

  } catch (error) {
    console.error("Error getting active chats:", error);
    throw error;
  }
}

/**
 * Send push notification if user is offline
 */
async function sendPushNotificationIfOffline(chatSession, message, senderId) {
  try {
    // Determine recipient
    const recipientId = message.sender_type === "customer" 
      ? chatSession.agent_id.toString()
      : chatSession.customer_id.toString();

    // Check if recipient is online
    const isOnline = activeConnections.has(recipientId);
    
    if (!isOnline) {
      // TODO: Implement push notification service
      console.log(`User ${recipientId} is offline, should send push notification`);
      
      // Example notification payload:
      const notificationPayload = {
        title: message.sender_type === "customer" 
          ? "New message from customer"
          : "New message from print agent",
        body: message.message_text,
        data: {
          chatSessionId: chatSession._id.toString(),
          messageId: message._id.toString(),
          type: "chat_message"
        }
      };
      
      // Here you would integrate with Firebase FCM, Apple Push Notifications, etc.
      console.log("Push notification payload:", notificationPayload);
    }

  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

/**
 * Cleanup expired chat sessions (run as a cron job)
 */
async function cleanupExpiredSessions() {
  try {
    const result = await ChatSession.expireOldSessions();
    console.log(`Expired ${result.modifiedCount} chat sessions`);
    return result;
  } catch (error) {
    console.error("Error cleaning up expired sessions:", error);
    throw error;
  }
}

/**
 * Get chat statistics for admin/analytics
 */
async function getChatStatistics(startDate, endDate) {
  try {
    const stats = await ChatSession.aggregate([
      {
        $match: {
          created_at: {
            $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            $lt: endDate || new Date()
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          activeSessions: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
          },
          completedSessions: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          expiredSessions: {
            $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] }
          },
          avgMessages: { $avg: "$total_messages" }
        }
      }
    ]);

    return stats[0] || {
      totalSessions: 0,
      activeSessions: 0,
      completedSessions: 0,
      expiredSessions: 0,
      avgMessages: 0
    };

  } catch (error) {
    console.error("Error getting chat statistics:", error);
    throw error;
  }
}

// Export the chat service
const chatService = {
  initializeChatSocketHandlers,
  createChatSession,
  disableChatForJob,
  getChatHistory,
  getActiveChatsForUser,
  cleanupExpiredSessions,
  getChatStatistics,
  io: null // Will be set by initializeChatSocketHandlers
};

module.exports = chatService;
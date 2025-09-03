const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chat_session_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "ChatSession", 
    required: true 
  },
  sender_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  sender_type: {
    type: String,
    enum: ["customer", "agent", "system"],
    required: true
  },
  message_text: { 
    type: String, 
    required: true,
    maxlength: 2000 // Reasonable message limit
  },
  message_type: {
    type: String,
    enum: ["text", "system", "auto", "order_update", "file"],
    default: "text"
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  read_by_customer: { 
    type: Boolean, 
    default: false 
  },
  read_by_agent: { 
    type: Boolean, 
    default: false 
  },
  // For file attachments (future enhancement)
  file_url: { 
    type: String 
  },
  file_type: { 
    type: String 
  },
  file_name: { 
    type: String 
  },
  // For system messages and metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// Indexes for performance
messageSchema.index({ chat_session_id: 1, timestamp: -1 });
messageSchema.index({ sender_id: 1, timestamp: -1 });
messageSchema.index({ chat_session_id: 1, read_by_customer: 1 });
messageSchema.index({ chat_session_id: 1, read_by_agent: 1 });

// Virtual for sender details (dynamic based on sender_type)
messageSchema.virtual("sender", {
  ref: function() {
    return this.sender_type === "customer" ? "Customer" : "PrintAgent";
  },
  localField: "sender_id",
  foreignField: "_id",
  justOne: true
});

// Set virtual fields to be included in JSON
messageSchema.set("toJSON", { virtuals: true });
messageSchema.set("toObject", { virtuals: true });

// Method to mark message as read by customer
messageSchema.methods.markReadByCustomer = function() {
  if (!this.read_by_customer) {
    this.read_by_customer = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to mark message as read by agent
messageSchema.methods.markReadByAgent = function() {
  if (!this.read_by_agent) {
    this.read_by_agent = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to mark all messages in a session as read
messageSchema.statics.markAllAsReadByCustomer = function(chatSessionId) {
  return this.updateMany(
    { 
      chat_session_id: chatSessionId, 
      read_by_customer: false,
      sender_type: { $ne: "customer" } // Don't mark customer's own messages
    },
    { read_by_customer: true }
  );
};

messageSchema.statics.markAllAsReadByAgent = function(chatSessionId) {
  return this.updateMany(
    { 
      chat_session_id: chatSessionId, 
      read_by_agent: false,
      sender_type: { $ne: "agent" } // Don't mark agent's own messages
    },
    { read_by_agent: true }
  );
};

// Static method to get unread count for a user
messageSchema.statics.getUnreadCountForCustomer = function(chatSessionId) {
  return this.countDocuments({
    chat_session_id: chatSessionId,
    read_by_customer: false,
    sender_type: { $ne: "customer" }
  });
};

messageSchema.statics.getUnreadCountForAgent = function(chatSessionId) {
  return this.countDocuments({
    chat_session_id: chatSessionId,
    read_by_agent: false,
    sender_type: { $ne: "agent" }
  });
};

// Pre-save middleware to auto-mark own messages as read
messageSchema.pre("save", function(next) {
  if (this.isNew) {
    // Auto-mark sender's own messages as read
    if (this.sender_type === "customer") {
      this.read_by_customer = true;
    } else if (this.sender_type === "agent") {
      this.read_by_agent = true;
    } else if (this.sender_type === "system") {
      // System messages are considered "read" by both
      this.read_by_customer = true;
      this.read_by_agent = true;
    }
  }
  next();
});

// Post-save middleware to update chat session counters
messageSchema.post("save", async function() {
  try {
    const ChatSession = mongoose.model("ChatSession");
    const session = await ChatSession.findById(this.chat_session_id);
    
    if (session) {
      // Update total message count
      session.total_messages = await this.constructor.countDocuments({
        chat_session_id: this.chat_session_id
      });
      
      // Update unread counts
      session.unread_by_customer = await this.constructor.getUnreadCountForCustomer(this.chat_session_id);
      session.unread_by_agent = await this.constructor.getUnreadCountForAgent(this.chat_session_id);
      
      // Update last message timestamp
      session.last_message_at = this.timestamp;
      
      await session.save();
    }
  } catch (error) {
    console.error("Error updating chat session counters:", error);
  }
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
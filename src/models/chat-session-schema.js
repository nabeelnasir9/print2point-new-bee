const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema({
  print_job_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PrintJob", 
    required: true,
    unique: true // One chat session per print job
  },
  customer_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  agent_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PrintAgent", 
    required: true 
  },
  status: {
    type: String,
    enum: ["active", "completed", "expired"],
    default: "active"
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  expires_at: { 
    type: Date, 
    default: function() {
      // 24 hours from creation
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  },
  completed_at: { 
    type: Date 
  },
  completed_by: {
    type: String,
    enum: ["agent", "auto_24h", "system"],
    default: null
  },
  last_message_at: { 
    type: Date, 
    default: Date.now 
  },
  // Message counts for optimization
  total_messages: { 
    type: Number, 
    default: 0 
  },
  unread_by_customer: { 
    type: Number, 
    default: 0 
  },
  unread_by_agent: { 
    type: Number, 
    default: 0 
  }
});

// Indexes for performance
chatSessionSchema.index({ customer_id: 1, status: 1 });
chatSessionSchema.index({ agent_id: 1, status: 1 });
chatSessionSchema.index({ print_job_id: 1 });
chatSessionSchema.index({ expires_at: 1 });

// Virtual for messages
chatSessionSchema.virtual("messages", {
  ref: "Message",
  localField: "_id",
  foreignField: "chat_session_id",
});

// Virtual for print job details
chatSessionSchema.virtual("printJob", {
  ref: "PrintJob",
  localField: "print_job_id",
  foreignField: "_id",
  justOne: true
});

// Virtual for customer details
chatSessionSchema.virtual("customer", {
  ref: "Customer",
  localField: "customer_id",
  foreignField: "_id",
  justOne: true
});

// Virtual for agent details
chatSessionSchema.virtual("agent", {
  ref: "PrintAgent",
  localField: "agent_id",
  foreignField: "_id",
  justOne: true
});

// Set virtual fields to be included in JSON
chatSessionSchema.set("toJSON", { virtuals: true });
chatSessionSchema.set("toObject", { virtuals: true });

// Middleware to update last_message_at when messages are added
chatSessionSchema.methods.updateLastMessage = function() {
  this.last_message_at = new Date();
  return this.save();
};

// Method to mark session as completed
chatSessionSchema.methods.markCompleted = function(completedBy = "agent") {
  this.status = "completed";
  this.completed_at = new Date();
  this.completed_by = completedBy;
  return this.save();
};

// Method to check if session is expired
chatSessionSchema.methods.isExpired = function() {
  return new Date() > this.expires_at;
};

// Static method to find active sessions for a user
chatSessionSchema.statics.findActiveForCustomer = function(customerId) {
  return this.find({ 
    customer_id: customerId, 
    status: "active",
    expires_at: { $gt: new Date() }
  }).populate("printJob agent");
};

chatSessionSchema.statics.findActiveForAgent = function(agentId) {
  return this.find({ 
    agent_id: agentId, 
    status: "active",
    expires_at: { $gt: new Date() }
  }).populate("printJob customer");
};

// Static method to expire old sessions
chatSessionSchema.statics.expireOldSessions = function() {
  return this.updateMany(
    { 
      status: "active", 
      expires_at: { $lt: new Date() } 
    },
    { 
      status: "expired", 
      completed_by: "auto_24h",
      completed_at: new Date()
    }
  );
};

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

module.exports = ChatSession;
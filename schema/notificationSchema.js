const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String, // User email
    required: true
  },
  type: {
    type: String,
    enum: ["message", "post", "update"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: String, // ID of related post, message, etc.
    default: null
  },
  relatedEmail: {
    type: String, // Email of user who triggered the notification
    default: null
  },
  read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("notification", notificationSchema);


const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  senderEmail: {
    type: String,
    required: true
  },
  receiverEmail: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("chat", chatSchema);

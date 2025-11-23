const express = require("express");
const chatRouter = express.Router();
const Chat = require("../schema/chatSchema");
const User = require("../schema/userSchema");
const Notification = require("../schema/notificationSchema");
const { authenticateUser } = require("../MiddleWare/auth");

// Helper function to create notification for new message
const createMessageNotification = async (receiverEmail, senderEmail, message, io) => {
  try {
    const sender = await User.findOne({ email: senderEmail });
    const senderName = sender?.name || senderEmail;
    
    const notification = new Notification({
      userId: receiverEmail,
      type: "message",
      title: "New Message",
      message: `${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      relatedId: null,
      relatedEmail: senderEmail
    });
    
    await notification.save();
    
    // Emit notification via socket.io if available
    if (io) {
      io.to(receiverEmail).emit("notification:new", notification);
    }
  } catch (error) {
    console.error("Error creating message notification:", error);
  }
};

// Send a message
chatRouter.post("/send", authenticateUser, async (req, res) => {
  try {
    const { receiverEmail, message } = req.body;
    const senderEmail = req.user.email;

    if (!receiverEmail || !message) {
      return res.status(400).json({ error: "Receiver email and message are required" });
    }

    const chat = new Chat({
      senderEmail,
      receiverEmail,
      message
    });

    const savedChat = await chat.save();
    
    // Create notification for receiver (only if not reading their own messages)
    if (senderEmail !== receiverEmail) {
      const sender = await User.findOne({ email: senderEmail });
      const senderName = sender?.name || senderEmail;
      
      const notification = new Notification({
        userId: receiverEmail,
        type: "message",
        title: "New Message",
        message: `${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        relatedId: savedChat._id.toString(),
        relatedEmail: senderEmail
      });
      
      await notification.save();
      
      // Emit notification via socket.io
      try {
        const { io } = require("../index");
        if (io) {
          io.to(receiverEmail).emit("notification:new", notification);
        }
      } catch (err) {
        console.error("Error emitting notification:", err);
      }
    }
    
    res.status(200).json({ success: true, chat: savedChat });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get all messages between two users
chatRouter.get("/messages/:receiverEmail", authenticateUser, async (req, res) => {
  try {
    const senderEmail = req.user.email;
    // Decode URL-encoded email
    const receiverEmail = decodeURIComponent(req.params.receiverEmail);

    const messages = await Chat.find({
      $or: [
        { senderEmail, receiverEmail },
        { senderEmail: receiverEmail, receiverEmail: senderEmail }
      ]
    }).sort({ timestamp: 1 });

    // Mark messages as read
    await Chat.updateMany(
      { senderEmail: receiverEmail, receiverEmail: senderEmail, read: false },
      { read: true }
    );

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get all conversations for the current user
chatRouter.get("/conversations", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get all unique users the current user has chatted with
      const messages = await Chat.find({
        $or: [
          { senderEmail: userEmail },
          { receiverEmail: userEmail }
        ]
      }).sort({ timestamp: -1 });

    // Extract unique conversation partners
    const conversationPartners = new Map();
    
    messages.forEach(msg => {
      const partnerEmail = msg.senderEmail === userEmail ? msg.receiverEmail : msg.senderEmail;
      if (!conversationPartners.has(partnerEmail)) {
        conversationPartners.set(partnerEmail, {
          email: partnerEmail,
          lastMessage: msg.message,
          timestamp: msg.timestamp,
          unreadCount: 0
        });
      }
    });

    // Get unread counts
    for (let partner of conversationPartners.values()) {
      const unread = await Chat.countDocuments({
        senderEmail: partner.email,
        receiverEmail: userEmail,
        read: false
      });
      partner.unreadCount = unread;
    }

    // Get user details for each partner
    const conversations = await Promise.all(
      Array.from(conversationPartners.values()).map(async (partner) => {
        const user = await User.findOne({ email: partner.email });
        return {
          email: partner.email,
          name: user?.name || "Unknown",
          profileImageUrl: user?.profileImageUrl || "",
          lastMessage: partner.lastMessage,
          timestamp: partner.timestamp,
          unreadCount: partner.unreadCount
        };
      })
    );

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get all users (for starting new conversations)
chatRouter.get("/users", authenticateUser, async (req, res) => {
  try {
    const currentUserEmail = req.user.email;
    const users = await User.find({ email: { $ne: currentUserEmail } });
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = chatRouter;

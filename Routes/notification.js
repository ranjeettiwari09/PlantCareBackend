const express = require("express");
const notificationRouter = express.Router();
const Notification = require("../schema/notificationSchema");
const { authenticateUser } = require("../MiddleWare/auth");

// Get all notifications for the current user
notificationRouter.get("/", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const notifications = await Notification.find({ userId: userEmail })
      .sort({ timestamp: -1 })
      .limit(50); // Get last 50 notifications

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get unread notification count
notificationRouter.get("/unread-count", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const count = await Notification.countDocuments({ 
      userId: userEmail, 
      read: false 
    });

    res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Mark notification as read
notificationRouter.put("/read/:id", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: userEmail },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Mark all notifications as read
notificationRouter.put("/read-all", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    await Notification.updateMany(
      { userId: userEmail, read: false },
      { read: true }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Clear all notifications for the current user (MUST be before /:id route)
notificationRouter.delete("/clear-all", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const result = await Notification.deleteMany({ userId: userEmail });

    res.status(200).json({ 
      success: true, 
      message: "All notifications cleared",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error clearing all notifications:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Delete notification (MUST be after /clear-all route)
notificationRouter.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: userEmail
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = notificationRouter;




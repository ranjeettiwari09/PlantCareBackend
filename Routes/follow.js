const express = require("express");
const followRouter = express.Router();
const User = require("../schema/userSchema");
const { authenticateUser } = require("../MiddleWare/auth");

// Follow a user
followRouter.post("/follow/:email", authenticateUser, async (req, res) => {
  try {
    const currentUserEmail = req.user.email;
    const targetUserEmail = decodeURIComponent(req.params.email);

    if (currentUserEmail === targetUserEmail) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    // Find both users
    const currentUser = await User.findOne({ email: currentUserEmail });
    const targetUser = await User.findOne({ email: targetUserEmail });

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if already following
    if (currentUser.following && currentUser.following.includes(targetUserEmail)) {
      return res.status(400).json({ error: "Already following this user" });
    }

    // Initialize arrays if they don't exist
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    // Add to following list of current user
    currentUser.following.push(targetUserEmail);
    await currentUser.save();

    // Add to followers list of target user
    if (!targetUser.followers.includes(currentUserEmail)) {
      targetUser.followers.push(currentUserEmail);
      await targetUser.save();
    }

    res.status(200).json({ 
      success: true, 
      message: "Successfully followed user",
      following: currentUser.following,
      followers: targetUser.followers
    });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Unfollow a user
followRouter.post("/unfollow/:email", authenticateUser, async (req, res) => {
  try {
    const currentUserEmail = req.user.email;
    const targetUserEmail = decodeURIComponent(req.params.email);

    // Find both users
    const currentUser = await User.findOne({ email: currentUserEmail });
    const targetUser = await User.findOne({ email: targetUserEmail });

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Initialize arrays if they don't exist
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    // Remove from following list of current user
    currentUser.following = currentUser.following.filter(
      (email) => email !== targetUserEmail
    );
    await currentUser.save();

    // Remove from followers list of target user
    targetUser.followers = targetUser.followers.filter(
      (email) => email !== currentUserEmail
    );
    await targetUser.save();

    res.status(200).json({ 
      success: true, 
      message: "Successfully unfollowed user",
      following: currentUser.following,
      followers: targetUser.followers
    });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get follow status
followRouter.get("/status/:email", authenticateUser, async (req, res) => {
  try {
    const currentUserEmail = req.user.email;
    const targetUserEmail = decodeURIComponent(req.params.email);

    const currentUser = await User.findOne({ email: currentUserEmail });
    
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following && currentUser.following.includes(targetUserEmail);

    res.status(200).json({ 
      success: true, 
      isFollowing 
    });
  } catch (error) {
    console.error("Error getting follow status:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get user's following and followers count
followRouter.get("/counts/:email", async (req, res) => {
  try {
    const targetUserEmail = decodeURIComponent(req.params.email);
    const targetUser = await User.findOne({ email: targetUserEmail });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      followingCount: targetUser.following?.length || 0,
      followersCount: targetUser.followers?.length || 0
    });
  } catch (error) {
    console.error("Error getting follow counts:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = followRouter;

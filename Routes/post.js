const post = require("../schema/post");
const express = require("express");
const routerPost = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { authenticateUser } = require("../MiddleWare/auth");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const Notification = require("../schema/notificationSchema");
const User = require("../schema/userSchema");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "news-upload",
    // Removed upload_preset to avoid conflict
    // upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});


// ✅ Get all posts
routerPost.get("/getposts", async (req, res) => {
  try {
    const posts = await post.find();
    res.status(200).json({ posts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
});

// ✅ Get single post by ID
routerPost.get("/:id", async (req, res) => {
  try {
    const singlePost = await post.findById(req.params.id);
    if (!singlePost) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ post: singlePost });
  } catch (error) {
    res.status(500).json({ message: "Server error: " + error.message });
  }
});

// ✅ Add new post
routerPost.post(
  "/addPost",
  authenticateUser,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
        }
        return res.status(400).json({ message: "Image upload error: " + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { caption, date, likeCount, comment } = req.body;
      const image = req.file;
      const email = req.user.email; // Get email from authenticated user

      console.log("Post creation request:", {
        caption: caption?.substring(0, 50),
        hasImage: !!image,
        email
      });

      if (!caption || !caption.trim()) {
        return res.status(400).json({ message: "Caption is required" });
      }

      if (!image) {
        return res.status(400).json({ message: "Image is required" });
      }

      // Get image URL from Cloudinary response (handle different formats)
      const imageUrl = image.path || image.secure_url || image.url;
      if (!imageUrl) {
        console.error("Image upload failed - no URL returned:", image);
        return res.status(400).json({ message: "Image upload failed. Please try again." });
      }

      // Parse date safely
      let postDate;
      if (date) {
        postDate = new Date(date);
        if (isNaN(postDate.getTime())) {
          postDate = new Date(); // Use current date if invalid
        }
      } else {
        postDate = new Date(); // Use current date if not provided
      }

      // Parse comment safely
      let commentArray = [];
      if (comment) {
        try {
          if (typeof comment === 'string') {
            commentArray = JSON.parse(comment);
          } else if (Array.isArray(comment)) {
            commentArray = comment;
          }
        } catch (parseError) {
          console.error("Error parsing comment:", parseError);
          commentArray = [];
        }
      }

      const newPost = new post({
        email,
        caption: caption.trim(),
        image: imageUrl,
        date: postDate,
        likeCount: likeCount ? parseInt(likeCount) : 0,
        comment: commentArray,
        likedBy: []
      });

      await newPost.save();
      console.log("Post created successfully:", newPost._id);

      // Create notifications for all users (except the post creator)
      // In a real app, you might only notify followers
      try {
        const postCreator = await User.findOne({ email: email });
        const creatorName = postCreator?.name || email;

        const allUsers = await User.find({ email: { $ne: email } });

        // Only create notifications if there are other users
        if (allUsers && allUsers.length > 0) {
          // Create notifications for all other users
          const notifications = allUsers.map(user => ({
            userId: user.email,
            type: "post",
            title: "New Post",
            message: `${creatorName} shared a new post: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`,
            relatedId: newPost._id.toString(),
            relatedEmail: email
          }));

          const savedNotifications = await Notification.insertMany(notifications);

          // Emit notifications via socket.io
          try {
            const { io } = require("../index");
            if (io) {
              savedNotifications.forEach(notif => {
                io.to(notif.userId).emit("notification:new", notif);
              });
            }
          } catch (err) {
            console.error("Error emitting post notifications:", err);
          }
        }
      } catch (notifError) {
        console.error("Error creating post notifications:", notifError);
        // Don't fail the post creation if notifications fail
      }

      res.status(201).json({ message: "Post added successfully", post: newPost });
    } catch (error) {
      console.error("Error adding post:", error);
      res.status(500).json({ message: "Server error: " + error.message });
    }
  }
);

// ✅ Delete post (fixed name to match frontend)
routerPost.delete("/delete/:postID", authenticateUser, async (req, res) => {
  try {
    const result = await post.deleteOne({ _id: req.params.postID });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// ✅ Like/Unlike a post
routerPost.put("/like/:postID", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const foundPost = await post.findById(req.params.postID);

    if (!foundPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Initialize likedBy if it doesn't exist
    if (!foundPost.likedBy) {
      foundPost.likedBy = [];
    }

    // Check if user already liked this post
    const userIndex = foundPost.likedBy.indexOf(userEmail);

    if (userIndex !== -1) {
      // User already liked - remove like (unlike)
      foundPost.likedBy.splice(userIndex, 1);
      foundPost.likeCount = Math.max(0, (foundPost.likeCount || 0) - 1);
      await foundPost.save();
      res.status(200).json({ message: "Post unliked", post: foundPost, liked: false });
    } else {
      // User hasn't liked yet - add like
      foundPost.likedBy.push(userEmail);
      foundPost.likeCount = (foundPost.likeCount || 0) + 1;
      await foundPost.save();
      res.status(200).json({ message: "Post liked", post: foundPost, liked: true });
    }
  } catch (error) {
    console.error("Error in like route:", error);
    res.status(500).json({ message: "Failed to like post" });
  }
});


// ✅ Add comment
routerPost.put("/comment/:postID", authenticateUser, async (req, res) => {
  try {
    const { comment } = req.body;
    const updatedPost = await post.findByIdAndUpdate(
      req.params.postID,
      { comment },
      { new: true }
    );
    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ message: "Comment added", post: updatedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// Delete a comment by index
routerPost.delete("/comment/:postID/:commentIndex", authenticateUser, async (req, res) => {
  try {
    const { postID, commentIndex } = req.params;

    const foundPost = await post.findById(postID);
    if (!foundPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    const index = parseInt(commentIndex, 10);
    if (isNaN(index) || index < 0 || index >= foundPost.comment.length) {
      return res.status(400).json({ message: "Invalid comment index" });
    }

    // Remove the comment
    foundPost.comment.splice(index, 1);
    await foundPost.save();

    res.status(200).json({ message: "Comment deleted", post: foundPost });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

// PUT /posts/update/:id
routerPost.put("/update/:id", async (req, res) => {
  const { caption } = req.body;
  try {
    const updatedPost = await post.findByIdAndUpdate(
      req.params.id,
      { caption },
      { new: true }
    );
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Error updating caption" });
  }
});



module.exports = routerPost;


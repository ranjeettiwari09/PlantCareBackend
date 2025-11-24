const express = require("express");
const plantRouter = express.Router();
const Plant = require("../schema/plantSchema");
const { authenticateUser } = require("../MiddleWare/auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "plant-uploads",
    // Removed upload_preset to avoid conflict with news_uploads preset
    // upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
  },
});
const upload = multer({ storage: storage });

const uploadMiddleware = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(400).json({ error: "Image upload error: " + err.message });
    }
    next();
  });
};

// Get all plants for the current user
plantRouter.get("/", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const plants = await Plant.find({ userEmail }).sort({ dateAdded: -1 });
    res.status(200).json({ success: true, plants });
  } catch (error) {
    console.error("Error fetching plants:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get single plant by ID
plantRouter.get("/:id", authenticateUser, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    // Check if plant belongs to user
    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Error fetching plant:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Add new plant
plantRouter.post("/add", authenticateUser, uploadMiddleware, async (req, res) => {
  try {
    const { plantName, plantType, notes } = req.body;
    const userEmail = req.user.email;

    if (!plantName || !plantType) {
      return res.status(400).json({ error: "Plant name and type are required" });
    }

    const newPlant = new Plant({
      userEmail,
      plantName,
      plantType,
      notes: notes || "",
      image: req.file ? req.file.path : "",
      dailyEntries: [],
      careSchedule: {
        wateringFrequency: 3,
        fertilizingFrequency: 14
      }
    });

    await newPlant.save();
    res.status(201).json({ success: true, plant: newPlant });
  } catch (error) {
    console.error("Error adding plant:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Update plant details
plantRouter.put("/:id", authenticateUser, uploadMiddleware, async (req, res) => {
  try {
    const { plantName, plantType, notes } = req.body;
    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (plantName) plant.plantName = plantName;
    if (plantType) plant.plantType = plantType;
    if (notes !== undefined) plant.notes = notes;
    if (req.file && req.file.path) plant.image = req.file.path;

    await plant.save();
    res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Error updating plant:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Delete plant
plantRouter.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    await Plant.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Plant deleted successfully" });
  } catch (error) {
    console.error("Error deleting plant:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Add daily entry
plantRouter.post("/:id/entry", authenticateUser, async (req, res) => {
  try {
    const {
      watered,
      fertilized,
      sunlightHours,
      temperature,
      humidity,
      notes,
      healthStatus,
      growthNotes
    } = req.body;

    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if entry for today already exists
    const existingEntryIndex = plant.dailyEntries.findIndex(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    const entryData = {
      date: today,
      watered: watered || false,
      fertilized: fertilized || false,
      sunlightHours: sunlightHours || 0,
      temperature: temperature || null,
      humidity: humidity || null,
      notes: notes || "",
      healthStatus: healthStatus || "good",
      growthNotes: growthNotes || ""
    };

    if (existingEntryIndex !== -1) {
      // Update existing entry
      plant.dailyEntries[existingEntryIndex] = entryData;
    } else {
      // Add new entry
      plant.dailyEntries.push(entryData);
    }

    // Update care schedule if watered or fertilized
    if (watered) {
      plant.careSchedule.lastWatered = today;
    }
    if (fertilized) {
      plant.careSchedule.lastFertilized = today;
    }

    await plant.save();
    res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Error adding daily entry:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Update care schedule
plantRouter.put("/:id/schedule", authenticateUser, async (req, res) => {
  try {
    const { wateringFrequency, fertilizingFrequency } = req.body;
    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (wateringFrequency !== undefined) {
      plant.careSchedule.wateringFrequency = wateringFrequency;
    }
    if (fertilizingFrequency !== undefined) {
      plant.careSchedule.fertilizingFrequency = fertilizingFrequency;
    }

    await plant.save();
    res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

// Get AI recommendations for a plant
plantRouter.post("/:id/recommendations", authenticateUser, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    if (plant.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    // Prepare plant data for AI
    const recentEntries = plant.dailyEntries
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7); // Last 7 days

    const daysTracked = plant.dailyEntries.length;
    const avgSunlight = recentEntries.length > 0
      ? recentEntries.reduce((sum, e) => sum + (e.sunlightHours || 0), 0) / recentEntries.length
      : 0;
    const lastHealthStatus = recentEntries[0]?.healthStatus || "good";
    const wateringFrequency = plant.careSchedule.wateringFrequency;
    const lastWatered = plant.careSchedule.lastWatered
      ? Math.floor((new Date() - new Date(plant.careSchedule.lastWatered)) / (1000 * 60 * 60 * 24))
      : null;

    const plantDataSummary = `
Plant Name: ${plant.plantName}
Plant Type: ${plant.plantType}
Days Tracked: ${daysTracked}
Average Sunlight Hours (last 7 days): ${avgSunlight.toFixed(1)} hours
Current Health Status: ${lastHealthStatus}
Watering Frequency: Every ${wateringFrequency} days
Days since last watering: ${lastWatered !== null ? lastWatered : "Not recorded"}
Recent Notes: ${recentEntries[0]?.notes || "None"}
Growth Notes: ${recentEntries[0]?.growthNotes || "None"}
    `.trim();

    // Call Groq API for recommendations
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "API key not configured",
        response: "Please configure GROQ_API_KEY in your environment variables."
      });
    }

    const https = require("https");
    const requestData = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a plant care expert. Analyze the provided plant tracking data and give specific, actionable recommendations. Focus on watering, sunlight, fertilization, and overall plant health. Be concise but helpful."
        },
        {
          role: "user",
          content: `Based on this plant tracking data, provide personalized care recommendations:\n\n${plantDataSummary}\n\nPlease provide:\n1. Current assessment of the plant's health\n2. Specific recommendations for watering, sunlight, and fertilization\n3. Any concerns or improvements needed\n4. Tips for better plant care`
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(requestData),
      },
    };

    const groqResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode !== 200) {
              reject(new Error(`API error (${response.statusCode}): ${parsed.error?.message || JSON.stringify(parsed)}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(requestData);
      req.end();
    });

    if (groqResponse.choices && groqResponse.choices[0] && groqResponse.choices[0].message) {
      const aiResponse = groqResponse.choices[0].message.content.trim();
      res.status(200).json({
        success: true,
        recommendations: aiResponse,
        plantData: plantDataSummary
      });
    } else {
      throw new Error("Invalid response format from Groq API");
    }
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get recommendations",
      response: `I apologize, but I'm having trouble getting recommendations. ${error.message}`
    });
  }
});

module.exports = plantRouter;


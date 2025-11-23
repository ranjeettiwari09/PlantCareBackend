const express = require("express");
const aiChatRouter = express.Router();
const https = require("https");
require("dotenv").config();

// Test endpoint to check API key configuration
aiChatRouter.get("/test", (req, res) => {
  const hasApiKey = !!process.env.GROQ_API_KEY;
  res.json({
    hasApiKey,
    apiKeyLength: hasApiKey ? process.env.GROQ_API_KEY.length : 0,
    message: hasApiKey ? "API key is configured" : "API key is NOT configured. Please add GROQ_API_KEY to your .env file."
  });
});

// AI Chat endpoint
aiChatRouter.post("/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    console.log("Received chat request:", { message: message?.substring(0, 50) });

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Message is required",
        response: "Please provide a question about plant care."
      });
    }

    // Check if Groq API key is available
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY not found in environment variables");
      return res.status(500).json({
        success: false,
        error: "API key not configured",
        response: "Please configure GROQ_API_KEY in your environment variables."
      });
    }

    // Use Groq API
    try {
      const requestData = JSON.stringify({  
        model: "llama-3.3-70b-versatile", // Current supported model. Alternatives: "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"
        messages: [
          {
            role: "system",
            content: "You are a helpful plant care expert. Provide clear, practical advice about plant care, watering, fertilizing, pest control, and general plant maintenance. Keep responses concise, actionable, and friendly. Focus on helping users with their specific plant care questions."
          },
          {
            role: "user",
            content: message.trim()
          }
        ],
        max_tokens: 500,
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

      console.log("Making request to Groq API...");

      const groqResponse = await new Promise((resolve, reject) => {
        const req = https.request(options, (response) => {
          let data = "";
          
          response.on("data", (chunk) => {
            data += chunk;
          });
          
          response.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              console.log("Groq API response status:", response.statusCode);
              
              if (response.statusCode !== 200) {
                console.error("Groq API error response:", parsed);
                reject(new Error(`API error (${response.statusCode}): ${parsed.error?.message || JSON.stringify(parsed)}`));
              } else {
                resolve(parsed);
              }
            } catch (e) {
              console.error("Error parsing Groq response:", e);
              console.error("Raw response:", data);
              reject(new Error(`Failed to parse response: ${e.message}`));
            }
          });
        });

        req.on("error", (error) => {
          console.error("Request error:", error);
          reject(new Error(`Network error: ${error.message}`));
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error("Request timeout"));
        });

        req.write(requestData);
        req.end();
      });

      console.log("Groq API response received");

      if (groqResponse.choices && groqResponse.choices[0] && groqResponse.choices[0].message) {
        const aiResponse = groqResponse.choices[0].message.content.trim();
        console.log("Successfully got AI response");
        
        return res.status(200).json({
          success: true,
          response: aiResponse,
          source: "groq"
        });
      } else {
        console.error("Invalid response format:", groqResponse);
        throw new Error("Invalid response format from Groq API");
      }
    } catch (groqError) {
      console.error("Groq API error details:", {
        message: groqError.message,
        stack: groqError.stack
      });
      
      return res.status(500).json({
        success: false,
        error: "Failed to get response from AI",
        response: `I apologize, but I'm having trouble connecting to the AI service. ${groqError.message}. Please check your API key and try again.`
      });
    }

  } catch (error) {
    console.error("Unexpected error in AI chat:", {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to process chat request",
      response: "I apologize, but I'm having technical difficulties. Please try again in a moment."
    });
  }
});

module.exports = aiChatRouter;


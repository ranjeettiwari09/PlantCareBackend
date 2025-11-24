const mongoose = require("mongoose");

const plantSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true
  },
  plantName: {
    type: String,
    required: true
  },
  plantType: {
    type: String,
    required: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  image: {
    type: String,
    default: ""
  },
  notes: {
    type: String,
    default: ""
  },
  // Daily tracking entries
  dailyEntries: [{
    date: {
      type: Date,
      default: Date.now
    },
    watered: {
      type: Boolean,
      default: false
    },
    fertilized: {
      type: Boolean,
      default: false
    },
    sunlightHours: {
      type: Number,
      default: 0
    },
    temperature: {
      type: Number,
      default: null
    },
    humidity: {
      type: Number,
      default: null
    },
    notes: {
      type: String,
      default: ""
    },
    healthStatus: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good"
    },
    growthNotes: {
      type: String,
      default: ""
    }
  }],
  // Plant care schedule
  careSchedule: {
    wateringFrequency: {
      type: Number, // days between watering
      default: 3
    },
    fertilizingFrequency: {
      type: Number, // days between fertilizing
      default: 14
    },
    lastWatered: {
      type: Date,
      default: null
    },
    lastFertilized: {
      type: Date,
      default: null
    }
  }
});

module.exports = mongoose.model("plant", plantSchema);


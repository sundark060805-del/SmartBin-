const mongoose = require("mongoose");

const wasteScanSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  customerName: {
    type: String,
    default: "Guest"
  },
  disposalAdvice: {
    type: String,
    default: ""
  },
  scannedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("WasteScan", wasteScanSchema);

const mongoose = require("mongoose");

const binSchema = new mongoose.Schema(
  {
    binId: {
      type: String,
      required: true,
      unique: true
    },
    location: {
      type: String,
      required: true
    },
    fillLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      default: "Normal"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bin", binSchema);

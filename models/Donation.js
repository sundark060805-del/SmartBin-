const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    bin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bin",
      default: null,
    },
    wasteType: {
      type: String,
      enum: [
        "Plastic",
        "Paper",
        "Glass",
        "Metal",
        "Food",
        "Electronic",
        "Mixed",
        "Other",
      ],
      default: "Other",
    },
    weightKg: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
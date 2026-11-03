
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    mobile: {
      type: String,
      default:undefined
      
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    customerId: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },
    totalWaste: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Customer", customerSchema);

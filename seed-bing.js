require("dotenv").config();
const mongoose = require("mongoose");
const Bin = require("./models/Bin");

async function seedBins() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("Set MONGODB_URI or MONGO_URI in your .env file.");
  }

  await mongoose.connect(uri);

  const sampleBins = [
    { binId: "BIN-001", location: "Main Entrance", fillLevel: 35 },
    { binId: "BIN-002", location: "College Canteen", fillLevel: 82 },
    { binId: "BIN-003", location: "Library", fillLevel: 55 },
  ];

  for (const item of sampleBins) {
    item.status =
      item.fillLevel >= 100
        ? "Full"
        : item.fillLevel >= 80
          ? "Nearly Full"
          : "Normal";

    await Bin.updateOne(
      { binId: item.binId },
      { $set: item },
      { upsert: true }
    );
  }

  console.log("Sample bins added or updated.");
}

seedBins()
  .catch((error) => console.error("Seeding failed:", error.message))
  .finally(() => mongoose.disconnect());
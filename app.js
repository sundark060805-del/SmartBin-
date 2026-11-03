
require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const session = require("express-session");

const Bin = require("./models/Bin");
const Customer = require("./models/Customer");
const Donation = require("./models/Donation");
const customerRoutes = require("./routes/customerRoutes");

const app = express();
const PORT = process.env.PORT || 8000;
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    name: "connect.sid",
    secret:
      process.env.SESSION_SECRET ||
      "smartbin-local-development-secret-change-before-deploy",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000
    }
  })
);

function requireCustomer(req, res, next) {
  if (!req.session || !req.session.customerId) {
    return res.redirect("/");
  }

  next();
}

app.use("/", customerRoutes);

function getBinStatus(fillLevel) {
  if (fillLevel >= 100) return "Full";
  if (fillLevel >= 80) return "Nearly Full";
  return "Normal";
}


app.get("/bins/add", requireCustomer, (req, res) => {
  res.render("add-bin");
});


app.post("/bins/add", requireCustomer, async (req, res, next) => {
  try {
    const binId = String(req.body.binId || "").trim();
    const location = String(req.body.location || "").trim();
    const fillLevel = Number(req.body.fillLevel ?? 0);

    if (!binId || !location) {
      return res.status(400).send(
        "Bin ID and location are required."
      );
    }

    if (
      !Number.isFinite(fillLevel) ||
      fillLevel < 0 ||
      fillLevel > 100
    ) {
      return res.status(400).send(
        "Fill level must be between 0 and 100."
      );
    }

    const existingBin = await Bin.findOne({ binId });

    if (existingBin) {
      return res.status(409).send(
        "This Bin ID already exists."
      );
    }

    await Bin.create({
      binId,
      location,
      fillLevel,
      status: getBinStatus(fillLevel)
    });

    res.redirect("/dashboard");
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send(
        "This Bin ID already exists."
      );
    }

    next(error);
  }
});

app.get("/dashboard", requireCustomer, async (req, res, next) => {
  try {
    const bins = await Bin.find()
      .sort({ binId: 1 })
      .lean();

    const customers = await Customer.find()
      .select("-password")
      .lean();

    const allDonations = await Donation.find().lean();

    const recentDonations = await Donation.find()
      .populate("customer")
      .populate("bin")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalWaste = allDonations.reduce(
      (sum, donation) =>
        sum + (Number(donation.weightKg) || 0),
      0
    );

    res.render("dashboard", {
      bins,
      totalBins: bins.length,

      nearlyFullBins: bins.filter(
        bin => Number(bin.fillLevel) >= 80
      ).length,

      totalWaste: totalWaste.toFixed(2),
      totalCustomers: customers.length,
      totalDonations: allDonations.length,
      recentDonations
    });
  } catch (error) {
    next(error);
  }
});


app.get("/customer", requireCustomer, async (req, res, next) => {
  try {
    const customers = await Customer.find()
      .select("-password")
      .sort({ name: 1 })
      .lean();

    const bins = await Bin.find()
      .sort({ binId: 1 })
      .lean();

    res.render("customer", {
      customers,
      bins,
      message: null
    });
  } catch (error) {
    next(error);
  }
});


app.post("/customer", requireCustomer, async (req, res, next) => {
  try {
    const customerId = String(
      req.body.customerId || ""
    ).trim();

    if (!customerId) {
      return res.status(400).send(
        "Select a registered customer."
      );
    }

    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).send(
        "Customer not found."
      );
    }

    res.redirect("/customer");
  } catch (error) {
    next(error);
  }
});


app.post("/donations", requireCustomer, async (req, res, next) => {
  try {
    const customerObjectId = String(
      req.body.customerId || ""
    ).trim();

    const binObjectId = String(
      req.body.binId || ""
    ).trim();

    const wasteType = String(
      req.body.wasteType || ""
    ).trim();

    const weightKg = Number(req.body.weightKg);

    const allowedWasteTypes = [
      "Plastic",
      "Paper",
      "Glass",
      "Metal",
      "Food",
      "Electronic",
      "Mixed",
      "Other"
    ];

    if (!mongoose.isValidObjectId(customerObjectId)) {
      return res.status(400).send(
        "Please select a valid customer."
      );
    }

    if (
      !Number.isFinite(weightKg) ||
      weightKg <= 0 ||
      weightKg > 10000
    ) {
      return res.status(400).send(
        "Enter a valid waste weight."
      );
    }

    if (!allowedWasteTypes.includes(wasteType)) {
      return res.status(400).send(
        "Invalid waste type."
      );
    }

    const customer = await Customer.findById(
      customerObjectId
    );

    if (!customer) {
      return res.status(404).send(
        "Customer not found."
      );
    }

    let bin = null;

    // Bin selection is optional.
    if (binObjectId) {
      if (!mongoose.isValidObjectId(binObjectId)) {
        return res.status(400).send(
          "Invalid bin selected."
        );
      }

      bin = await Bin.findById(binObjectId);

      if (!bin) {
        return res.status(404).send(
          "Bin not found."
        );
      }
    }

    // Save donation
    await Donation.create({
      customer: customer._id,
      bin: bin ? bin._id : undefined,
      wasteType,
      weightKg
    });

  
    customer.totalWaste =
      (Number(customer.totalWaste) || 0) + weightKg;

    await customer.save();

    if (bin && Number(bin.capacityKg) > 0) {
      bin.fillLevel = Math.min(
        100,
        (Number(bin.fillLevel) || 0) +
          (weightKg / Number(bin.capacityKg)) * 100
      );

      bin.status = getBinStatus(bin.fillLevel);

      await bin.save();
    }

    res.redirect("/dashboard");
  } catch (error) {
    next(error);
  }
});


app.get("/ai-scanner", requireCustomer, (req, res) => {
  res.render("ai-scanner");
});


const upload = multer({
  dest: os.tmpdir(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },

  fileFilter(req, file, cb) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Please upload a JPG, PNG, or WEBP image."
      )
    );
  }
});


let pipelinePromise;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = import("@huggingface/transformers")
      .then(module => module.pipeline)
      .catch(error => {
        pipelinePromise = null;
        throw error;
      });
  }

  return pipelinePromise;
}


class WasteClassifier {
  constructor() {
    this.classifier = null;
  }

  async loadModel() {
    if (!this.classifier) {
      const pipeline = await getPipeline();

      console.log(
        "Loading AI waste classification model..."
      );

      this.classifier = await pipeline(
        "zero-shot-image-classification",
        "Xenova/clip-vit-base-patch32"
      );

      console.log("AI model loaded successfully.");
    }

    return this.classifier;
  }

  async classify(imagePath) {
    const classifier = await this.loadModel();

    const labels = [
      "a plastic water bottle",
      "a glass bottle",
      "a metal can",
      "cardboard",
      "paper or newspaper",
      "a plastic bag or wrapper",
      "leftover food waste",
      "electronic waste",
      "mixed household garbage"
    ];

    const predictions = await classifier(
      imagePath,
      labels
    );

    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => ({
        label: item.label,
        score: item.score,
        confidence: (
          item.score * 100
        ).toFixed(1)
      }));
  }
}

const wasteClassifier = new WasteClassifier();


app.post("/ai-scan", requireCustomer, (req, res, next) => {
  upload.single("image")(req, res, async error => {
    if (error) {
      return res.status(400).send(error.message);
    }

    if (!req.file) {
      return res.status(400).send(
        "Please select an image."
      );
    }

    const imagePath = req.file.path;

    try {
      const predictions = await wasteClassifier.classify(
        imagePath
      );

      if (!predictions.length) {
        return res.status(500).send(
          "The AI model returned no predictions."
        );
      }

      res.render("ai-result", {
        predictions,
        results: predictions
      });
    } catch (error) {
      console.error("AI scan error:", error);

      if (!res.headersSent) {
        res.status(500).send(
          "AI scanning failed. Check the VS Code terminal."
        );
      }
    } finally {
      await fs.unlink(imagePath).catch(() => {});
    }
  });
});


app.use((req, res) => {
  res.status(404).send(
    "Page not found: " + req.originalUrl
  );
});

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).send(
    "Server error: " + error.message
  );
});

async function startServer() {
  if (!mongoURI) {
    console.error(
      "MONGODB_URI or MONGO_URI is missing from .env"
    );

    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log(
      "MongoDB connected successfully!"
    );

    app.listen(PORT, () => {
      console.log(
        `SmartBin running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();

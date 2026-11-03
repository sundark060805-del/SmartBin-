const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Customer = require("../models/Customer");

const router = express.Router();

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function showAuth(res, formType, error, status = 200) {
  return res.status(status).render("auth", {
    formType,
    error,
    success: null
  });
}

function requireCustomer(req, res, next) {
  if (!req.session || !req.session.customerId) {
    return res.redirect("/");
  }
  next();
}

// Homepage
router.get("/", (req, res) => {
  if (req.session && req.session.customerId) {
    return res.redirect("/dashboard");
  }

  res.render("auth", {
    formType: null,
    error: null,
    success: null
  });
});

// Check login status for homepage buttons
router.get("/customer/auth-status", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session && req.session.customerId)
  });
});

// Signup
router.post("/customer/register", async (req, res, next) => {
  try {
    const name = clean(req.body.name);
    const username = clean(req.body.username).toLowerCase();
    // const mobile = clean(req.body.mobile);
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string"
      ? req.body.password
      : "";

    if (!name || !username ||  !email || !password) {
      return showAuth(res, "signup", "Please fill in all fields.", 400);
    }

    if (password.length < 8) {
      return showAuth(res, "signup", "Password must be at least 8 characters.", 400);
    }

    const existing = await Customer.findOne({
      $or: [{ username }, { email }, ]
    });

    if (existing) {
      return showAuth(
        res,
        "signup",
        "An account with this username or email already exists. Please log in.",
        409
      );
    }

    const customerId = "CUST-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    await Customer.create({
      name,
      username,
      email,
      password: hashedPassword,
      customerId,
      totalWaste: 0
    });

    return res.render("auth", {
      formType: "login",
      error: null,
      success: `Registration successful! Your Customer ID is ${customerId}. Please log in.`
    });
  } catch (error) {
    if (error.code === 11000) {
      return showAuth(res, "signup", "This account is already registered. Please log in.", 409);
    }
    next(error);
  }
});

// Login
router.post("/customer/login", async (req, res, next) => {
  try {
    const username = clean(req.body.username).toLowerCase();
    const password = typeof req.body.password === "string"
      ? req.body.password
      : "";

    if (!username || !password) {
      return showAuth(res, "login", "Enter your username and password.", 400);
    }

    const customer = await Customer.findOne({ username });

    if (!customer || !customer.password) {
      return showAuth(res, "login", "Invalid username or password.", 401);
    }

    const matches = await bcrypt.compare(password, customer.password);

    if (!matches) {
      return showAuth(res, "login", "Invalid username or password.", 401);
    }

    req.session.regenerate(error => {
      if (error) return next(error);

      req.session.customerId = customer._id.toString();

      req.session.save(error => {
        if (error) return next(error);
        res.redirect("/dashboard");
      });
    });
  } catch (error) {
    next(error);
  }
});

// Legacy customer-home URL: redirect to the main dashboard
router.get("/customer/home", requireCustomer, (req, res) => {
  res.redirect("/dashboard");
});

// Logout
router.post("/customer/logout", (req, res, next) => {
  if (!req.session) return res.redirect("/");

  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

module.exports = router;
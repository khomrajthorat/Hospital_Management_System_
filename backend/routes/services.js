// backend/routes/services.js
const express = require("express");
const router = express.Router();
const Service = require("../models/Service"); 
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- 1. CONFIGURATION FOR IMAGE UPLOAD ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `service-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// --- 2. ROUTES ---

// GET /services (Updated for Granular Filtering)
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = "createdAt", 
      order = "desc", 
      q = "", 
      // Extract specific filters
      serviceId, name, clinicName, doctor, charges, duration, category, status
    } = req.query;

    const filter = {};

    // 1. Global Search (if user uses the top search bar)
    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { doctor: new RegExp(q, "i") },
        { clinicName: new RegExp(q, "i") },
        { category: new RegExp(q, "i") },
      ];
    }

    // 2. Specific Column Filters (AND logic)
    if (serviceId) filter.serviceId = new RegExp(serviceId, "i");
    if (name) filter.name = new RegExp(name, "i");
    if (clinicName) filter.clinicName = new RegExp(clinicName, "i");
    if (doctor) filter.doctor = new RegExp(doctor, "i");
    if (charges) filter.charges = new RegExp(charges, "i");
    if (duration) filter.duration = new RegExp(duration, "i");
    if (category && category !== "Filter Name") filter.category = new RegExp(category, "i"); // Dropdown handling
    
    // Status Filter
    if (status && status !== "Filter status") {
      if (status.toLowerCase() === "active") filter.active = true;
      if (status.toLowerCase() === "inactive") filter.active = false;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rows, total] = await Promise.all([
      Service.find(filter).sort({ [sort]: order === "asc" ? 1 : -1 }).skip(skip).limit(Number(limit)),
      Service.countDocuments(filter),
    ]);
    res.json({ rows, total });
  } catch (err) {
    console.error("GET /services error:", err);
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

// POST /services (Create)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      active: req.body.active === "true", 
      isTelemed: req.body.isTelemed === "true",
      allowMulti: req.body.allowMulti === "true",
    };

    if (req.file) {
      const protocol = req.protocol;
      const host = req.get("host");
      payload.imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }

    const created = await Service.create(payload);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: "Database Save Failed", error: err.message });
  }
});

// PUT /services/:id (Update)
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.active !== undefined) payload.active = payload.active === "true";
    if (payload.isTelemed !== undefined) payload.isTelemed = payload.isTelemed === "true";
    if (payload.allowMulti !== undefined) payload.allowMulti = payload.allowMulti === "true";

    if (req.file) {
      const protocol = req.protocol;
      const host = req.get("host");
      payload.imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }

    const updated = await Service.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Service not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update service" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
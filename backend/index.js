

// 1. Import required libraries
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const PatientModel = require("./models/Patient");
const DoctorModel = require("./models/Doctor");
const BillingModel = require("./models/Billing");
const AppointmentModel = require("./models/Appointment");
const Service = require("./models/Service");

const ADMIN_EMAIL = "admin@onecare.com";
const ADMIN_PASSWORD = "admin123";

// PDF Libraries
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");


// 2. Create an Express app
const app = express();

// 3. Middlewares
app.use(cors());
app.use(express.json());

// connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/hospital_auth")
  .then(() => {
    console.log("✅ Connected to MongoDB (hospital_auth)");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

/* ===============================
 *             LOGIN
 * =============================== */

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // admin login
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      return res.json({
        id: "admin-id",
        name: "System Admin",
        email: ADMIN_EMAIL,
        role: "admin",
        profileCompleted: true, // admin doesn't need profile setup
      });
    }

    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      profileCompleted: user.profileCompleted,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

/* ===============================
 *             SIGNUP
 * =============================== */

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = await User.create({
      email,
      password,
      role: "patient",
      name,
      profileCompleted: false,
    });

    // also create empty patient record
    await PatientModel.create({
      userId: newUser._id,
      firstName: name,
      email,
    });


    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
      profileCompleted: newUser.profileCompleted,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
});

/* ===============================
 *         PATIENT APIs
 * =============================== */

// Add Patient
app.post("/patients", async (req, res) => {
  try {
    const patient = await PatientModel.create(req.body);
    res.json({ message: "Patient added", data: patient });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get Patients
app.get("/patients", (req, res) => {
  PatientModel.find()
    .then((patients) => res.json(patients))
    .catch((err) => res.status(500).json(err));
});

// Delete Patient
app.delete("/patients/:id", async (req, res) => {
  try {
    await PatientModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ===============================
//     DASHBOARD STATISTICS
// ===============================
app.get("/dashboard-stats", async (req, res) => {
  try {
    // 1) Make a string for today's date in format "YYYY-MM-DD"
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // 01-12
    const dd = String(today.getDate()).padStart(2, "0");      // 01-31
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 2) Count in MongoDB
    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      todayAppointments,
    ] = await Promise.all([
      PatientModel.countDocuments(),                 // all patients
      DoctorModel.countDocuments(),                 // all doctors
      AppointmentModel.countDocuments(),            // all appointments
      AppointmentModel.countDocuments({ date: todayStr }), // only today's
    ]);

    // 3) Send all numbers to frontend
    res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      todayAppointments,
    });
  } catch (err) {
    console.error("dashboard-stats error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ===============================
 *         DOCTOR APIs
 * =============================== */

// Add Doctor
app.post("/doctors", async (req, res) => {
  try {
    console.log(" Incoming doctor data:", req.body);
    const doctor = await DoctorModel.create(req.body);
    res.json({ message: "Doctor added", data: doctor });
  } catch (err) {
    console.error(" Error saving doctor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all doctors
app.get("/doctors", async (req, res) => {
  try {
    const doctors = await DoctorModel.find();
    res.json(doctors);
  } catch (err) {
    console.error(" Error fetching doctors:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete doctor
app.delete("/doctors/:id", async (req, res) => {
  try {
    await DoctorModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Doctor deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting doctor", error: err.message });
  }
});

/* ===============================
 *          APPOINTMENTS
 * =============================== */

// Create appointment
app.post("/appointments", async (req, res) => {
  try {
    const doc = await AppointmentModel.create(req.body);
    res.json({ message: "Appointment created", data: doc });
  } catch (err) {
    console.error("Error creating appointment:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// List appointments with optional filters (query params)
// Supports:
//   ?date=YYYY-MM-DD
//   ?clinic=<string>
//   ?patient=<string>      (matches patientName)
//   ?doctor=<string>       (matches doctorName)
//   ?status=<string>
//   ?patientId=<id>        (if you store patientId on Appointment)
//   ?doctorId=<id>         (if you store doctorId on Appointment)
app.get("/appointments", async (req, res) => {
  try {
    const q = {};

    if (req.query.date) q.date = req.query.date;
    if (req.query.clinic)
      q.clinic = { $regex: req.query.clinic, $options: "i" };
    if (req.query.patient)
      q.patientName = { $regex: req.query.patient, $options: "i" };
    if (req.query.doctor)
      q.doctorName = { $regex: req.query.doctor, $options: "i" };
    if (req.query.status) q.status = req.query.status;

    // extra filters by ids (safe even if you don't use them yet)
    if (req.query.patientId) q.patientId = req.query.patientId;
    if (req.query.doctorId) q.doctorId = req.query.doctorId;

    const list = await AppointmentModel.find(q)
      .sort({ createdAt: -1 })
      .limit(500);

    res.json(list);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// 🔹 Get single appointment by id  (used by DoctorAppointmentDetails)
app.get("/appointments/:id", async (req, res) => {
  try {
    const appt = await AppointmentModel.findById(req.params.id);

    if (!appt) {
      console.warn("GET /appointments/:id → not found:", req.params.id);
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json(appt);
  } catch (err) {
    console.error("Error fetching appointment:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Cancel appointment (status: cancelled)
app.put("/appointments/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const appt = await AppointmentModel.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true }
    );

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ message: "Appointment cancelled", data: appt });
  } catch (err) {
    console.error("Cancel error", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete appointment
app.delete("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await AppointmentModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ message: "Appointment deleted successfully" });
  } catch (err) {
    console.error("Error deleting appointment:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



/* ===============================
 *         SERVICE APIs
 * =============================== */

// GET all services
app.get("/api/services", async (req, res) => {
  try {
    const all = await Service.find();
    console.log("GET /api/services ->", all.length, "items");
    res.json(all);
  } catch (err) {
    console.error("GET /api/services error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADD service
app.post("/api/services", async (req, res) => {
  try {
    console.log("POST /api/services body:", req.body);
    const data = new Service(req.body);
    const saved = await data.save();
    console.log("Saved service:", saved);
    res.json(saved);
  } catch (err) {
    console.error("Error saving service:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE service
app.delete("/api/services/:id", async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// TOGGLE active status
app.put("/api/services/toggle/:id", async (req, res) => {
  const service = await Service.findById(req.params.id);
  service.active = !service.active;
  await service.save();
  res.json(service);
});

// UPDATE service
app.put("/api/services/:id", async (req, res) => {
  try {
    const updated = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(updated);
  } catch (err) {
    console.error("Update service error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ===============================
 *         BILL APIs
 * =============================== */

app.post("/bills", async (req, res) => {
  try {
    const bill = await BillingModel.create(req.body);
    res.json({ message: "Bill created successfully", data: bill });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

app.get("/bills", async (req, res) => {
  try {
    const bills = await BillingModel.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching bills", error: err.message });
  }
});

app.get("/bills/:id", async (req, res) => {
  try {
    const bill = await BillingModel.findById(req.params.id);
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: "Error fetching bill" });
  }
});

app.put("/bills/:id", async (req, res) => {
  try {
    const updated = await BillingModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ message: "Bill updated", data: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating bill" });
  }
});

app.delete("/bills/:id", async (req, res) => {
  try {
    await BillingModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Bill deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting bill" });
  }
});

// CREATE or UPDATE a patient profile for a given userId
app.put("/patients/by-user/:userId", async (req, res) => {
  try {
    let { userId } = req.params;
    const updateData = req.body;

    // convert string to Mongo ObjectId (matches your Patient schema)
    try {
      userId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      console.error("Invalid userId:", err);
      return res.status(400).json({ message: "Invalid userId" });
    }

    const patient = await PatientModel.findOneAndUpdate(
      { userId },                          // find by userId (ObjectId)
      { $set: { ...updateData, userId } }, // update fields + ensure userId set
      { new: true, upsert: true }          // create if not found
    );

    console.log("✅ Patient document upserted:", patient);
    return res.json(patient);
  } catch (err) {
    console.error("Error updating/creating patient:", err);
    return res
      .status(500)
      .json({ message: "Failed to update patient profile" });
  }
});

// MARK user.profileCompleted = true
app.put("/users/:id/profile-completed", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { profileCompleted: true } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User profileCompleted updated:", user._id);
    return res.json(user);
  } catch (err) {
    console.error("Error updating profileCompleted:", err);
    return res
      .status(500)
      .json({ message: "Failed to update profile status" });
  }
});


/* ===============================
 *         START SERVER
 * =============================== */

const PORT = 3001;
app.listen(PORT, () => {
  console.log("Backend server running on http://localhost:" + PORT);
});

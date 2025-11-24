const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const DoctorModel = require("../models/Doctor");
const DoctorSessionModel = require("../models/DoctorSession");
const { sendEmail } = require("../utils/emailService");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// Configure Multer for CSV import
const upload = multer({ dest: path.join(__dirname, "../uploads") });

/* ===============================
 *         DOCTOR APIs
 * =============================== */

// Create Doctor (with auto-generated password)
router.post("/", async (req, res) => {
  try {
    console.log("Incoming doctor data:", req.body);

    const { email, firstName, lastName } = req.body;

    // Check if email already exists
    const existing = await DoctorModel.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Generate random password
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const doctorData = {
      ...req.body,
      password: hashedPassword,
      passwordPlain: randomPassword, // Optional: for debugging/resend if needed
      mustChangePassword: true,
    };

    const doctor = await DoctorModel.create(doctorData);

    // Send email
    const fullName = `${firstName} ${lastName}`;
    const html = `
      <h3>Welcome Dr. ${fullName},</h3>
      <p>Your account has been created at OneCare.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${randomPassword}</p>
      <p>Please login and change your password immediately.</p>
    `;

    sendEmail({
      to: email,
      subject: "Your Doctor Account Credentials | OneCare",
      html,
    });

    res.json({ message: "Doctor added and credentials sent", data: doctor });
  } catch (err) {
    console.error("Error saving doctor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all doctors
router.get("/", async (req, res) => {
  try {
    const doctors = await DoctorModel.find();
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete doctor
router.delete("/:id", async (req, res) => {
  try {
    await DoctorModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Doctor deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting doctor", error: err.message });
  }
});

// Resend Credentials (Regenerate password and email)
router.post("/:id/resend-credentials", async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await DoctorModel.findById(id);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Generate new random password
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    doctor.password = hashedPassword;
    doctor.passwordPlain = randomPassword;
    doctor.mustChangePassword = true;
    await doctor.save();

    // Send email
    const fullName = `${doctor.firstName} ${doctor.lastName}`;
    const html = `
      <h3>Hello Dr. ${fullName},</h3>
      <p>Your account credentials have been reset by the admin.</p>
      <p><strong>Email:</strong> ${doctor.email}</p>
      <p><strong>New Temporary Password:</strong> ${randomPassword}</p>
      <p>Please login and change your password immediately.</p>
    `;

    sendEmail({
      to: doctor.email,
      subject: "Your New Doctor Account Credentials | OneCare",
      html,
    });

    res.json({ message: "Credentials resent successfully" });
  } catch (err) {
    console.error("Error resending credentials:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Doctor Csv Import
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    console.log("📥 /doctors/import hit");

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        // CSV headers:
        // firstName,lastName,clinic,email,phone,dob,specialization,gender,status
        results.push({
          firstName: row.firstName,
          lastName: row.lastName,
          clinic: row.clinic,
          email: row.email,
          phone: row.phone,
          dob: row.dob, // string is fine, your schema will cast to Date if needed
          specialization: row.specialization,
          gender: row.gender,
          status: row.status || "Active",
        });
      })
      .on("end", async () => {
        try {
          console.log("Parsed doctors from CSV:", results.length);
          if (results.length > 0) {
            await DoctorModel.insertMany(results);
          }

          // delete temp file
          fs.unlinkSync(req.file.path);

          res.json({
            message: "Imported doctors",
            count: results.length,
          });
        } catch (err) {
          console.error("❌ Doctor import save error:", err);
          res.status(500).json({
            message: "Error saving doctors",
            error: err.message,
          });
        }
      })
      .on("error", (err) => {
        console.error("❌ CSV parse error (doctors):", err);
        res.status(500).json({ message: "CSV parse error" });
      });
  } catch (err) {
    console.error("❌ Doctor import error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;

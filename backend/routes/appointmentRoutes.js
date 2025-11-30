const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const mongoose = require("mongoose");

const AppointmentModel = require("../models/Appointment");
const PatientModel = require("../models/Patient");
const DoctorModel = require("../models/Doctor");
const HolidayModel = require("../models/Holiday"); 
const { sendEmail } = require("../utils/emailService");
const { appointmentBookedTemplate } = require("../utils/emailTemplates");
const { sendWhatsAppMessage } = require("../utils/whatsappService");
const upload = require("../middleware/upload");

// --- HELPER: Generate Time Slots ---
const generateTimeSlots = (startStr, endStr, intervalMins) => {
  const slots = [];
  let current = new Date(`2000-01-01T${startStr}`);
  const end = new Date(`2000-01-01T${endStr}`);

  while (current < end) {
    const timeString = current.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    slots.push(timeString);
    current.setMinutes(current.getMinutes() + intervalMins);
  }
  return slots;
};

// ==========================================
// 1. SPECIFIC ROUTES (MUST BE AT THE TOP)
// ==========================================

// GET /appointments/slots
router.get("/slots", async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ message: "Doctor ID and Date are required" });

    const requestDate = new Date(date); 
    const holiday = await HolidayModel.findOne({
      doctorId: doctorId,
      fromDate: { $lte: requestDate },
      toDate: { $gte: requestDate }
    });

    if (holiday) return res.json({ message: "Doctor is on holiday", slots: [], isHoliday: true });

    const allSlots = generateTimeSlots("09:00:00", "17:00:00", 30);
    const bookedAppointments = await AppointmentModel.find({
      doctorId: doctorId, date: date, status: { $ne: "cancelled" }
    }).select("time");

    const bookedTimes = bookedAppointments.map(a => a.time);
    const availableSlots = allSlots.filter(time => !bookedTimes.includes(time));

    res.json({ slots: availableSlots, isHoliday: false });
  } catch (err) {
    res.status(500).json({ message: "Server error checking slots" });
  }
});

// GET /appointments/today
router.get("/today", async (req, res) => {
  try {
    // 1. Calculate Start and End of Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Query for Date Range
    const query = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    const list = await AppointmentModel.find(query)
      .sort({ createdAt: -1 })
      .populate("patientId", "firstName lastName email phone")
      .populate("doctorId", "name clinic firstName lastName")
      .lean();

    const normalized = list.map(a => {
      const copy = { ...a };
      if (copy.doctorId && typeof copy.doctorId === "object") {
         copy.doctorName = copy.doctorName || copy.doctorId.name || "";
         copy.clinic = copy.clinic || copy.doctorId.clinic || "";
      }
      return copy;
    });

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /appointments/weekly
router.get("/weekly", async (req, res) => {
  try {
    const stats = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      
      // Create start and end for that specific day
      const startOfDay = new Date(d); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(d); endOfDay.setHours(23,59,59,999);

      const count = await AppointmentModel.countDocuments({ 
          date: { $gte: startOfDay, $lte: endOfDay } 
      });
      
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      stats.push({ label: dayName, count });
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /appointments/monthly
router.get("/monthly", async (req, res) => {
  try {
    const stats = [];
    const today = new Date();
    for (let i = 3; i >= 0; i--) {
        const start = new Date(today);
        start.setDate(today.getDate() - (i * 7) - 6);
        start.setHours(0,0,0,0); // Start of range

        const end = new Date(start);
        end.setDate(start.getDate() + 7); // End of range (7 days later)
        
        const count = await AppointmentModel.countDocuments({ 
            date: { $gte: start, $lt: end }
        });
        
        stats.push({ label: `Week ${4-i}`, count });
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /appointments/all
router.get("/all", async (req, res) => {
  try {
    const list = await AppointmentModel.find()
      .sort({ createdAt: -1 })
      .populate("patientId", "firstName lastName email phone")
      .populate("doctorId", "name clinic firstName lastName")
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /appointments/import
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push({
          date: row.date,
          clinic: row["Clinic name"],
          services: row.Service,
          doctorName: row["Doctor name"],
          patientName: row["Patient name"],
          status: row.Status || "booked",
        });
      })
      .on("end", async () => {
        await AppointmentModel.insertMany(results);
        fs.unlinkSync(req.file.path);
        res.json({ message: "Imported appointments", count: results.length });
      })
      .on("error", (err) => {
        res.status(500).json({ message: "CSV parse error" });
      });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ==========================================
// 2. GENERAL ROUTES (Search, List, Create)
// ==========================================

// LIST APPOINTMENTS (Search / Filter)
router.get("/", async (req, res) => {
  try {
    const q = {};
    if (req.query.date) q.date = req.query.date;
    if (req.query.clinic) q.clinic = { $regex: req.query.clinic, $options: "i" };
    if (req.query.patient) q.patientName = { $regex: req.query.patient, $options: "i" };
    if (req.query.doctor) q.doctorName = { $regex: req.query.doctor, $options: "i" };
    if (req.query.status) q.status = req.query.status;

    if (req.query.patientId && mongoose.Types.ObjectId.isValid(req.query.patientId)) {
        q.patientId = req.query.patientId;
    }
    if (req.query.doctorId && mongoose.Types.ObjectId.isValid(req.query.doctorId)) {
        q.doctorId = req.query.doctorId;
    }

    const list = await AppointmentModel.find(q)
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate("patientId", "firstName lastName email phone")
      .populate("doctorId", "name clinic firstName lastName")
      .lean();

    const normalized = list.map(a => {
      const copy = { ...a };
      if (copy.doctorId && typeof copy.doctorId === "object") {
         copy.doctorName = copy.doctorName || copy.doctorId.name || "";
         copy.clinic = copy.clinic || copy.doctorId.clinic || "";
      }
      return copy;
    });

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CREATE APPOINTMENT
router.post("/", async (req, res) => {
  try {
    // Holiday Check
    if (req.body.doctorId && req.body.date) {
        const apptDate = new Date(req.body.date);
        const onHoliday = await HolidayModel.findOne({
            doctorId: req.body.doctorId,
            fromDate: { $lte: apptDate },
            toDate: { $gte: apptDate }
        });
        if (onHoliday) return res.status(400).json({ message: `Doctor is on holiday.` });
    }

    const payload = {
      patientId: (req.body.patientId && req.body.patientId !== "") ? req.body.patientId : null,
      patientName: req.body.patientName || "Patient",
      patientEmail: req.body.patientEmail || "",
      patientPhone: req.body.patientPhone || "",
      doctorId: (req.body.doctorId && req.body.doctorId !== "") ? req.body.doctorId : null,
      doctorName: req.body.doctorName || "",
      clinic: req.body.clinic || "",
      date: req.body.date || "",
      time: req.body.time || "",
      services: req.body.services || req.body.servicesDetail || "",
      charges: req.body.charges || 0,
      paymentMode: req.body.paymentMode || "",
      status: req.body.status || "upcoming",
      createdAt: new Date(),
    };

    const created = await AppointmentModel.create(payload);

    // Notifications (Safe check)
    try {
        if (payload.patientEmail) {
            sendEmail({
                to: payload.patientEmail,
                subject: "Confirmed | OneCare",
                html: appointmentBookedTemplate(payload),
            });
        }
    } catch (e) { console.log("Email error:", e.message); }

    return res.status(201).json(created);
  } catch (err) {
    console.error("Create Appointment Error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ==========================================
// 3. DYNAMIC ID ROUTES (MUST BE AT THE BOTTOM)
// ==========================================

// PDF Generation
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({message: "Invalid ID"});

    const appt = await AppointmentModel.findById(id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    // --- Prepare Data ---
    let doctor = null;
    if (appt.doctorName) {
      const parts = appt.doctorName.split(" ");
      doctor = await DoctorModel.findOne({ firstName: parts[0] });
    }

    const clinicName = appt.clinic || doctor?.clinic || "OneCare Medical Center";
    const clinicEmail = doctor?.email || "support@onecare.com";
    const clinicPhone = doctor?.phone || "+91 12345 67890";
    
    const todayFormatted = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const apptDateFormatted = appt.date ? new Date(appt.date).toLocaleDateString("en-US", { weekday: 'short', year: "numeric", month: "long", day: "numeric" }) : "N/A";
    const apptId = String(appt._id).substring(0, 8).toUpperCase(); 

    // Calculate Services
    let serviceLines = [];
    const rawService = appt.services || appt.serviceName || "General Consultation";
    if (typeof rawService === 'string') {
        serviceLines = rawService.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(rawService)) {
        serviceLines = rawService;
    } else {
        serviceLines = ["General Consultation"];
    }

    const totalCharges = Number(appt.charges) || 0;
    const serviceCount = serviceLines.length || 1;
    const perItemCost = (totalCharges / serviceCount).toFixed(0); 
    const totalBillText = `Rs. ${totalCharges}/-`;

    // --- PDF Setup ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const primaryColor = rgb(0, 0.53, 0.71);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.92, 0.92, 0.92);

    let cursorY = height - 50;
    const margin = 50;

    // Header
    page.drawText(clinicName.toUpperCase(), { x: margin, y: cursorY, size: 18, font: fontBold, color: primaryColor });
    page.drawText(`Date: ${todayFormatted}`, { x: width - margin - 130, y: cursorY, size: 10, font: fontRegular, color: black });
    page.drawText(`Booking ID: #${apptId}`, { x: width - margin - 130, y: cursorY - 15, size: 10, font: fontBold, color: black });

    let detailsY = cursorY - 18;
    page.drawText(`Phone: ${clinicPhone}`, { x: margin, y: detailsY, size: 10, font: fontRegular, color: gray });
    detailsY -= 12;
    page.drawText(`Email: ${clinicEmail}`, { x: margin, y: detailsY, size: 10, font: fontRegular, color: gray });

    cursorY -= 80;
    page.drawRectangle({ x: 0, y: cursorY - 10 , width: width, height: 30, color: primaryColor });
    page.drawText("APPOINTMENT CONFIRMATION", { x: (width - 200) / 2, y: cursorY, size: 14, font: fontBold, color: rgb(1,1,1) });

    cursorY -= 50;
    const col2 = 320;
    page.drawText("PATIENT DETAILS", { x: margin, y: cursorY+15, size: 10, font: fontBold, color: gray });
    page.drawText(appt.patientName || "N/A", { x: margin, y: cursorY, size: 14, font: fontBold, color: black });

    page.drawText("DOCTOR DETAILS", { x: col2, y: cursorY+15, size: 10, font: fontBold, color: gray });
    page.drawText(`Dr. ${appt.doctorName || "Unknown"}`, { x: col2, y: cursorY, size: 14, font: fontBold, color: black });
    
    cursorY -= 40;
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 1, color: lightGray });
    cursorY -= 30;

    page.drawText("APPOINTMENT DETAILS", { x: margin, y: cursorY, size: 12, font: fontBold, color: primaryColor });
    cursorY -= 20;

    const drawDetailRow = (label, value, xPos, yPos) => {
       page.drawText(label, { x: xPos, y: yPos, size: 9, font: fontRegular, color: gray });
       page.drawText(value, { x: xPos, y: yPos - 12, size: 11, font: fontBold, color: black });
    };

    drawDetailRow("Date", apptDateFormatted, margin, cursorY);
    drawDetailRow("Time", appt.time || "N/A", margin + 180, cursorY);
    
    let statusColor = black;
    if((appt.status || "").toUpperCase() === 'BOOKED') statusColor = rgb(0, 0.6, 0);
    page.drawText("Status", { x: width - margin - 80, y: cursorY, size: 9, font: fontRegular, color: gray });
    page.drawText((appt.status || "Booked").toUpperCase(), { x: width - margin - 80, y: cursorY - 12, size: 11, font: fontBold, color: statusColor });

    cursorY -= 50;

    // Service Table
    page.drawRectangle({ x: margin, y: cursorY, width: width - (margin*2), height: 25, color: lightGray });
    page.drawText("Service / Description", { x: margin + 10, y: cursorY + 7, size: 10, font: fontBold, color: black });
    page.drawText("Amount", { x: width - margin - 70, y: cursorY + 7, size: 10, font: fontBold, color: black });

    cursorY -= 20; 

    serviceLines.forEach((service, index) => {
        const lineText = `${index + 1}. ${service}`;
        const amountText = `Rs. ${perItemCost}/-`;
        page.drawText(lineText, { x: margin + 10, y: cursorY, size: 10, font: fontRegular, color: black });
        page.drawText(amountText, { x: width - margin - 70, y: cursorY, size: 10, font: fontRegular, color: black });
        cursorY -= 20; 
    });

    cursorY += 5; 
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 1, color: lightGray });

    cursorY -= 30;
    page.drawText("Total Amount:", { x: width - margin - 150, y: cursorY, size: 12, font: fontBold, color: black });
    page.drawText(totalBillText, { x: width - margin - 70, y: cursorY, size: 12, font: fontBold, color: primaryColor });
    
    cursorY -= 15;
    page.drawText(`Payment Mode: ${appt.paymentMode || "Manual"}`, { x: width - margin - 150, y: cursorY, size: 9, font: fontRegular, color: gray });

    const footerY = 50;
    page.drawLine({ start: { x: margin, y: footerY + 15 }, end: { x: width - margin, y: footerY + 15 }, thickness: 1, color: lightGray });
    const generatedDate = new Date().toLocaleString("en-US");
    page.drawText(`Generated on: ${generatedDate}`, { x: margin, y: footerY, size: 8, font: fontRegular, color: gray });

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Appointment_${apptId}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "PDF generation failed" });
  }
});

// GET Single Appointment by ID (This captures IDs, so keep it low)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

    const appt = await AppointmentModel.findById(id)
      .populate("patientId", "firstName lastName email phone")
      .populate("doctorId", "name clinic firstName lastName")
      .lean();

    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Cancel appointment
router.put("/:id/cancel", async (req, res) => {
  try {
    const appt = await AppointmentModel.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );
    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment cancelled", data: appt });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE appointment
router.put("/:id", async (req, res) => {
  try {
    const updated = await AppointmentModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment updated", data: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete appointment
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await AppointmentModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BillingModel = require("../models/Billing");
const PatientModel = require("../models/Patient");
const DoctorModel = require("../models/Doctor");
const ClinicModel = require("../models/Clinic");
const Counter = require("../models/Counter");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { verifyToken } = require("../middleware/auth");

// Helper: Convert string ID to ObjectId if valid, otherwise null
const toObjectId = (id) => {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
};

// Helper: Format current time as "hh:mm AM/PM"
const formatTime = (date = new Date()) => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

// --- CREATE BILL (POST) ---
router.post("/", verifyToken, async (req, res) => {
  try {
    const clinicId = req.user.clinicId ? toObjectId(req.user.clinicId) : toObjectId(req.body.clinicId);
    
    let billPrefix = "INV-";
    if (clinicId) {
      const clinic = await ClinicModel.findById(clinicId).select("billPrefix").lean();
      if (clinic && clinic.billPrefix) {
        billPrefix = clinic.billPrefix;
      }
    }
    
    const generatedBillNumber = await Counter.getNextSequence("bill", billPrefix, clinicId, 6);

    let services = req.body.services || [];
    if (Array.isArray(services)) {
      services = services.map(svc => {
        if (typeof svc === 'string') {
          return { name: svc.trim(), description: "", category: "Consultation", amount: 0 };
        }
        return {
          name: svc.name || "",
          description: svc.description || "",
          category: svc.category || "Consultation",
          amount: svc.amount || 0
        };
      });
    }

    const subTotal = services.reduce((sum, svc) => sum + (Number(svc.amount) || 0), 0);
    const taxDetails = req.body.taxDetails || [];
    const taxAmount = taxDetails.reduce((sum, tax) => sum + (Number(tax.amount) || 0), 0);
    const discount = Number(req.body.discount) || 0;
    const totalAmount = subTotal - discount + taxAmount;
    const paidAmount = req.body.paidAmount !== undefined ? Number(req.body.paidAmount) : (req.body.status === "paid" ? totalAmount : 0);
    const amountDue = Math.max(totalAmount - paidAmount, 0);

    let status = req.body.status || "unpaid";
    if (paidAmount >= totalAmount && totalAmount > 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partial";
    }

    const payload = {
      ...req.body,
      services,
      billNumber: generatedBillNumber,
      patientId: toObjectId(req.body.patientId),
      doctorId: toObjectId(req.body.doctorId),
      clinicId: clinicId,
      encounterId: toObjectId(req.body.encounterId),
      date: req.body.date ? new Date(req.body.date) : new Date(),
      time: req.body.time || formatTime(),
      subTotal,
      totalAmount,
      discount,
      taxDetails,
      taxAmount,
      paidAmount,
      amountDue,
      status,
    };

    const bill = await BillingModel.create(payload);
    res.json({ message: "Bill created successfully", data: bill });
  } catch (err) {
    logger.error("Error creating bill", { error: err.message });
    res.status(500).json({ message: "Error creating bill", error: err.message });
  }
});

// --- GET ALL BILLS ---
router.get("/", verifyToken, async (req, res) => {
  try {
    const { doctorId, patientId, status } = req.query;
    let query = {};

    if (doctorId) query.doctorId = toObjectId(doctorId) || doctorId;
    if (patientId) query.patientId = toObjectId(patientId) || patientId;
    if (status) query.status = status;

    let currentUser = null;
    let safeClinicId = null;

    if (req.user.role === 'admin') {
      currentUser = await require("../models/Admin").findById(req.user.id);
    } else {
      currentUser = await require("../models/User").findById(req.user.id);
    }

    if (currentUser) {
      safeClinicId = currentUser.clinicId;
    } else {
      safeClinicId = req.user.clinicId || null;
    }

    const effectiveRole = currentUser ? currentUser.role : req.user.role;

    if (effectiveRole === "admin") {
       // All bills
    } else if (effectiveRole === "patient") {
      const patientRecord = await PatientModel.findOne({ userId: req.user.id });
      if (patientRecord) {
        query.patientId = patientRecord._id;
      } else {
        return res.json([]);
      }
    } else if (safeClinicId) {
      query.clinicId = safeClinicId;
    } else {
      return res.json([]);
    }

    const bills = await BillingModel.find(query)
      .sort({ createdAt: -1 })
      .populate({ path: "patientId", select: "firstName lastName email phone", model: "Patient" })
      .populate({ path: "doctorId", select: "firstName lastName email", model: "Doctor" })
      .populate({ path: "clinicId", select: "name address", model: "Clinic" })
      .lean();

    // Populate encounter IDs manually if needed (omitted for brevity as frontend handles string IDs well)
    
    // Normalize Data
    const normalized = bills.map(bill => {
      const copy = { ...bill };
      if (copy.patientId && typeof copy.patientId === "object") {
        copy.patientName = copy.patientName || `${copy.patientId.firstName || ""} ${copy.patientId.lastName || ""}`.trim();
      }
      if (copy.doctorId && typeof copy.doctorId === "object") {
         copy.doctorName = copy.doctorName || `${copy.doctorId.firstName || ""} ${copy.doctorId.lastName || ""}`.trim();
      }
      if (copy.clinicId && typeof copy.clinicId === "object") {
        copy.clinicName = copy.clinicName || copy.clinicId.name || "";
      }
      return copy;
    });

    res.json(normalized);
  } catch (err) {
    logger.error("Error fetching bills", { error: err.message });
    res.status(500).json({ message: "Error fetching bills", error: err.message });
  }
});

// --- GET SINGLE BILL ---
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const bill = await BillingModel.findById(req.params.id)
      .populate({ path: "patientId", select: "firstName lastName email phone", model: "Patient" })
      .populate({ path: "doctorId", select: "firstName lastName email", model: "Doctor" })
      .populate({ path: "clinicId", select: "name address", model: "Clinic" })
      .lean();

    if (!bill) return res.status(404).json({ message: "Bill not found" });

    // Normalize
    if (bill.patientId && typeof bill.patientId === "object") {
      bill.patientName = bill.patientName || `${bill.patientId.firstName || ""} ${bill.patientId.lastName || ""}`.trim();
    }
    if (bill.doctorId && typeof bill.doctorId === "object") {
      bill.doctorName = bill.doctorName || `${bill.doctorId.firstName || ""} ${bill.doctorId.lastName || ""}`.trim();
    }

    res.json(bill);
  } catch (err) {
    logger.error("Error fetching bill", { id: req.params.id, error: err.message });
    res.status(500).json({ message: "Error fetching bill" });
  }
});

// --- UPDATE BILL ---
router.put("/:id", verifyToken, async (req, res) => {
  try {
    let services = req.body.services;
    if (Array.isArray(services)) {
      services = services.map(svc => {
        if (typeof svc === 'string') return { name: svc.trim(), category: "Consultation", amount: 0 };
        return svc;
      });
    }

    const subTotal = services ? services.reduce((sum, svc) => sum + (Number(svc.amount) || 0), 0) : req.body.subTotal;
    const taxDetails = req.body.taxDetails;
    const taxAmount = taxDetails ? taxDetails.reduce((sum, tax) => sum + (Number(tax.amount) || 0), 0) : req.body.taxAmount;
    
    // Recalculate if totals not provided provided but services are
    let totalAmount = req.body.totalAmount;
    let amountDue = req.body.amountDue;
    
    // Simplistic update logic - usually we trust frontend for calc but for safety:
    // We update whatever is passed.

    const updateData = {
      ...req.body,
      services,
      patientId: toObjectId(req.body.patientId),
      doctorId: toObjectId(req.body.doctorId),
      clinicId: toObjectId(req.body.clinicId),
      encounterId: toObjectId(req.body.encounterId),
      date: req.body.date ? new Date(req.body.date) : undefined,
    };

    // Remove undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updated = await BillingModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Bill not found" });

    res.json({ message: "Bill updated", data: updated });
  } catch (err) {
    logger.error("Error updating bill", { id: req.params.id, error: err.message });
    res.status(500).json({ message: "Error updating bill" });
  }
});

// --- DELETE BILL ---
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await BillingModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Bill not found" });
    res.json({ message: "Bill deleted" });
  } catch (err) {
    logger.error("Error deleting bill", { id: req.params.id, error: err.message });
    res.status(500).json({ message: "Error deleting bill" });
  }
});

// --- PDF GENERATION ---
router.get("/:id/pdf", verifyToken, async (req, res) => {
  try {
    const bill = await BillingModel.findById(req.params.id)
      .populate({ path: "patientId", model: "Patient" }) // Get full patient for UHID/Address
      .populate({ path: "doctorId", model: "Doctor" })     // Get full doctor for Specialization
      .populate({ path: "clinicId", model: "Clinic" })     // Get full clinic for GSTIN/Terms
      .lean();

    if (!bill) return res.status(404).send("Bill not found");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;

    // --- 1. HEADER (Clinic Info & Logo) ---
    // Try to load logo
    try {
      const logoPath = path.join(__dirname, "..", "assets", "logo.png");
      if (fs.existsSync(logoPath)) {
         const logoBytes = fs.readFileSync(logoPath);
         const logoImg = await pdfDoc.embedPng(logoBytes);
         const logoSize = 60;
         page.drawImage(logoImg, { x: margin, y: y - logoSize, width: logoSize, height: logoSize });
      }
    } catch(e) {}

    // Clinic Details
    const clinicName = bill.clinicId?.name || bill.clinicName || "Clinic Name";
    const clinicAddress = bill.clinicId?.address?.full || bill.clinicId?.address?.city || "";
    const clinicContact = bill.clinicId?.contact || bill.clinicId?.email || "";
    const clinicGST = bill.clinicId?.gstin ? `GSTIN: ${bill.clinicId.gstin}` : "";

    page.drawText(clinicName, { x: margin + 80, y: y - 15, size: 20, font: fontBold });
    page.drawText(clinicAddress, { x: margin + 80, y: y - 30, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(clinicContact, { x: margin + 80, y: y - 42, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    if(clinicGST) {
       page.drawText(clinicGST, { x: margin + 80, y: y - 54, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    }

    // Bill Meta (Top Right)
    const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : new Date().toLocaleDateString();
    const timeStr = bill.time || "";
    
    page.drawText("TAX INVOICE", { x: width - margin - 80, y: y - 15, size: 12, font: fontBold, color: rgb(0,0,0) });
    page.drawText(`Bill #: ${bill.billNumber || bill._id.toString().slice(-6)}`, { x: width - margin - 80, y: y - 30, size: 10, font: fontRegular });
    page.drawText(`Date: ${dateStr}`, { x: width - margin - 80, y: y - 42, size: 10, font: fontRegular });
    if(timeStr) page.drawText(`Time: ${timeStr}`, { x: width - margin - 80, y: y - 54, size: 10, font: fontRegular });

    y -= 80;
    
    // Divider
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 20;

    // --- 2. PATIENT & DOCTOR INFO ---
    const pName = bill.patientId?.firstName ? `${bill.patientId.firstName} ${bill.patientId.lastName}` : bill.patientName || "N/A";
    const pUHID = bill.patientId?.uhid ? `${bill.patientId.uhid}` : "N/A";
    const pAgeGender = bill.patientId?.gender ? `(${bill.patientId.gender})` : "";
    const pPhone = bill.patientId?.phone || "";

    const dName = bill.doctorId?.firstName ? `${bill.doctorId.firstName} ${bill.doctorId.lastName}` : bill.doctorName || "N/A";
    const dSpec = bill.doctorId?.specialization || bill.doctorId?.department || "";

    // Patient Column
    page.drawText("Patient Details:", { x: margin, y, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    y -= 15;
    page.drawText(pName + " " + pAgeGender, { x: margin, y, size: 11, font: fontBold });
    y -= 12;
    page.drawText(`UHID: ${pUHID}`, { x: margin, y, size: 10, font: fontRegular });
    y -= 12;
    if(pPhone) page.drawText(`Phone: ${pPhone}`, { x: margin, y, size: 10, font: fontRegular });

    // Doctor Column
    let dy = y + 24 + 15; // Reset y for right column
    page.drawText("Doctor Details:", { x: width/2 + 20, y: dy, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    dy -= 15;
    page.drawText(dName, { x: width/2 + 20, y: dy, size: 11, font: fontBold });
    dy -= 12;
    if(dSpec) page.drawText(dSpec, { x: width/2 + 20, y: dy, size: 10, font: fontRegular });

    y -= 40;

    // --- 3. SERVICES TABLE ---
    // Table Header
    const col1 = margin;        // #
    const col2 = margin + 30;   // Description
    const col3 = width - margin - 150; // Category
    const col4 = width - margin - 60;  // Amount

    page.drawRectangle({ x: margin, y: y - 5, width: width - 2 * margin, height: 20, color: rgb(0.95, 0.95, 0.95) });
    
    page.drawText("#", { x: col1 + 5, y, size: 9, font: fontBold });
    page.drawText("Service / Description", { x: col2, y, size: 9, font: fontBold });
    page.drawText("Category", { x: col3, y, size: 9, font: fontBold });
    page.drawText("Amount", { x: col4, y, size: 9, font: fontBold });

    y -= 25;

    // Table Content
    if (Array.isArray(bill.services)) {
      bill.services.forEach((svc, i) => {
        const name = typeof svc === 'string' ? svc : svc.name;
        const cat = typeof svc === 'object' ? svc.category || "-" : "-";
        const amt = typeof svc === 'object' ? (svc.amount || 0).toFixed(2) : "0.00";

        page.drawText(`${i + 1}`, { x: col1 + 5, y, size: 9, font: fontRegular });
        page.drawText(name, { x: col2, y, size: 9, font: fontRegular });
        page.drawText(cat, { x: col3, y, size: 9, font: fontRegular });
        page.drawText(amt, { x: col4, y, size: 9, font: fontRegular });

        // If description exists, print it below
        if(svc.description) {
           y -= 12;
           page.drawText(`(${svc.description})`, { x: col2 + 10, y, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
        }
        
        y -= 20;
        
        // Page Break Check? (Omitted for simplicity, assuming bills aren't huge)
      });
    }

    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 20;

    // --- 4. SUMMARY & TAX ---
    const rightAlignStart = width - margin - 180;
    const valueAlignStart = width - margin - 60;

    // Subtotal
    page.drawText("Sub Total:", { x: rightAlignStart, y, size: 10, font: fontRegular });
    page.drawText((bill.subTotal || 0).toFixed(2), { x: valueAlignStart, y, size: 10, font: fontRegular });
    y -= 15;

    // Discount
    if(bill.discount > 0) {
      page.drawText("Discount:", { x: rightAlignStart, y, size: 10, font: fontRegular });
      page.drawText(`- ${(bill.discount).toFixed(2)}`, { x: valueAlignStart, y, size: 10, font: fontRegular });
      y -= 15;
    }

    // Taxes
    if (bill.taxDetails && bill.taxDetails.length > 0) {
      bill.taxDetails.forEach(t => {
        page.drawText(`${t.name} (${t.rate}%):`, { x: rightAlignStart, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(`${(t.amount || 0).toFixed(2)}`, { x: valueAlignStart, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
        y -= 12;
      });
      y -= 5;
    }

    page.drawLine({ start: { x: rightAlignStart, y: y+5 }, end: { x: width - margin, y: y+5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

    // Total
    page.drawText("Total Amount:", { x: rightAlignStart, y, size: 11, font: fontBold });
    page.drawText((bill.totalAmount || 0).toFixed(2), { x: valueAlignStart, y, size: 11, font: fontBold });
    y -= 20;

    // Amount Due
    page.drawText("Amount Due:", { x: rightAlignStart, y, size: 10, font: fontBold, color: rgb(0.8, 0, 0) });
    page.drawText((bill.amountDue || 0).toFixed(2), { x: valueAlignStart, y, size: 10, font: fontBold, color: rgb(0.8, 0, 0) });
    y -= 30;

    // --- 5. FOOTER (QR, Terms) ---
    const footerY = 100;
    
    // QR Code
    try {
       const verifyUrl = bill.verificationUrl || `${process.env.FRONTEND_URL}/verify/bill/${bill._id}`;
       const qrDataUrl = await QRCode.toDataURL(verifyUrl);
       const qrImage = await pdfDoc.embedPng(qrDataUrl);
       page.drawImage(qrImage, { x: margin, y: footerY - 10, width: 60, height: 60 });
       page.drawText("Scan to Verify", { x: margin, y: footerY - 20, size: 8, font: fontRegular });
    } catch(e) {}

    // Terms
    const termsX = margin + 80;
    page.drawText("Terms & Conditions:", { x: termsX, y: footerY + 40, size: 9, font: fontBold });
    
    const terms = bill.clinicId?.termsAndConditions || ["Payment due upon receipt.", "Thank you for your business."];
    let termY = footerY + 25;
    terms.slice(0, 3).forEach((term) => { // Show max 3 terms
       page.drawText(`• ${term}`, { x: termsX, y: termY, size: 8, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
       termY -= 10;
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Invoice-${bill.billNumber || bill._id}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    logger.error("Error generating bill PDF", { id: req.params.id, error: err.message });
    res.status(500).send("Error generating PDF");
  }
});

module.exports = router;
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import toast, { Toaster } from 'react-hot-toast'; 
import Sidebar from "../components/DoctorSidebar"; 
import Navbar from "../components/DoctorNavbar";   

const BASE = "http://localhost:3001";

const DoctorAddBill = ({ sidebarCollapsed, toggleSidebar }) => {
  const navigate = useNavigate();

  // --- 1. Form State ---
  const [form, setForm] = useState({
    patientId: "",
    patientName: "",
    doctorId: "", 
    doctorName: "", 
    clinicId: null, // Not needed for doctor view
    clinicName: "", // Locked to Doctor's clinic
    encounterId: "",
    services: "",   // Will auto-fill
    totalAmount: "", // Will auto-fill
    discount: "0",
    amountDue: "",
    date: new Date().toISOString().split("T")[0],
    status: "unpaid",
    notes: "",
  });

  const [patients, setPatients] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [saving, setSaving] = useState(false);

  // --- 2. Initialize Data ---
  useEffect(() => {
    const init = async () => {
        // A. Get Logged in Doctor
        const doctor = JSON.parse(localStorage.getItem("doctor"));
        if (!doctor || (!doctor._id && !doctor.id)) {
            toast.error("Doctor session invalid. Please login.");
            return;
        }
        
        // ✅ AUTO-FILL DOCTOR & CLINIC (Locked)
        setForm(prev => ({
            ...prev,
            doctorId: doctor._id || doctor.id,
            doctorName: `${doctor.firstName} ${doctor.lastName}`.trim(),
            // Assuming doctor object has a 'clinic' field. If not, defaults to "General Clinic"
            clinicName: doctor.clinic || "General Clinic", 
        }));

        // B. Fetch Patients List
        try {
            const res = await axios.get(`${BASE}/patients`);
            const patientList = Array.isArray(res.data) ? res.data : res.data.data || [];
            setPatients(patientList);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load patients");
        }
    };
    init();
  }, []);

  // --- 3. Auto-Fetch Data When Patient Changes ---
  const handlePatientChange = async (e) => {
    const selectedId = e.target.value;
    const selectedPatient = patients.find(p => p._id === selectedId);
    
    // 1. Update Patient Name
    setForm(prev => ({
      ...prev,
      patientId: selectedId,
      patientName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "",
      // Clear previous encounter data while loading new ones
      encounterId: "",
      services: "",
      totalAmount: "",
      amountDue: ""
    }));

    if (!selectedId) {
        setEncounters([]);
        return;
    }

    // 2. Fetch Encounters for this Patient & Doctor
    try {
        const res = await axios.get(`${BASE}/encounters?patientId=${selectedId}&doctorId=${form.doctorId}`);
        const data = Array.isArray(res.data) ? res.data : res.data.encounters || [];
        
        setEncounters(data);

        // ✅ SMART AUTO-FILL: Automatically select the most recent encounter
        if (data.length > 0) {
            // Sort by date (newest first) just in case backend didn't
            const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latest = sorted[0];

            // Format services
            let servicesText = Array.isArray(latest.services) ? latest.services.join(", ") : latest.services || "";
            
            // Update form with latest appointment details
            setForm(prev => ({
                ...prev,
                encounterId: latest.encounterId || latest._id,
                services: servicesText,
                totalAmount: latest.charges || 0,
                amountDue: (latest.charges || 0) - (Number(prev.discount) || 0),
                date: new Date(latest.date).toISOString().split('T')[0]
            }));
            
            toast.success("Auto-filled from latest appointment!");
        }
    } catch (err) {
        console.error(err);
        setEncounters([]);
    }
  };

  // --- 4. Handle Manual Encounter Change (If they pick a different one) ---
  const handleEncounterChange = (e) => {
      const selectedEncounterId = e.target.value;
      const encounter = encounters.find(enc => (enc.encounterId === selectedEncounterId) || (enc._id === selectedEncounterId));

      if (encounter) {
          let servicesText = Array.isArray(encounter.services) ? encounter.services.join(", ") : encounter.services || "";
          const charges = encounter.charges || 0;
          const discount = Number(form.discount) || 0;

          setForm(prev => ({
              ...prev,
              encounterId: selectedEncounterId,
              services: servicesText, 
              totalAmount: charges,   
              amountDue: charges - discount,
              date: new Date(encounter.date).toISOString().split('T')[0] 
          }));
      } else {
          setForm(prev => ({ ...prev, encounterId: "", services: "", totalAmount: "" }));
      }
  };

  const handleGenericChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...form, [name]: value };
    
    // Recalculate Due Amount if Total or Discount changes
    if (name === "totalAmount" || name === "discount") {
      const total = Number(name === "totalAmount" ? value : updatedForm.totalAmount);
      const discount = Number(name === "discount" ? value : updatedForm.discount);
      updatedForm.amountDue = Math.max(total - discount, 0);
    }
    setForm(updatedForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId) return toast.error("Please select a Patient");
    
    try {
      setSaving(true);
      const payload = {
        ...form,
        services: form.services.split(",").map(s => s.trim()), 
        clinicId: null 
      };
      await axios.post(`${BASE}/bills`, payload);
      toast.success("Bill created successfully!");
      navigate("/doctor/billing-records");
    } catch (err) {
      toast.error("Error creating bill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex" style={{ backgroundColor: "#f5f7fb", minHeight: "100vh" }}>
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex-grow-1" style={{ marginLeft: sidebarCollapsed ? 64 : 250, transition: "0.3s" }}>
        <Navbar toggleSidebar={toggleSidebar} />
        <Toaster position="top-right"/>

        <div className="container-fluid mt-3">
          <h4 className="fw-bold text-primary mb-4 ps-2">Add New Bill</h4>

          <div className="card shadow-sm p-4 border-0 rounded-3">
            <form onSubmit={handleSubmit}>
              <div className="row">
                
                {/* Doctor (LOCKED) */}
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold text-muted">Doctor Name (Locked)</label>
                  <input 
                    className="form-control bg-light" 
                    value={form.doctorName} 
                    readOnly 
                  />
                </div>

                {/* Patient Selection (Triggers Auto-Fetch) */}
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold">Patient Name <span className="text-danger">*</span></label>
                  <select name="patientId" className="form-select" value={form.patientId} onChange={handlePatientChange} required>
                    <option value="">-- Select Patient --</option>
                    {patients.map((p) => (
                      <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>

                {/* Clinic (LOCKED - From Doctor Profile) */}
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold text-muted">Clinic Name (Locked)</label>
                  <input 
                    className="form-control bg-light" 
                    value={form.clinicName} 
                    readOnly 
                  />
                </div>

                {/* Encounter Selection (Auto-Selected) */}
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold">Link Appointment <span className="text-danger">*</span></label>
                  <select 
                    name="encounterId" 
                    className="form-select" 
                    value={form.encounterId} 
                    onChange={handleEncounterChange} 
                    disabled={!form.patientId}
                  >
                    <option value="">-- Select Appointment --</option>
                    {encounters.map((enc) => (
                      <option key={enc._id} value={enc.encounterId || enc._id}>
                        {new Date(enc.date).toLocaleDateString()} - {enc.services || "General"}
                      </option>
                    ))}
                  </select>
                  {form.patientId && encounters.length === 0 && (
                      <small className="text-muted mt-1 d-block">No recent appointments found.</small>
                  )}
                </div>

                {/* Services (Auto-filled) */}
                <div className="col-md-12 mb-3">
                  <label className="form-label small fw-bold">Services</label>
                  <input 
                    name="services" 
                    className="form-control" 
                    value={form.services} 
                    onChange={handleGenericChange} 
                    placeholder="Auto-filled from appointment..." 
                  />
                </div>

                {/* Amounts (Auto-filled) */}
                <div className="col-md-4 mb-3">
                  <label className="form-label small fw-bold">Total Amount (₹)</label>
                  <input 
                    type="number" 
                    name="totalAmount" 
                    className="form-control" 
                    value={form.totalAmount} 
                    onChange={handleGenericChange} 
                    required 
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label small fw-bold">Discount (₹)</label>
                  <input type="number" name="discount" className="form-control" value={form.discount} onChange={handleGenericChange} />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label small fw-bold">Amount Due (₹)</label>
                  <input type="number" className="form-control bg-light" value={form.amountDue} readOnly />
                </div>

                {/* Date & Status */}
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold">Date</label>
                  <input type="date" name="date" className="form-control" value={form.date} onChange={handleGenericChange} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-bold">Status</label>
                  <select name="status" className="form-select" value={form.status} onChange={handleGenericChange}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label small fw-bold">Notes</label>
                  <textarea name="notes" className="form-control" rows="3" value={form.notes} onChange={handleGenericChange}></textarea>
                </div>
              </div>

              <div className="mt-2">
                  <button className="btn btn-primary px-4 me-2" disabled={saving}>{saving ? "Generating..." : "Generate Bill"}</button>
                  <button type="button" className="btn btn-secondary px-4" onClick={() => navigate("/doctor/billing-records")}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorAddBill;
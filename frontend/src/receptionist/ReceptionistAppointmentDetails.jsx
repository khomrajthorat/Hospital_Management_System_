// src/receptionist-dashboard/receptionist/ReceptionistAppointmentDetails.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ReceptionistLayout from "../receptionist/layouts/ReceptionistLayout";
import API_BASE from "../config";
import { showToast } from "../utils/useToast";

export default function ReceptionistAppointmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAppt = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get(`${API_BASE}/appointments/${id}`);
        console.log("📋 Full Appointment Data:", res.data);
        console.log("👤 Patient ID Object:", res.data.patientId);
        
        // Check if patientId.userId exists
        if (res.data.patientId?.userId) {
          console.log("✅ User Data Found:", res.data.patientId.userId);
        } else {
          console.warn("⚠️ User Data Not Populated - Check backend populate");
        }
        
        setAppointment(res.data);
      } catch (err) {
        console.error("Failed to load appointment", err);
        if (err.response?.status === 404) {
          setError("Appointment not found (maybe deleted).");
        } else {
          setError("Failed to load appointment details.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchAppt();
  }, [id]);

  if (loading) {
    return (
      <ReceptionistLayout>
        <div className="p-4">Loading appointment…</div>
      </ReceptionistLayout>
    );
  }

  if (error || !appointment) {
    return (
      <ReceptionistLayout>
        <div className="p-4">
          <p className="text-danger mb-3">{error || "Appointment not found"}</p>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </ReceptionistLayout>
    );
  }

  const a = appointment;
  
  // Helper function to calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? age : null;
    } catch (error) {
      console.error("Error calculating age:", error);
      return null;
    }
  };
  
  const getPatientInfo = () => {
    console.log("🔍 Getting patient info from:", a.patientId);
    
    // Method 1: Check if patientId has userId populated (NEW STRUCTURE)
    if (a.patientId && typeof a.patientId === 'object') {
      if (a.patientId.userId && typeof a.patientId.userId === 'object') {
        console.log("✅ Using populated userId data");
        const user = a.patientId.userId;
        return {
          name: user.name || a.patientName || "N/A",
          email: user.email || a.patientEmail || "N/A",
          phone: user.phone || a.patientPhone || "N/A",
          bloodGroup: user.bloodGroup || "N/A",
          age: calculateAge(user.dob),
          gender: user.gender || "N/A"
        };
      }
      
      // Method 2: Check if patientId IS the user object (ALTERNATIVE STRUCTURE)
      if (a.patientId.name || a.patientId.email) {
        console.log("✅ PatientId is User object directly");
        return {
          name: a.patientId.name || a.patientName || "N/A",
          email: a.patientId.email || a.patientEmail || "N/A",
          phone: a.patientId.phone || a.patientPhone || "N/A",
          bloodGroup: a.patientId.bloodGroup || "N/A",
          age: calculateAge(a.patientId.dob),
          gender: a.patientId.gender || "N/A"
        };
      }
    }
    
    // Method 3: Fallback to root level fields (OLD STRUCTURE)
    console.log("⚠️ Using fallback - root level fields only");
    return {
      name: a.patientName || "N/A",
      email: a.patientEmail || "N/A",
      phone: a.patientPhone || "N/A",
      bloodGroup: "N/A",
      age: null,
      gender: "N/A"
    };
  };

  const patient = getPatientInfo();
  
  console.log("📊 Final Patient Info:", patient);

  return (
    <ReceptionistLayout>
      <div className="container py-4">
        <button className="btn btn-link mb-3" onClick={() => navigate(-1)}>
          ← Back to calendar
        </button>

        <h3 className="mb-4">Appointment Details</h3>

        {/* Patient info card */}
        <div className="card p-3 mb-3 shadow-sm border-0">
          <h5 className="mb-3 border-bottom pb-2 text-primary">Patient Information</h5>
          <div className="row g-2">
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Name</p>
              <strong>{patient.name}</strong>
            </div>
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Email</p>
              <strong>{patient.email}</strong>
            </div>
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Phone</p>
              <strong>{patient.phone}</strong>
            </div>
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Age</p>
              <strong>{patient.age ? `${patient.age} years` : "N/A"}</strong>
            </div>
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Blood Group</p>
              <strong>{patient.bloodGroup}</strong>
            </div>
            <div className="col-md-4">
              <p className="mb-1 text-muted small">Services</p>
              <strong>{Array.isArray(a.services) ? a.services.join(", ") : (a.services || "N/A")}</strong>
            </div>
          </div>
        </div>

        {/* Appointment info card */}
        <div className="card p-3 mb-3 shadow-sm border-0">
          <h5 className="mb-3 border-bottom pb-2 text-primary">Appointment Details</h5>
          
          <div className="row g-3">
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Doctor</p>
                <strong>{a.doctorName || "N/A"}</strong>
            </div>
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Clinic</p>
                <strong>{a.clinic || "N/A"}</strong>
            </div>
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Date</p>
                <strong>{a.date ? new Date(a.date).toLocaleDateString("en-GB") : "N/A"}</strong>
            </div>
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Time</p>
                <strong>{a.time || "N/A"}</strong>
            </div>
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Service</p>
                <strong>{a.serviceName || a.service || "Appointment"}</strong>
            </div>
            <div className="col-md-6">
                <p className="mb-1 text-muted small">Status</p>
                <span className={`badge ${a.status === 'booked' ? 'bg-primary' : 'bg-secondary'}`}>
                    {a.status || "Scheduled"}
                </span>
            </div>
            
            {/* Appointment Mode */}
            {a.appointmentMode && (
              <div className="col-12">
                <p className="mb-1 text-muted small">Mode</p>
                <div className="p-3 rounded" style={{ 
                  background: a.appointmentMode === 'online' ? '#e7f5ff' : '#f8f9fa',
                  border: `1px solid ${a.appointmentMode === 'online' ? '#74c0fc' : '#dee2e6'}`
                }}>
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <span className={`badge ${a.appointmentMode === 'online' ? 'bg-info' : 'bg-secondary'} me-2`}>
                        {a.appointmentMode === 'online' ? '🖥️ Online' : '🏥 In-Clinic'}
                      </span>
                      {a.onlinePlatform && (
                        <span className="small text-muted">
                          via {a.onlinePlatform === 'google_meet' ? 'Google Meet' : 'Zoom'}
                        </span>
                      )}
                    </div>
                    {a.meetingLink && (
                      <div className="d-flex gap-2">
                        <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" 
                           className="btn btn-primary btn-sm">
                          📹 Join Meeting
                        </a>
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => { 
                            navigator.clipboard.writeText(a.meetingLink); 
                            showToast.success('Link copied!'); 
                          }}
                        >
                          📋 Copy Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="col-12">
                <p className="mb-1 text-muted small">Notes</p>
                <div className="p-2 bg-light rounded">
                    {a.notes || "No additional notes."}
                </div>
            </div>

          </div>
        </div>

      </div>
    </ReceptionistLayout>
  );
}
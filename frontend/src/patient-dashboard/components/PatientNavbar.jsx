import React, { useState, useRef, useEffect } from "react";
// CHANGE 1: Added specific icons to the import
import { FaBars, FaUser, FaLock, FaSignOutAlt } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import API_BASE from "../../config";

export default function PatientNavbar({ toggleSidebar }) {
  const [open, setOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: "Patient", avatar: "" });
  const menuRef = useRef();
  const navigate = useNavigate();

  // CHANGE 2: Safer localStorage parsing
  let userId = null;
  try {
    const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");
    userId = authUser?.id;
  } catch (e) {
    console.error("Error parsing authUser:", e);
  }

  // Fetch patient profile on mount
  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // NOTE: If you still get a 404, check if your backend route is actually "/api/users" (plural)
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          name: data.name || "Patient",
          avatar: data.avatar || "",
        });
      }
    } catch (err) {
      console.error("Error fetching patient profile:", err);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  // Get first letter for avatar fallback
  const letter = profileData.name?.trim()?.charAt(0)?.toUpperCase() || "P";

  return (
    <nav className="navbar navbar-dark bg-primary px-3 d-flex justify-content-between align-items-center">

      {/* left side */}
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-outline-light border-0"
          onClick={toggleSidebar}
        >
          <FaBars size={22} />
        </button>

        <h4 className="text-white fw-bold mb-0">One Care Patient</h4>
      </div>

      {/* right side: profile dropdown */}
      <div className="position-relative" ref={menuRef}>
        <div
          className="d-flex align-items-center"
          style={{ cursor: "pointer" }}
          onClick={() => setOpen(!open)}
        >
          {profileData.avatar ? (
            <img
              src={profileData.avatar}
              alt="User Avatar"
              width="35"
              height="35"
              className="rounded-circle"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "35px",
                height: "35px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "600",
                fontSize: "16px",
              }}
            >
              {letter}
            </div>
          )}
          <span className="text-white ms-2 fw-semibold username">{profileData.name}</span>
        </div>

        {open && (
          <div
            className="shadow"
            style={{
              position: "absolute",
              top: "55px",
              right: "0",
              background: "white",
              borderRadius: "8px",
              width: "180px",
              zIndex: 1000,
            }}
          >
            <button
              className="dropdown-item d-flex align-items-center gap-2"
              onClick={() => {
                navigate("/patient/profile");
                setOpen(false);
              }}
            >
              {/* CHANGE 3: Replaced <i> tag with React Icon */}
              <FaUser /> My Profile
            </button>

            <button
              className="dropdown-item d-flex align-items-center gap-2"
              onClick={() => {
                navigate("/patient/change-password");
                setOpen(false);
              }}
            >
              {/* CHANGE 4: Replaced <i> tag with React Icon */}
              <FaLock /> Change Password
            </button>

            <button
              className="dropdown-item text-danger d-flex align-items-center gap-2"
              onClick={handleLogout}
            >
              {/* CHANGE 5: Replaced <i> tag with React Icon */}
              <FaSignOutAlt /> Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
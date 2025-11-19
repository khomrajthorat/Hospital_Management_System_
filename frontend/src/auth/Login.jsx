// src/Login.jsx
import { Link } from "react-router-dom";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRoleClick = (newRole) => {
    setRole(newRole);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError("");

    fetch("http://localhost:3001/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.message || "Login failed");
          return;
        }

        const data = await res.json();
        const user = data.user || data;

        console.log("Login response user:", user);

        // role check vs button selection
        if (user.role !== role) {
          setError("Invalid Credentials");
          return;
        }

        // ✅ STORE AUTH USER HERE
        console.log("Saving authUser to localStorage:", user);
        localStorage.setItem("authUser", JSON.stringify(user));

        // redirect based on role and profileCompleted
        if (user.role === "admin") {
          navigate("/admin-dashboard");
        } else if (user.role === "doctor") {
          navigate("/doctor-dashboard");
        } else if (user.role === "receptionist") {
          navigate("/reception-dashboard");
        } else if (user.role === "patient") {
          if (user.profileCompleted) {
            navigate("/patient-dashboard");
          } else {
            navigate("/patient/profile-setup");
          }
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Network error: backend not responding");
      });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f7fb",
      }}
    >
      <div
        style={{
          width: "380px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: "24px 28px",
        }}
      >
        <h3 style={{ textAlign: "center", marginBottom: "20px" }}>Login</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "14px",
              }}
            >
              Username or Email Address
            </label>
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "14px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={() => handleRoleClick("doctor")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor: role === "doctor" ? "#0d6efd" : "#6c757d",
                color: "white",
              }}
            >
              Doctor
            </button>

            <button
              type="button"
              onClick={() => handleRoleClick("receptionist")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor:
                  role === "receptionist" ? "#0d6efd" : "#6c757d",
                color: "white",
              }}
            >
              Receptionist
            </button>

            <button
              type="button"
              onClick={() => handleRoleClick("patient")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor: role === "patient" ? "#0d6efd" : "#6c757d",
                color: "white",
              }}
            >
              Patient
            </button>
          </div>

          <div
            style={{
              display: "flex",
              marginBottom: "16px",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => setRole("admin")}
              style={{
                padding: "6px 16px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                backgroundColor: role === "admin" ? "#0d6efd" : "#6c757d",
                color: "white",
              }}
            >
              Admin Login
            </button>
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "8px 0",
              backgroundColor: "#0d6efd",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "15px",
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            Login
          </button>

          {error && (
            <div
              style={{
                color: "red",
                fontSize: "13px",
                textAlign: "center",
                marginBottom: "8px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{ textAlign: "center", fontSize: "12px", marginTop: "8px" }}
          >
            <Link to="/signup" style={{ color: "blue" }}>
              Don't have an account? Signup
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;

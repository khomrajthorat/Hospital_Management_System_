// src/pages/reception/ReceptionDashboard.jsx
import React, { useState } from "react";
import ReceptionistNavbar from "../receptionist/components/Navbar";
import ReceptionistSidebar from "../receptionist/components/Sidebar";

const ReceptionDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="receptionist-layout">
      {/* Sidebar Component */}
      <ReceptionistSidebar collapsed={sidebarCollapsed} />

      {/* Main Content Area */}
      <main className={`receptionist-main-content ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Navbar Component */}
        <ReceptionistNavbar toggleSidebar={toggleSidebar} />

        <div className="content-container p-4">
          <div className="card shadow-sm border-0 rounded-4">
            <div className="card-body p-5 text-center">
              <h1 className="display-4 fw-bold text-primary">Hi!</h1>
              <p className="lead text-muted">
                Welcome back to the OneCare Reception Management System.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReceptionDashboard;
import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import SettingsSidebar from "./SettingsSidebar";

const SettingsLayout = ({ sidebarCollapsed, toggleSidebar }) => {
  return (
    <div className="d-flex">
      {/* Main Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} />

      {/* Main Content Wrapper */}
      <div
        className="flex-grow-1 main-content-transition"
        style={{
          marginLeft: sidebarCollapsed ? 64 : 250,
          minHeight: "100vh",
          backgroundColor: "#f8f9fa",
        }}
      >
        <Navbar toggleSidebar={toggleSidebar} />

        <div className="container-fluid py-4">
          <h3 className="fw-bold text-primary mb-4">Settings</h3>

          <div className="row g-4">
            {/* Settings Sidebar */}
            <div className="col-md-3">
              <SettingsSidebar />
            </div>

            {/* Settings Content Area */}
            <div className="col-md-9">
              <div className="card shadow-sm border-0 h-100" style={{ minHeight: "500px" }}>
                <div className="card-body">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;

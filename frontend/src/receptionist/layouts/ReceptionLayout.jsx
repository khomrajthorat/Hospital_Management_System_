import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import ReceptionistNavbar from "../components/Navbar";
import ReceptionistSidebar from "../components/Sidebar";
import PageTransition from "../../components/PageTransition";

// Import the specific CSS for this layout
import "../styles/ReceptionistLayout.css";

const ReceptionistLayout = () => {
  // State to manage sidebar collapsed/expanded
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="reception-layout-wrapper">
      
      {/* 1. Sidebar Container */}
      <div className={`layout-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <ReceptionistSidebar collapsed={sidebarCollapsed} />
      </div>

      {/* 2. Main Content Wrapper */}
      <div className={`layout-main ${sidebarCollapsed ? 'collapsed' : ''}`}>
        
        {/* Navbar sits at the top of the main content area */}
        <ReceptionistNavbar toggleSidebar={toggleSidebar} />

        {/* Page Content */}
        <div className="layout-content p-4">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>

    </div>
  );
};

export default ReceptionistLayout;
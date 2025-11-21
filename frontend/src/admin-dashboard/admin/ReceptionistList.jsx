import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "../layouts/AdminLayout";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaPlus,
  FaFileImport,
  FaPen,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import toast, { Toaster } from "react-hot-toast";
import {
  getReceptionists,
  deleteReceptionist,
  toggleReceptionistStatus,
  resendCredentials,
  importReceptionists,
} from "../utils/receptionistApi";
import "../styles/ReceptionistList.css";

export default function ReceptionistList() {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    id: "",
    name: "",
    clinic: "",
    email: "",
    mobile: "",
    status: "",
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const API_BASE_URL = "http://localhost:3001";

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // -------------------------------------------
  // LOAD DATA
  // -------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getReceptionists();
        const rows = res.data?.data || [];
        setData(rows);

        // For clinic dropdown dedupe
        const clinicSet = new Set();
        rows.forEach((r) => {
          r.clinicIds?.forEach((c) => clinicSet.add(c.name));
        });
        setClinics([...clinicSet]);
      } catch (err) {
        console.log(err);
        toast.error("Failed to load receptionists");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // -------------------------------------------
  // FILTER LOGIC
  // -------------------------------------------
  const processed = useMemo(() => {
    const match = (value, filter) =>
      value?.toString().toLowerCase().includes(filter.toLowerCase());

    return data
      .map((item, index) => {
        const clinicNames = item.clinicIds?.map((c) => c.name).join(", ") || "-";

        return {
          ...item,
          tableId: index + 1,
          clinicNames,
          statusText: item.status ? "active" : "inactive",
        };
      })
      .filter((row) => {
        const global = search.trim().toLowerCase();

        if (global) {
          const combined = (
            row.tableId +
            " " +
            row.name +
            " " +
            row.email +
            " " +
            row.mobile +
            " " +
            row.clinicNames +
            " " +
            row.statusText
          ).toLowerCase();

          if (!combined.includes(global)) return false;
        }

        return (
          (!filters.id || String(row.tableId).startsWith(filters.id)) &&
          (!filters.name || match(row.name, filters.name)) &&
          (!filters.email || match(row.email, filters.email)) &&
          (!filters.mobile || match(row.mobile, filters.mobile)) &&
          (!filters.clinic || row.clinicNames.includes(filters.clinic)) &&
          (!filters.status || filters.status === row.statusText)
        );
      });
  }, [data, filters, search]);

  // -------------------------------------------
  // DELETE RECEPTIONIST
  // -------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this receptionist?")) return;

    const p = deleteReceptionist(id).then(() => {
      setData((list) => list.filter((i) => i._id !== id));
    });

    await toast.promise(p, {
      loading: "Deleting...",
      success: "Deleted",
      error: "Failed",
    });
  };

  // -------------------------------------------
  // RESEND CREDENTIALS
  // -------------------------------------------
  const handleResend = async (id) => {
    const p = resendCredentials(id);
    await toast.promise(p, {
      loading: "Sending credentials...",
      success: "Credentials sent",
      error: "Failed to send",
    });
  };

  // -------------------------------------------
  // TOGGLE STATUS
  // -------------------------------------------
  const handleToggleStatus = async (id) => {
    try {
      const p = toggleReceptionistStatus(id);
      const res = await toast.promise(p, {
        loading: "Updating status...",
        success: "Status updated",
        error: "Failed to update",
      });

      const newStatus = res.data.status;
      setData((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, status: newStatus } : item
        )
      );
    } catch (err) {
      console.log(err);
    }
  };

  // -------------------------------------------
  // IMPORT CSV
  // -------------------------------------------
  const handleImport = async (e) => {
    e.preventDefault();

    if (!importFile) {
      toast.error("Choose CSV file");
      return;
    }

    const form = new FormData();
    form.append("file", importFile);

    try {
      const p = importReceptionists(form);

      await toast.promise(p, {
        loading: "Importing...",
        success: "Import completed",
        error: "Failed to import",
      });

      window.location.reload();
    } catch (err) {
      console.log(err);
    }
  };

  // -------------------------------------------
  // RENDER
  // -------------------------------------------
  return (
    <AdminLayout>
      <Toaster position="top-right" />

      <div className="container-fluid py-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="fw-bold text-primary mb-0">Receptionists List</h3>

          <div>
            <button
              className="btn btn-outline-primary me-2"
              onClick={() => setShowImportModal(true)}
            >
              <FaFileImport className="me-1" /> Import data
            </button>

            <button
              className="btn btn-primary"
              onClick={() => navigate("/add-receptionist")}
            >
              <FaPlus className="me-1" /> Add receptionist
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="reception-search-bar mb-3">
          <div className="input-group">
            <span className="input-group-text">
              <FaSearch />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search receptionist by ID, name, clinic, email, mobile and status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="card p-3 reception-card">
            <div className="table-responsive">
              <table className="table table-hover align-middle reception-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>ID</th>
                    <th>Name</th>
                    <th>Clinic Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Status</th>
                    <th style={{ width: "170px", textAlign: "center" }}>
                      Action
                    </th>
                  </tr>

                  {/* Filter Row */}
                  <tr className="reception-filter-row">
                    <th>
                      <input
                        className="form-control form-control-sm"
                        placeholder="ID"
                        value={filters.id}
                        onChange={(e) =>
                          handleFilterChange("id", e.target.value)
                        }
                      />
                    </th>

                    <th>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Name"
                        value={filters.name}
                        onChange={(e) =>
                          handleFilterChange("name", e.target.value)
                        }
                      />
                    </th>

                    <th>
                      <select
                        className="form-select form-select-sm"
                        value={filters.clinic}
                        onChange={(e) =>
                          handleFilterChange("clinic", e.target.value)
                        }
                      >
                        <option value="">All</option>
                        {clinics.map((c, i) => (
                          <option key={i} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </th>

                    <th>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Email"
                        value={filters.email}
                        onChange={(e) =>
                          handleFilterChange("email", e.target.value)
                        }
                      />
                    </th>

                    <th>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Mobile"
                        value={filters.mobile}
                        onChange={(e) =>
                          handleFilterChange("mobile", e.target.value)
                        }
                      />
                    </th>

                    <th>
                      <select
                        className="form-select form-select-sm"
                        value={filters.status}
                        onChange={(e) =>
                          handleFilterChange("status", e.target.value)
                        }
                      >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {processed.map((row) => {
                    const initials = row.name
                      ?.split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={row._id}>
                        <td>{row.tableId}</td>

                        {/* Avatar + Name */}
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="reception-avatar">{initials}</div>
                            <div className="fw-semibold">{row.name}</div>
                          </div>
                        </td>

                        {/* Clinic Names */}
                        <td>{row.clinicNames}</td>

                        <td>{row.email}</td>
                        <td>{row.mobile || "-"}</td>

                        {/* Status Badge */}
                        <td>
                          <div
                            className={`status-badge ${
                              row.status ? "active" : "inactive"
                            }`}
                          >
                            {row.status ? "ACTIVE" : "INACTIVE"}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="text-center">
                          <div className="reception-actions d-flex justify-content-center gap-2">
                            <button
                              title="Edit"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                navigate(
                                  `/add-receptionist?receptionistId=${row._id}`
                                )
                              }
                            >
                              <FaPen />
                            </button>

                            <button
                              title="Resend credentials"
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => handleResend(row._id)}
                            >
                              <FaSyncAlt />
                            </button>

                            <button
                              title="Delete"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(row._id)}
                            >
                              <FaTrash />
                            </button>
                          </div>

                          {/* Toggle Status */}
                          <div className="form-check form-switch mt-2 d-flex justify-content-center">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={row.status}
                              onChange={() => handleToggleStatus(row._id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="reception-import-backdrop">
          <div className="reception-import-modal">
            <div className="reception-import-header">
              <h5 className="mb-0">Import Receptionists</h5>
              <button
                className="btn-close"
                onClick={() => setShowImportModal(false)}
              />
            </div>

            <div className="reception-import-body">
              <form onSubmit={handleImport}>
                <label className="form-label">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="form-control mb-3"
                  onChange={(e) => setImportFile(e.target.files[0])}
                />

                <div className="reception-import-footer text-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary me-2"
                    onClick={() => setShowImportModal(false)}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn btn-primary">
                    Import
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

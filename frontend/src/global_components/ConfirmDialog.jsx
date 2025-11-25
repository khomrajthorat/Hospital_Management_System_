import React, { createContext, useContext, useState, useEffect } from "react";
import { registerConfirm } from "../toasterjsfiles/confirmAPI.js";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = (options) =>
    new Promise((resolve) => {
      setDialog({
        title: options.title || "Are you sure?",
        message: options.message || "Do you want to continue?",
        variant: options.variant || "danger",
        okText: options.okText || "OK",
        cancelText: options.cancelText || "Cancel",
        resolve,
      });
    });

  // Register confirm globally
  useEffect(() => {
    registerConfirm(confirm);
  }, []);

  const handle = (ans) => {
    dialog.resolve(ans);
    setDialog(null);
  };

  const variantColors = {
    danger: "#b91c1c",
    warning: "#d97706",
    primary: "#2563eb",
  };

  return (
    <>
      {children}

      {dialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "350px",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginBottom: "10px" }}>{dialog.title}</h3>
            <p style={{ marginBottom: "20px", color: "#555" }}>
              {dialog.message}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => handle(false)}
                style={{
                  padding: "6px 14px",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {dialog.cancelText}
              </button>

              <button
                onClick={() => handle(true)}
                style={{
                  padding: "6px 14px",
                  background: variantColors[dialog.variant],
                  border: "none",
                  color: "#fff",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

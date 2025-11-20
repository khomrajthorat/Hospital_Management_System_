// src/alertToToast.js
import toast from "react-hot-toast";
import { openConfirmModal } from "../toasterjsfiles/confirmAPI"; 
// auto-detect type from plain string messages
function detectTypeFromMessage(message) {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("error") ||
    text.includes("failed") ||
    text.includes("fail") ||
    text.includes("invalid") ||
    text.includes("not found")
  ) {
    return "error";
  }

  if (
    text.includes("success") ||
    text.includes("saved") ||
    text.includes("added") ||
    text.includes("updated") ||
    text.includes("created") ||
    text.includes("done")
  ) {
    return "success";
  }

  if (text.includes("warning") || text.includes("caution")) {
    return "warning";
  }

  return "default";
}

// ✅ Global override
window.alert = (arg) => {
  // ---- Object / JSX based API ----
  // ex: alert({ type: 'success', message: <b>Saved!</b> })
  // ex: alert({ type: 'promise', promise: apiCall(), loading: 'Saving...', success: 'Saved', error: 'Failed' })
  if (typeof arg === "object" && arg !== null && !ReactIsPrimitive(arg)) {
    const {
      type,
      message,
      promise,
      loading,
      success,
      error,
      ...options
    } = arg;

    // Promise mode → wraps toast.promise
    if (type === "promise" && promise && typeof promise.then === "function") {
      return toast.promise(
        promise,
        {
          loading: loading || "Please wait...",
          success: success || "Done successfully",
          error: error || "Something went wrong",
        },
        options
      );
    }

    const finalMessage = message || "";

    // Explicit type
    switch (type) {
      case "success":
        return toast.success(finalMessage, options);
      case "error":
        return toast.error(finalMessage, options);
      case "loading":
        return toast.loading(finalMessage, options);
      case "custom":
        return toast(finalMessage, options);
      default: {
        // No type? Try to guess from message text
        const guessed = detectTypeFromMessage(finalMessage);
        if (guessed === "error") return toast.error(finalMessage, options);
        if (guessed === "success") return toast.success(finalMessage, options);
        return toast(finalMessage, options);
      }
    }
  }

  // ---- Plain string alert("something") ----
  const message = arg;

  const guessed = detectTypeFromMessage(message);
  if (guessed === "error") return toast.error(message);
  if (guessed === "success") return toast.success(message);
  if (guessed === "warning")
    return toast(message, { icon: "⚠️" });

  return toast(message);
};

// helper: treat strings/numbers as primitive, rest (JSX, objects) as non-primitive
function ReactIsPrimitive(val) {
  const t = typeof val;
  return val == null || t === "string" || t === "number" || t === "boolean";
}

window.confirm = async (message) => {
  return await openConfirmModal({
    title: "Please Confirm",
    message,
    variant: "danger",
    okText: "OK",
    cancelText: "Cancel",
  });
};
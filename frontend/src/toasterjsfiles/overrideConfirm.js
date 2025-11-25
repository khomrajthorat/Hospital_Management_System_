
import { openConfirmModal } from "./confirmAPI";

window.confirm = async (message) => {
  return await openConfirmModal({
    title: "Please Confirm",
    message: message || "Do you want to continue?",
    variant: "danger",
    okText: "OK",
    cancelText: "Cancel",
  });
};

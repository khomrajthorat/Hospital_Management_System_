let confirmFunction = null;

export function registerConfirm(fn) {
  confirmFunction = fn;
}

export function openConfirmModal(options) {
  if (!confirmFunction) {
    console.error("Confirm Dialog not mounted yet");
    return Promise.resolve(false);
  }
  return confirmFunction(options);
}

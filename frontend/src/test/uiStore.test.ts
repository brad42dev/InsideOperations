import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "../store/ui";

// ---------------------------------------------------------------------------
// useUiStore — state transitions for theme, lock, kiosk, emergency alert
// ---------------------------------------------------------------------------

function resetStore() {
  useUiStore.setState({
    isLocked: false,
    isKiosk: false,
    emergencyAlert: { active: false, message: "" },
  });
}

describe("useUiStore — initial state", () => {
  beforeEach(resetStore);

  it("starts with isLocked=false", () => {
    expect(useUiStore.getState().isLocked).toBe(false);
  });

  it("starts with isKiosk=false", () => {
    expect(useUiStore.getState().isKiosk).toBe(false);
  });

  it("starts with no active emergency alert", () => {
    expect(useUiStore.getState().emergencyAlert.active).toBe(false);
    expect(useUiStore.getState().emergencyAlert.message).toBe("");
  });
});

describe("useUiStore — lock/unlock", () => {
  beforeEach(resetStore);

  it("lock() sets isLocked=true", () => {
    useUiStore.getState().lock();
    expect(useUiStore.getState().isLocked).toBe(true);
  });

  it("unlock() sets isLocked=false after locking", () => {
    useUiStore.getState().lock();
    useUiStore.getState().unlock();
    expect(useUiStore.getState().isLocked).toBe(false);
  });

  it("unlock() is a no-op when already unlocked", () => {
    useUiStore.getState().unlock();
    expect(useUiStore.getState().isLocked).toBe(false);
  });

  it("lock() is idempotent", () => {
    useUiStore.getState().lock();
    useUiStore.getState().lock();
    expect(useUiStore.getState().isLocked).toBe(true);
  });
});

describe("useUiStore — kiosk mode", () => {
  beforeEach(resetStore);

  it("setKiosk(true) enables kiosk mode", () => {
    useUiStore.getState().setKiosk(true);
    expect(useUiStore.getState().isKiosk).toBe(true);
  });

  it("setKiosk(false) disables kiosk mode", () => {
    useUiStore.getState().setKiosk(true);
    useUiStore.getState().setKiosk(false);
    expect(useUiStore.getState().isKiosk).toBe(false);
  });

  it("kiosk mode does not affect lock state", () => {
    useUiStore.getState().setKiosk(true);
    expect(useUiStore.getState().isLocked).toBe(false);
  });
});

describe("useUiStore — emergency alert", () => {
  beforeEach(resetStore);

  it("showEmergencyAlert activates with message", () => {
    useUiStore.getState().showEmergencyAlert("Evacuation required");
    const { emergencyAlert } = useUiStore.getState();
    expect(emergencyAlert.active).toBe(true);
    expect(emergencyAlert.message).toBe("Evacuation required");
  });

  it("dismissEmergencyAlert clears the alert", () => {
    useUiStore.getState().showEmergencyAlert("Test alert");
    useUiStore.getState().dismissEmergencyAlert();
    const { emergencyAlert } = useUiStore.getState();
    expect(emergencyAlert.active).toBe(false);
    expect(emergencyAlert.message).toBe("");
  });

  it("showEmergencyAlert replaces previous message", () => {
    useUiStore.getState().showEmergencyAlert("First alert");
    useUiStore.getState().showEmergencyAlert("Second alert");
    expect(useUiStore.getState().emergencyAlert.message).toBe("Second alert");
  });

  it("dismissEmergencyAlert is a no-op when no alert active", () => {
    useUiStore.getState().dismissEmergencyAlert();
    expect(useUiStore.getState().emergencyAlert.active).toBe(false);
  });
});

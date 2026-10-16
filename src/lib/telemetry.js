export function trackEvent(name, payload = {}) {
  try {
    if (typeof window !== "undefined" && window.__TELEMETRY_URL) {
      // best-effort POST to configured telemetry endpoint
      fetch(window.__TELEMETRY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: name, payload, ts: Date.now() }),
      }).catch(() => {
        // swallow network errors
      });
    } else {
      // fallback to console for local/dev
      console.info("telemetry", name, payload);
    }
  } catch (e) {
    // swallow errors — telemetry must not break app
    console.warn("telemetry error", e);
  }
}

export default trackEvent;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.detail?.message ?? parsed?.detail ?? text;
    } catch {
      // Keep raw text when the backend did not return JSON.
    }
    throw new Error(message || `Backend request failed: ${response.status}`);
  }

  return response.json();
}

export function getProfiles() {
  return request("/profiles");
}

export function getAppInfo() {
  return request("/app/info");
}

export function getSessions(userId) {
  const params = new URLSearchParams({ user_id: userId });
  return request(`/sessions?${params.toString()}`);
}

export function startSession(payload) {
  return request("/session/start", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function endSession(sessionId, userId) {
  return request("/session/end", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, user_id: userId })
  });
}

export function sendEsp32Command({ type, sessionId, deviceId, command = {} }) {
  return request("/esp32/command", {
    method: "POST",
    body: JSON.stringify({
      type,
      session_id: sessionId,
      device_id: deviceId,
      command
    })
  });
}

export function getEsp32Status() {
  return request("/esp32/status");
}

export function getLiveTelemetry(userId, { scope = "user" } = {}) {
  const params = new URLSearchParams({ scope });
  if (userId) params.set("user_id", userId);
  return request(`/telemetry/live?${params.toString()}`);
}

export function getHistorical(sessionId, { from, to, userId } = {}) {
  const params = new URLSearchParams({ session_id: sessionId, user_id: userId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/historical?${params.toString()}`);
}

export function forgotPassword(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export { API_BASE_URL };

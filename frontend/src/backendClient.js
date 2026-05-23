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
    const message = await response.text();
    throw new Error(message || `Backend request failed: ${response.status}`);
  }

  return response.json();
}

export function getProfiles() {
  return request("/profiles");
}

export function getSessions() {
  return request("/sessions");
}

export function startSession(payload) {
  return request("/session/start", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function endSession(sessionId) {
  return request("/session/end", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId })
  });
}

export function sendPiCommand({ type, sessionId, command = {} }) {
  return request("/pi/command", {
    method: "POST",
    body: JSON.stringify({
      type,
      session_id: sessionId,
      command
    })
  });
}

export function getPiStatus() {
  return request("/pi/status");
}

export function getHistorical(sessionId, { from, to } = {}) {
  const params = new URLSearchParams({ session_id: sessionId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/historical?${params.toString()}`);
}

export { API_BASE_URL };

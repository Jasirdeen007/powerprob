function pad(value) {
  return String(value).padStart(2, "0");
}

export function timestampForFile(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function downloadBlob(content, fileName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(rows, columns) {
  const csvRows = rows.map((row) => columns.map((key) => escapeCsvCell(row[key])).join(","));
  return [columns.join(","), ...csvRows].join("\n");
}

export function downloadCsv(rows, columns, fileName) {
  downloadBlob(buildCsv(rows, columns), fileName, "text/csv;charset=utf-8;");
}

export function downloadJson(payload, fileName) {
  downloadBlob(JSON.stringify(payload, null, 2), fileName, "application/json;charset=utf-8;");
}

export function downloadSvgChartPng(container, fileName) {
  const svg = container?.querySelector("svg");
  if (!svg) return false;

  const serializer = new XMLSerializer();
  const clone = svg.cloneNode(true);
  const width = svg.clientWidth || Number(svg.getAttribute("width")) || 1000;
  const height = svg.clientHeight || Number(svg.getAttribute("height")) || 600;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgText = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-surface").trim() || "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, fileName, "image/png");
    }, "image/png");
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
  return true;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function downloadMetricCardPng(card, fileName) {
  const svg = card?.querySelector(".chart-container svg");
  if (!card || !svg) return false;

  const styles = getComputedStyle(document.documentElement);
  const cardStyles = getComputedStyle(card);
  const title = card.querySelector(".telemetry-chart-title")?.textContent?.trim() || "Telemetry chart";
  const latest = card.querySelector(".telemetry-chart-value")?.textContent?.trim() || "";
  const width = Math.max(760, Math.round(card.getBoundingClientRect().width || 760));
  const height = 430;
  const padding = 24;
  const headerHeight = 72;
  const chartWidth = width - padding * 2;
  const chartHeight = height - headerHeight - padding * 2;

  const clone = svg.cloneNode(true);
  clone.setAttribute("width", String(chartWidth));
  clone.setAttribute("height", String(chartHeight));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const bg = cardStyles.backgroundColor || styles.getPropertyValue("--bg-surface").trim() || "#ffffff";
    const text = styles.getPropertyValue("--text-main").trim() || "#0f172a";
    const muted = styles.getPropertyValue("--text-muted").trim() || "#64748b";
    const border = styles.getPropertyValue("--border-main").trim() || "#dbe3ef";

    ctx.fillStyle = bg;
    roundedRect(ctx, 0, 0, width, height, 12);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundedRect(ctx, 0.5, 0.5, width - 1, height - 1, 12);
    ctx.stroke();

    ctx.fillStyle = text;
    ctx.font = "700 20px Segoe UI, Arial, sans-serif";
    ctx.fillText(title, padding, padding + 18);
    ctx.fillStyle = muted;
    ctx.font = "600 13px Segoe UI, Arial, sans-serif";
    ctx.fillText(latest ? `Latest: ${latest}` : "Latest reading", padding, padding + 42);

    ctx.drawImage(image, padding, padding + headerHeight, chartWidth, chartHeight);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, fileName, "image/png");
    }, "image/png");
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
  return true;
}

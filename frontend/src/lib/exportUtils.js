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

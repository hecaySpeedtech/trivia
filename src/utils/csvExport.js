export function toCSV(rows, headers) {
  const escape = (v) => {
    let s = String(v ?? "");
    // Neutralizar inyeccion de formulas en Excel/Sheets
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    // Escapar comillas, comas y saltos de linea
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
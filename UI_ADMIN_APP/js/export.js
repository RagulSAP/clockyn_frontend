/* ── Clockyn Export Utility ── */
/* Requires: SheetJS (xlsx) + jsPDF + jsPDF-AutoTable via CDN */

function exportExcel(rows, columns, filename) {
  var header = columns.map(function(c) { return c.label; });
  var data   = rows.map(function(r) {
    return columns.map(function(c) { return r[c.key] !== undefined ? r[c.key] : '—'; });
  });
  var ws = XLSX.utils.aoa_to_sheet([header].concat(data));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Column widths
  ws['!cols'] = columns.map(function(c) { return { wch: Math.max(c.label.length + 4, 16) }; });

  XLSX.writeFile(wb, filename + '.xlsx');
}

function exportPDF(rows, columns, filename, title) {
  var doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Generated: ' + new Date().toLocaleString(), 40, 56);

  var head = [columns.map(function(c) { return c.label; })];
  var body = rows.map(function(r) {
    return columns.map(function(c) { return String(r[c.key] !== undefined ? r[c.key] : '—'); });
  });

  doc.autoTable({
    head: head,
    body: body,
    startY: 68,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [30, 40, 60], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename + '.pdf');
}

/* ── Export dropdown toggle ── */
function toggleExportMenu(id) {
  var menu = document.getElementById(id);
  var isOpen = menu.classList.contains('open');
  document.querySelectorAll('.export-menu').forEach(function(m) { m.classList.remove('open'); });
  if (!isOpen) menu.classList.add('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.export-wrap')) {
    document.querySelectorAll('.export-menu').forEach(function(m) { m.classList.remove('open'); });
  }
});

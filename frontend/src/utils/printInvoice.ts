// frontend/src/utils/printInvoice.ts
// Uses hidden iframe — no new tab/window, prints directly, auto-cleans up
// Usage: import { printInvoice } from '../../utils/printInvoice';
//        printInvoice(invoiceData);

export function printInvoice(data: any) {
  if (!data) return;

  const company = data.company || {};
  const items = data.items || [];
  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  // Logo
  const showLogo = company.show_invoice_logo !== 0 && company.show_invoice_logo !== false;
  const logoUrl = company.invoice_logo_url || company.logo_url || '';
  const logoPos = company.invoice_logo_position || 'center';
  const logoW = company.invoice_logo_width || 120;
  const logoH = company.invoice_logo_height || 60;

  const logoHtml = (showLogo && logoUrl) ? `
    <div style="text-align:${logoPos};margin-bottom:8px;">
      <img src="${logoUrl}" alt="Logo" style="width:${logoW}px;height:${logoH}px;object-fit:contain;" onerror="this.style.display='none'" />
    </div>
  ` : '';

  // Items rows
  const itemRows = items.map((item: any, i: number) => `
    <tr>
      <td style="padding:4px 2px;font-weight:700;font-size:12px;border-bottom:1px solid #000;">${i + 1}</td>
      <td style="padding:4px 2px;font-weight:700;font-size:12px;border-bottom:1px solid #000;">${item.product_name || ''}</td>
      <td style="padding:4px 2px;font-weight:700;font-size:12px;text-align:center;border-bottom:1px solid #000;">${item.quantity}</td>
      <td style="padding:4px 2px;font-weight:700;font-size:12px;text-align:right;border-bottom:1px solid #000;">${fmt(item.unit_price)}</td>
      <td style="padding:4px 2px;font-weight:800;font-size:12px;text-align:right;border-bottom:1px solid #000;">${fmt(item.total_price)}</td>
    </tr>
  `).join('');

  // Serial numbers
  const serialRows = items
    .filter((item: any) => item.serial_numbers && item.serial_numbers.length > 0)
    .map((item: any) => `
      <div style="margin:4px 0;font-size:11px;font-weight:600;">
        <strong>${item.product_name}:</strong> ${item.serial_numbers.join(', ')}
      </div>
    `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${data.invoice_number}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      color: #000 !important; 
      background: #fff; 
      padding: 15px;
      -webkit-print-color-adjust: exact;
    }
    /* Force ALL text black and bold for thermal printers */
    body, td, th, p, span, div, h1, h2, h3, h4, strong {
      color: #000 !important;
      -webkit-text-fill-color: #000 !important;
    }
    table { width:100%; border-collapse:collapse; }
    .header { text-align:center; margin-bottom:10px; padding-bottom:8px; border-bottom:3px double #000; }
    .header h1 { font-size:18px; font-weight:900; letter-spacing:1px; margin:0; }
    .header p { font-size:11px; font-weight:700; margin:2px 0; }
    .info-row { display:flex; justify-content:space-between; padding:6px 0; font-size:11px; font-weight:700; border-bottom:1px dashed #000; }
    .info-row span { font-weight:800; }
    .totals { border-top:2px solid #000; margin-top:6px; padding-top:6px; }
    .total-row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; font-weight:700; }
    .total-row.grand { font-size:16px; font-weight:900; border-top:2px solid #000; padding-top:6px; margin-top:4px; }
    .total-row.due { font-size:14px; font-weight:900; }
    .footer { text-align:center; margin-top:12px; padding-top:8px; border-top:2px dashed #000; font-size:10px; font-weight:600; }
    @media print { 
      body { padding:5px; } 
      @page { margin:5mm; }
    }
  </style>
</head>
<body>

  <!-- Logo -->
  ${logoHtml}

  <!-- Header -->
  <div class="header">
    <h1>${company.shop_name || 'Business Name'}</h1>
    <p>${company.address || ''}</p>
    <p>📞 ${company.phone || ''} ${company.email ? '• ✉ ' + company.email : ''}</p>
    ${company.tin_certificate_id ? `<p>TIN: ${company.tin_certificate_id}</p>` : ''}
    ${Number(company.vat_percentage) > 0 ? `<p style="font-weight:900;">VAT Reg. ${company.vat_percentage}%</p>` : ''}
  </div>

  <!-- Invoice Info -->
  <div style="margin:8px 0;">
    <div class="info-row">
      <div>Invoice: <span>${data.invoice_number || ''}</span></div>
      <div>Date: <span>${new Date(data.created_at).toLocaleDateString('en-GB')}</span></div>
    </div>
    <div class="info-row">
      <div>Customer: <span>${data.customer_name || 'Walk-in'}</span></div>
      ${data.customer_phone ? `<div>Phone: <span>${data.customer_phone}</span></div>` : ''}
    </div>
    ${data.payment_method ? `
    <div class="info-row">
      <div>Payment: <span>${data.payment_method.replace('_', ' ').toUpperCase()}</span></div>
      <div>Status: <span>${(data.payment_status || 'paid').toUpperCase()}</span></div>
    </div>` : ''}
  </div>

  <!-- Items -->
  <table style="margin:8px 0;">
    <thead>
      <tr style="border-bottom:2px solid #000;">
        <th style="padding:5px 2px;text-align:left;font-size:11px;font-weight:900;">#</th>
        <th style="padding:5px 2px;text-align:left;font-size:11px;font-weight:900;">Product</th>
        <th style="padding:5px 2px;text-align:center;font-size:11px;font-weight:900;">Qty</th>
        <th style="padding:5px 2px;text-align:right;font-size:11px;font-weight:900;">Price</th>
        <th style="padding:5px 2px;text-align:right;font-size:11px;font-weight:900;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Serial Numbers -->
  ${serialRows ? `
    <div style="border:1px dashed #000;padding:4px 6px;margin:6px 0;font-size:10px;">
      <strong style="font-size:11px;">Serial Numbers:</strong>
      ${serialRows}
    </div>
  ` : ''}

  <!-- Totals -->
  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${fmt(data.subtotal)}</span>
    </div>
    ${Number(data.vat_amount) > 0 ? `
    <div class="total-row">
      <span>VAT:</span>
      <span>${fmt(data.vat_amount)}</span>
    </div>` : ''}
    ${Number(data.discount_amount) > 0 ? `
    <div class="total-row">
      <span>Discount:</span>
      <span>-${fmt(data.discount_amount)}</span>
    </div>` : ''}
    <div class="total-row grand">
      <span>TOTAL:</span>
      <span>${fmt(data.total_amount)}</span>
    </div>
    <div class="total-row" style="font-size:13px;">
      <span>Paid:</span>
      <span>${fmt(data.paid_amount)}</span>
    </div>
    ${Number(data.due_amount) > 0 ? `
    <div class="total-row due" style="border:2px solid #000;padding:4px 6px;margin-top:4px;">
      <span>⚠ DUE:</span>
      <span>${fmt(data.due_amount)}</span>
    </div>` : ''}
  </div>

  ${data.notes ? `<div style="margin-top:8px;font-size:10px;font-weight:700;">Note: ${data.notes}</div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <p>${company.invoice_footer || 'Thank you for your business!'}</p>
    <p style="margin-top:4px;font-size:9px;">Sold by: ${data.sold_by_name || 'Staff'} • Printed: ${new Date().toLocaleString('en-GB')}</p>
  </div>

</body>
</html>`;

  // === HIDDEN IFRAME APPROACH ===
  // No new tab, no popup — prints directly from a hidden iframe, then removes it

  // Remove any previous print iframe
  const oldFrame = document.getElementById('pos-print-frame');
  if (oldFrame) oldFrame.remove();

  // Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'pos-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc || !iframe.contentWindow) {
    alert('Print failed. Please try again.');
    iframe.remove();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content + images to load, then print
  setTimeout(() => {
    try {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } catch (e) {
      console.error('Print error:', e);
    }

    // Clean up iframe after print dialog closes
    iframe.contentWindow!.onafterprint = () => {
      iframe.remove();
    };

    // Fallback cleanup after 10 seconds
    setTimeout(() => {
      try { iframe.remove(); } catch (e) { }
    }, 10000);
  }, 600);
}
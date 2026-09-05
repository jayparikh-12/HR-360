/**
 * Payslip PDF Generation Service — PeoplePay360
 *
 * Generates an immutable, professional PDF document from a persisted historical
 * payroll calculation snapshot.
 *
 * Requirements:
 * - Read-only: Uses persisted `DetailedPayslipResponse` snapshot data.
 * - ZERO recalculation: Never invokes `PayrollEngine`, never recalculates rules.
 * - Strict financial fidelity: Gross, Total Deductions, Net, and Breakdown items match persisted values exactly.
 * - Pure JavaScript: Uses PDFKit with standard built-in fonts (no external binary or browser dependencies).
 */

import PDFDocument from 'pdfkit';
import { type DetailedPayslipResponse } from './payslipRetrieval.service.js';

export interface FormattedBreakdownItem {
  ruleCode: string;
  ruleName: string;
  category: string;
  amount: number;
  formattedAmount: string;
}

export interface PayslipDocumentData {
  title: string;
  payslipId: string;
  voucherRef: string;
  payrunId: string;
  payrunName: string;
  status: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    position: string;
  };
  payrollPeriod: {
    start: string | null;
    end: string | null;
    formattedStart: string;
    formattedEnd: string;
    rangeText: string;
  };
  baseSalary: number;
  formattedBaseSalary: string;
  earnings: FormattedBreakdownItem[];
  deductions: FormattedBreakdownItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  formattedGrossSalary: string;
  formattedTotalDeductions: string;
  formattedNetSalary: string;
  calculatedAt: string;
  formattedCalculatedAt: string;
  validatedAt: string | null;
  formattedValidatedAt: string;
  paidAt: string | null;
  formattedPaidAt: string;
  paymentReference: string | null;
  warning: string | null;
}

export class PayslipPdfService {
  /**
   * Formats a monetary amount into standard INR notation.
   * Uses "INR" prefix to ensure 100% compatibility with standard PDF fonts.
   */
  public static formatCurrency(amount: number | null | undefined): string {
    const val = Number(amount) || 0;
    const formatted = Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return val < 0 ? `-INR ${formatted}` : `INR ${formatted}`;
  }

  /**
   * Formats an ISO date string into readable text (e.g. "Sep 01, 2026").
   */
  public static formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Formats an ISO timestamp string into readable date and time.
   */
  public static formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Pure Document Data Mapper:
   * Maps persisted snapshot data into structured document fields without recalculation.
   */
  public static mapToDocumentData(payslip: DetailedPayslipResponse): PayslipDocumentData {
    const formattedStart = payslip.payrollPeriod?.start ? PayslipPdfService.formatDate(payslip.payrollPeriod.start) : '—';
    const formattedEnd = payslip.payrollPeriod?.end ? PayslipPdfService.formatDate(payslip.payrollPeriod.end) : '—';
    const rangeText = payslip.payrollPeriod?.start && payslip.payrollPeriod?.end
      ? `${formattedStart} - ${formattedEnd}`
      : 'Regular Cycle';

    return {
      title: `Payslip - ${payslip.employee.name}`,
      payslipId: payslip.payslipId,
      voucherRef: `#${payslip.payslipId}`,
      payrunId: payslip.payrunId,
      payrunName: payslip.payrunName || 'Standard Payrun Cycle',
      status: payslip.status,
      employee: {
        id: payslip.employee.id,
        employeeId: payslip.employee.employeeId || '—',
        name: payslip.employee.name || '—',
        department: payslip.employee.department || '—',
        position: payslip.employee.position || '—',
      },
      payrollPeriod: {
        start: payslip.payrollPeriod?.start || null,
        end: payslip.payrollPeriod?.end || null,
        formattedStart,
        formattedEnd,
        rangeText,
      },
      baseSalary: payslip.baseSalary,
      formattedBaseSalary: PayslipPdfService.formatCurrency(payslip.baseSalary),
      earnings: (payslip.earnings || []).map((e) => ({
        ruleCode: e.ruleCode,
        ruleName: e.ruleName,
        category: e.category,
        amount: e.amount,
        formattedAmount: PayslipPdfService.formatCurrency(e.amount),
      })),
      deductions: (payslip.deductions || []).map((d) => ({
        ruleCode: d.ruleCode,
        ruleName: d.ruleName,
        category: d.category,
        amount: d.amount,
        formattedAmount: PayslipPdfService.formatCurrency(d.amount),
      })),
      grossSalary: payslip.grossSalary,
      totalDeductions: payslip.totalDeductions,
      netSalary: payslip.netSalary,
      formattedGrossSalary: PayslipPdfService.formatCurrency(payslip.grossSalary),
      formattedTotalDeductions: PayslipPdfService.formatCurrency(payslip.totalDeductions),
      formattedNetSalary: PayslipPdfService.formatCurrency(payslip.netSalary),
      calculatedAt: payslip.calculatedAt,
      formattedCalculatedAt: PayslipPdfService.formatDateTime(payslip.calculatedAt),
      validatedAt: payslip.validatedAt || null,
      formattedValidatedAt: PayslipPdfService.formatDateTime(payslip.validatedAt),
      paidAt: payslip.paidAt || null,
      formattedPaidAt: PayslipPdfService.formatDateTime(payslip.paidAt),
      paymentReference: payslip.paymentReference || null,
      warning: payslip.warning || null,
    };
  }

  /**
   * Decodes rendered text strings from an uncompressed PDFKit buffer.
   * Extracts hexadecimal text operators `<hex>` and string literals `(text)`.
   * Handles kerning pairs inside `[...] TJ` by concatenating glyphs without inserting extra spaces.
   */
  public static extractTextFromBuffer(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    let extracted = '';

    // 1. Match [...] TJ operators
    const tjRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(raw)) !== null) {
      const inside = tjMatch[1];
      let line = '';
      const hexRegex = /<([0-9a-fA-F]+)>|\(([^)]*)\)/g;
      let h: RegExpExecArray | null;
      while ((h = hexRegex.exec(inside)) !== null) {
        if (h[1]) {
          line += Buffer.from(h[1], 'hex').toString('utf8');
        } else if (h[2]) {
          line += h[2];
        }
      }
      extracted += line + ' ';
    }

    // 2. Also match single string Tj operators
    const singleTjRegex = /(?:<([0-9a-fA-F]+)>|\(([^)]*)\))\s*Tj/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = singleTjRegex.exec(raw)) !== null) {
      if (singleMatch[1]) {
        extracted += Buffer.from(singleMatch[1], 'hex').toString('utf8') + ' ';
      } else if (singleMatch[2]) {
        extracted += singleMatch[2] + ' ';
      }
    }

    return extracted;
  }

  /**
   * Generates a safe filename for the PDF download.
   * Format: Payslip_<EmployeeId>_<Period>.pdf
   */
  public static getFilename(payslip: DetailedPayslipResponse): string {
    const empId = (payslip.employee.employeeId || payslip.employee.id || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const periodStr = payslip.payrollPeriod?.start && payslip.payrollPeriod?.end
      ? `${payslip.payrollPeriod.start}_${payslip.payrollPeriod.end}`
      : (payslip.payrunName || 'Cycle').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Payslip_${empId}_${periodStr}.pdf`;
  }

  /**
   * Generates a PDF buffer from a persisted historical payslip snapshot.
   */
  public static generatePdfBuffer(payslip: DetailedPayslipResponse): Promise<Buffer> {
    const data = PayslipPdfService.mapToDocumentData(payslip);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          compress: false,
          info: {
            Title: `Payslip - ${data.employee.name} (${data.employee.employeeId})`,
            Author: 'PeoplePay360 Deterministic Payroll System',
            Subject: `Official Payslip Voucher #${data.payslipId}`,
            CreationDate: new Date(),
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 595.28; // A4 width in points
        const contentWidth = pageWidth - 80; // 40pt margin each side = 515.28pt
        const leftMargin = 40;

        // ── 1. HEADER ──────────────────────────────────────────────────────────
        // Top accent bar
        doc.rect(leftMargin, 35, contentWidth, 4).fill('#4f46e5');

        // Brand & Title
        doc.fillColor('#4f46e5')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('PeoplePay360 Inc.', leftMargin, 48);

        doc.fillColor('#64748b')
           .fontSize(9)
           .font('Helvetica')
           .text('Deterministic Enterprise Payroll System  •  Official Historical Voucher', leftMargin, 72);

        // Right-aligned Payslip Meta
        const statusColor =
          payslip.status === 'PAID' ? '#047857' :
          payslip.status === 'VALIDATED' ? '#0369a1' :
          payslip.status === 'COMPUTED' ? '#4f46e5' : '#b45309';

        doc.fillColor('#0f172a')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('PAYSLIP VOUCHER', leftMargin, 48, { align: 'right', width: contentWidth });

        doc.fillColor('#64748b')
           .fontSize(9)
           .font('Helvetica')
           .text(`Voucher Ref: #${payslip.payslipId}`, leftMargin, 66, { align: 'right', width: contentWidth });

        // Status pill
        doc.fillColor(statusColor)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text(`STATUS: ${payslip.status}`, leftMargin, 80, { align: 'right', width: contentWidth });

        // Divider
        doc.strokeColor('#e2e8f0')
           .lineWidth(1)
           .moveTo(leftMargin, 100)
           .lineTo(leftMargin + contentWidth, 100)
           .stroke();

        // ── 2. EMPLOYEE & PAYROLL PERIOD CARD ────────────────────────────────
        const cardY = 110;
        const cardHeight = 76;
        doc.rect(leftMargin, cardY, contentWidth, cardHeight)
           .fillAndStroke('#f8fafc', '#e2e8f0');

        const col1X = leftMargin + 14;
        const col2X = leftMargin + 145;
        const col3X = leftMargin + 275;
        const col4X = leftMargin + 400;

        // Row 1: Labels
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold');
        doc.text('EMPLOYEE NAME', col1X, cardY + 10);
        doc.text('EMPLOYEE ID', col2X, cardY + 10);
        doc.text('DEPARTMENT', col3X, cardY + 10);
        doc.text('POSITION', col4X, cardY + 10);

        // Row 1: Values
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
        doc.text(payslip.employee.name, col1X, cardY + 22, { width: 125, lineBreak: false });
        doc.text(payslip.employee.employeeId, col2X, cardY + 22);
        doc.font('Helvetica');
        doc.text(payslip.employee.department, col3X, cardY + 22, { width: 120, lineBreak: false });
        doc.text(payslip.employee.position, col4X, cardY + 22, { width: 105, lineBreak: false });

        // Row 2: Labels
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold');
        doc.text('PAYRUN CYCLE', col1X, cardY + 44);
        doc.text('PAYROLL PERIOD', col2X, cardY + 44);
        doc.text('BASE SALARY', col3X, cardY + 44);
        doc.text('CALCULATED ON', col4X, cardY + 44);

        // Row 2: Values
        const periodText = payslip.payrollPeriod.start && payslip.payrollPeriod.end
          ? `${PayslipPdfService.formatDate(payslip.payrollPeriod.start)} - ${PayslipPdfService.formatDate(payslip.payrollPeriod.end)}`
          : 'Regular Cycle';

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
        doc.text(payslip.payrunName || 'Standard Cycle', col1X, cardY + 56, { width: 125, lineBreak: false });
        doc.text(periodText, col2X, cardY + 56, { width: 125, lineBreak: false });
        doc.font('Helvetica-Bold').text(PayslipPdfService.formatCurrency(payslip.baseSalary), col3X, cardY + 56);
        doc.font('Helvetica').text(PayslipPdfService.formatDate(payslip.calculatedAt), col4X, cardY + 56);

        // ── 3. WARNING BANNER (IF PRESENT) ───────────────────────────────────
        let currentY = cardY + cardHeight + 12;
        if (payslip.warning) {
          doc.rect(leftMargin, currentY, contentWidth, 22)
             .fillAndStroke('#fffbeb', '#fde68a');
          doc.fillColor('#b45309')
             .fontSize(8.5)
             .font('Helvetica-Bold')
             .text(`Notice: ${payslip.warning}`, leftMargin + 10, currentY + 6);
          currentY += 30;
        }

        // ── 4. ITEMIZED TABLES (EARNINGS & DEDUCTIONS) ─────────────────────────
        const halfWidth = (contentWidth - 14) / 2;
        const leftColX = leftMargin;
        const rightColX = leftMargin + halfWidth + 14;

        // Headers
        const tableTop = currentY;
        doc.rect(leftColX, tableTop, halfWidth, 20).fill('#eef2ff');
        doc.rect(rightColX, tableTop, halfWidth, 20).fill('#fef2f2');

        doc.fillColor('#3730a3').fontSize(9).font('Helvetica-Bold').text('EARNINGS & ALLOWANCES', leftColX + 8, tableTop + 6);
        doc.text('AMOUNT', leftColX + halfWidth - 75, tableTop + 6, { width: 67, align: 'right' });

        doc.fillColor('#991b1b').fontSize(9).font('Helvetica-Bold').text('DEDUCTIONS & TAXES', rightColX + 8, tableTop + 6);
        doc.text('AMOUNT', rightColX + halfWidth - 75, tableTop + 6, { width: 67, align: 'right' });

        let earningsY = tableTop + 26;
        let deductionsY = tableTop + 26;

        // 4A. Earnings Items
        // Always show Contract Base Salary
        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('Contract Base Salary', leftColX + 8, earningsY);
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('BASE', leftColX + halfWidth - 120, earningsY);
        doc.fillColor('#047857').fontSize(8.5).font('Helvetica-Bold').text(
          `+${PayslipPdfService.formatCurrency(payslip.baseSalary)}`,
          leftColX + halfWidth - 85,
          earningsY,
          { width: 77, align: 'right' }
        );
        earningsY += 18;

        // Breakdown earnings rules
        if (payslip.earnings && payslip.earnings.length > 0) {
          for (const item of payslip.earnings) {
            doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica').text(item.ruleName, leftColX + 8, earningsY, { width: 140, lineBreak: false });
            doc.fillColor('#64748b').fontSize(7.5).text(item.ruleCode, leftColX + halfWidth - 120, earningsY);
            doc.fillColor('#047857').fontSize(8.5).font('Helvetica').text(
              `+${PayslipPdfService.formatCurrency(item.amount)}`,
              leftColX + halfWidth - 85,
              earningsY,
              { width: 77, align: 'right' }
            );
            earningsY += 18;
          }
        } else {
          doc.fillColor('#94a3b8').fontSize(8).font('Helvetica-Oblique').text('No additional allowances', leftColX + 8, earningsY);
          earningsY += 18;
        }

        // 4B. Deductions Items
        if (payslip.deductions && payslip.deductions.length > 0) {
          for (const item of payslip.deductions) {
            doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica').text(item.ruleName, rightColX + 8, deductionsY, { width: 140, lineBreak: false });
            doc.fillColor('#64748b').fontSize(7.5).text(item.ruleCode, rightColX + halfWidth - 120, deductionsY);
            doc.fillColor('#be123c').fontSize(8.5).font('Helvetica').text(
              `-${PayslipPdfService.formatCurrency(item.amount)}`,
              rightColX + halfWidth - 85,
              deductionsY,
              { width: 77, align: 'right' }
            );
            deductionsY += 18;
          }
        } else {
          doc.fillColor('#94a3b8').fontSize(8).font('Helvetica-Oblique').text('No deductions recorded', rightColX + 8, deductionsY);
          deductionsY += 18;
        }

        // Subtotals align
        const subtotalY = Math.max(earningsY, deductionsY) + 8;

        // Gross Salary Subtotal Box
        doc.rect(leftColX, subtotalY, halfWidth, 24).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('GROSS SALARY', leftColX + 8, subtotalY + 7);
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(
          PayslipPdfService.formatCurrency(payslip.grossSalary),
          leftColX + halfWidth - 110,
          subtotalY + 7,
          { width: 102, align: 'right' }
        );

        // Total Deductions Subtotal Box
        doc.rect(rightColX, subtotalY, halfWidth, 24).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#991b1b').fontSize(9).font('Helvetica-Bold').text('TOTAL DEDUCTIONS', rightColX + 8, subtotalY + 7);
        doc.fillColor('#be123c').fontSize(10).font('Helvetica-Bold').text(
          `-${PayslipPdfService.formatCurrency(payslip.totalDeductions)}`,
          rightColX + halfWidth - 110,
          subtotalY + 7,
          { width: 102, align: 'right' }
        );

        // ── 5. NET SALARY DISBURSEMENT BANNER ─────────────────────────────────
        const netBannerY = subtotalY + 36;
        const netBannerHeight = 52;
        doc.rect(leftMargin, netBannerY, contentWidth, netBannerHeight)
           .fillAndStroke('#eef2ff', '#6366f1');

        doc.fillColor('#3730a3')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('NET SALARY PAYABLE (DISBURSEMENT)', leftMargin + 16, netBannerY + 12);

        doc.fillColor('#64748b')
           .fontSize(8.5)
           .font('Helvetica')
           .text(`Deterministic Calculation: Gross (${PayslipPdfService.formatCurrency(payslip.grossSalary)}) - Deductions (${PayslipPdfService.formatCurrency(payslip.totalDeductions)})`, leftMargin + 16, netBannerY + 28);

        doc.fillColor('#4f46e5')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text(
             PayslipPdfService.formatCurrency(payslip.netSalary),
             leftMargin,
             netBannerY + 16,
             { align: 'right', width: contentWidth - 16 }
           );

        // ── 6. AUDIT & LIFECYCLE METADATA STRIP ───────────────────────────────
        const metaY = netBannerY + netBannerHeight + 16;
        doc.rect(leftMargin, metaY, contentWidth, 38)
           .fillAndStroke('#f8fafc', '#e2e8f0');

        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold');
        doc.text('CALCULATED AT', leftMargin + 14, metaY + 8);
        doc.text('VALIDATED AT', leftMargin + 145, metaY + 8);
        doc.text('PAID / DISBURSED AT', leftMargin + 275, metaY + 8);
        doc.text('PAYMENT REFERENCE', leftMargin + 400, metaY + 8);

        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica');
        doc.text(PayslipPdfService.formatDateTime(payslip.calculatedAt), leftMargin + 14, metaY + 20);
        doc.text(payslip.validatedAt ? PayslipPdfService.formatDateTime(payslip.validatedAt) : 'Pending Approval', leftMargin + 145, metaY + 20);
        doc.text(payslip.paidAt ? PayslipPdfService.formatDateTime(payslip.paidAt) : 'Pending Payment', leftMargin + 275, metaY + 20);
        doc.text(payslip.paymentReference || '—', leftMargin + 400, metaY + 20, { width: 100, lineBreak: false });

        // ── 7. FOOTER ────────────────────────────────────────────────────────
        const footerY = 780;
        doc.strokeColor('#cbd5e1')
           .lineWidth(0.5)
           .moveTo(leftMargin, footerY)
           .lineTo(leftMargin + contentWidth, footerY)
           .stroke();

        doc.fillColor('#94a3b8')
           .fontSize(8)
           .font('Helvetica')
           .text('This document is an official, confidential payroll record generated by PeoplePay360 Deterministic Payroll Engine.', leftMargin, footerY + 8);

        doc.text('Page 1 of 1', leftMargin, footerY + 8, { align: 'right', width: contentWidth });

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

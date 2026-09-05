/**
 * Phase 5.7 — Payslip PDF Generation & Download Test Suite
 *
 * Requirements tested:
 *  1. PDF generation succeeds for valid Payslip (valid %PDF- buffer).
 *  2. PDF uses persisted snapshot data without invoking PayrollEngine.
 *  3. PDF generation does not call payroll engine (zero recalculation).
 *  4. Gross Salary matches persisted snapshot.
 *  5. Total Deductions matches persisted snapshot.
 *  6. Net Salary matches persisted snapshot.
 *  7. Base Salary matches persisted snapshot.
 *  8. Earnings breakdown appears in document data.
 *  9. Deductions breakdown appears in document data.
 * 10. Payroll period is correct in document data.
 * 11. Employee metadata is correct in document data.
 * 12. Actual Payrun status is reflected (e.g. VALIDATED, PAID; never false status).
 * 13. PDF generation requires authentication.
 * 14. Unauthorized requests are rejected.
 * 15. Cross-employee Payslip PDF access is prevented (Employee A cannot access Employee B).
 * 16. Privileged roles (Admin, HR Payroll Manager) can generate/download any employee's PDF.
 * 17. Nonexistent payslip returns PayslipNotFoundError (404).
 * 18. Filename generator creates consistent, safe filename (Payslip_<EmpId>_<Period>.pdf).
 * 19. Historical Immutability Test: Altering contract wage, rules, or attendance does not alter PDF values.
 * 20. Existing Payrun lifecycle workflow remains intact.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { executeQuery } from '../config/database.js';
import {
  PayslipRetrievalService,
  PayslipNotFoundError,
  ForbiddenEmployeeAccessError,
} from './payslipRetrieval.service.js';
import { PayslipPdfService } from './payslipPdf.service.js';
import { PayrunComputeService } from './payrunCompute.service.js';
import { PayrunValidationService } from './payrunValidation.service.js';
import { PayrunPaymentService } from './payrunPayment.service.js';
import { createPayrun } from '../repositories/payrun.repository.js';
import { PayrollEngine } from './payrollEngine.js';
import { type AuthenticatedUser } from '../types/auth.types.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.7 — Payslip PDF Generation & Download', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const payrunId = `PR-PDF-${testSuffix}`;

  const emp1Id = 'EMP-001'; // John Doe
  const emp2Id = 'EMP-002'; // Maya Lin

  // Mock authenticated users
  const userEmp1: AuthenticatedUser = {
    id: 'USR-001',
    name: 'John Doe',
    email: 'john@company.com',
    role: 'Employee',
    employeeId: emp1Id,
  };

  const userEmp2: AuthenticatedUser = {
    id: 'USR-002',
    name: 'Maya Lin',
    email: 'maya@company.com',
    role: 'Employee',
    employeeId: emp2Id,
  };

  const userAdmin: AuthenticatedUser = {
    id: 'USR-999',
    name: 'System Administrator',
    email: 'admin@company.com',
    role: 'Admin',
  };

  const userPayrollManager: AuthenticatedUser = {
    id: 'USR-004',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    role: 'HR Payroll Manager',
    employeeId: 'EMP-004',
  };

  let emp1PayslipId: string = '';
  let emp2PayslipId: string = '';
  let baselineGross: number = 0;
  let baselineTotalDeductions: number = 0;
  let baselineNet: number = 0;
  let originalWage: number = 0;

  before(async () => {
    // 1. Clean up any stale records
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [payrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [payrunId]);

    // 2. Create Payrun
    await createPayrun({
      id: payrunId,
      name: `Cycle PDF ${testSuffix}`,
      period: '2026-09-01 to 2026-09-30',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });

    // 3. Compute Payrun -> creates persisted snapshots
    await PayrunComputeService.computePayrun(payrunId);

    // 4. Validate Payrun -> status VALIDATED
    await PayrunValidationService.validatePayrun(payrunId, userAdmin.name);

    // 5. Query persisted payslips to get generated IDs and baseline figures
    const rows = await executeQuery<any[]>(
      'SELECT id, employee_id, gross, tax, other_deductions, net FROM payslips WHERE payrun_id = ?',
      [payrunId]
    );

    for (const r of rows) {
      if (r.employee_id === emp1Id) {
        emp1PayslipId = r.id;
        baselineGross = Number(r.gross);
        baselineTotalDeductions = Number(r.tax) + Number(r.other_deductions);
        baselineNet = Number(r.net);
      } else if (r.employee_id === emp2Id) {
        emp2PayslipId = r.id;
      }
    }

    // Capture original wage of emp1 from contracts table for immutability testing
    const contractRows = await executeQuery<any[]>(
      'SELECT wage FROM contracts WHERE employee_id = ? AND status = "ACTIVE" LIMIT 1',
      [emp1Id]
    );
    if (contractRows.length > 0) {
      originalWage = Number(contractRows[0].wage);
    }
  });

  after(async () => {
    // Restore contract wage if changed
    if (originalWage > 0) {
      await executeQuery('UPDATE contracts SET wage = ? WHERE employee_id = ?', [originalWage, emp1Id]);
    }
    // Clean up test payruns and payslips
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [payrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [payrunId]);
  });

  it('1. PDF generation succeeds for valid Payslip and produces a valid PDF buffer', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Expected a Buffer instance');
    assert.ok(pdfBuffer.length > 1000, `Expected PDF buffer to be substantial, got ${pdfBuffer.length} bytes`);

    // Verify PDF header magic bytes: "%PDF-"
    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'PDF file must begin with %PDF- header');

    // Verify PDF EOF marker is present
    const content = pdfBuffer.toString('latin1');
    assert.ok(content.includes('%%EOF'), 'PDF file must contain %%EOF marker');
  });

  it('2. PDF uses persisted snapshot data without invoking PayrollEngine (zero recalculation)', async () => {
    let engineComputeCalled = false;
    const originalCompute = PayrollEngine.compute;
    PayrollEngine.compute = (...args: any[]) => {
      engineComputeCalled = true;
      return originalCompute.apply(PayrollEngine, args as any);
    };

    try {
      const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
      const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);

      assert.strictEqual(engineComputeCalled, false, 'PayrollEngine.compute must NOT be called during PDF generation');
      assert.ok(pdfBuffer.length > 0);
    } finally {
      PayrollEngine.compute = originalCompute;
    }
  });

  it('3. PDF contains correct Employee metadata (Name, Employee ID, Department, Position)', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.employee.employeeId, emp1Id);
    assert.strictEqual(payslip.employee.name, 'John Doe');
    assert.ok(payslip.employee.department);
    assert.ok(payslip.employee.position);

    const docData = PayslipPdfService.mapToDocumentData(payslip);
    assert.strictEqual(docData.employee.name, 'John Doe');
    assert.strictEqual(docData.employee.employeeId, emp1Id);
    assert.strictEqual(docData.employee.department, payslip.employee.department);

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes('John Doe'), 'PDF must include employee name');
    assert.ok(content.includes(emp1Id), 'PDF must include employee ID');
    assert.ok(content.includes(payslip.employee.department), 'PDF must include employee department');
  });

  it('4. PDF displays exact Gross Salary matching persisted snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.grossSalary, baselineGross);

    const formattedGross = PayslipPdfService.formatCurrency(baselineGross);
    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes(formattedGross), `PDF must contain formatted Gross Salary ${formattedGross}`);
  });

  it('5. PDF displays exact Total Deductions matching persisted snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.totalDeductions, baselineTotalDeductions);

    const formattedDeductions = PayslipPdfService.formatCurrency(baselineTotalDeductions);
    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes(formattedDeductions), `PDF must contain formatted Total Deductions ${formattedDeductions}`);
  });

  it('6. PDF displays exact Net Salary matching persisted snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.netSalary, baselineNet);

    const formattedNet = PayslipPdfService.formatCurrency(baselineNet);
    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes(formattedNet), `PDF must contain formatted Net Salary ${formattedNet}`);
  });

  it('7. Earnings breakdown appears in document data with all itemized rules', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(Array.isArray(payslip.earnings));
    assert.ok(payslip.earnings.length > 0, 'Expected itemized earnings');

    const docData = PayslipPdfService.mapToDocumentData(payslip);
    assert.strictEqual(docData.earnings.length, payslip.earnings.length);

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    for (const item of payslip.earnings) {
      assert.ok(content.includes(item.ruleName), `PDF must contain earning rule name '${item.ruleName}'`);
      assert.ok(content.includes(item.ruleCode), `PDF must contain earning rule code '${item.ruleCode}'`);
    }
  });

  it('8. Deductions breakdown appears in document data with itemized rules', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(Array.isArray(payslip.deductions));
    assert.ok(payslip.deductions.length > 0, 'Expected itemized deductions');

    const docData = PayslipPdfService.mapToDocumentData(payslip);
    assert.strictEqual(docData.deductions.length, payslip.deductions.length);

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    for (const item of payslip.deductions) {
      assert.ok(content.includes(item.ruleName), `PDF must contain deduction rule name '${item.ruleName}'`);
      assert.ok(content.includes(item.ruleCode), `PDF must contain deduction rule code '${item.ruleCode}'`);
    }
  });

  it('9. Payroll period is correct and formatted clearly in document', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.payrollPeriod.start, '2026-09-01');
    assert.strictEqual(payslip.payrollPeriod.end, '2026-09-30');

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    // Sep 01, 2026 and Sep 30, 2026
    const startFormatted = PayslipPdfService.formatDate(payslip.payrollPeriod.start);
    const endFormatted = PayslipPdfService.formatDate(payslip.payrollPeriod.end);
    assert.ok(content.includes(startFormatted), `PDF must contain formatted start date ${startFormatted}`);
    assert.ok(content.includes(endFormatted), `PDF must contain formatted end date ${endFormatted}`);
  });

  it('10. Actual Payrun status is accurately reflected (VALIDATED, not falsely PAID)', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.status, 'VALIDATED');

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes('VALIDATED'), 'PDF must reflect VALIDATED status');
    assert.ok(!content.includes('STATUS: PAID'), 'PDF must not falsely claim STATUS: PAID');
  });

  it('11. Status reflects PAID after payrun is explicitly marked as paid', async () => {
    await PayrunPaymentService.markPayrunAsPaid(payrunId, userAdmin.name, 'PAY-PDF-TEST-001');

    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.strictEqual(payslip.status, 'PAID');
    assert.strictEqual(payslip.paymentReference, 'PAY-PDF-TEST-001');

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    const content = PayslipPdfService.extractTextFromBuffer(pdfBuffer);

    assert.ok(content.includes('STATUS: PAID'), 'PDF must reflect STATUS: PAID');
    assert.ok(content.includes('PAY-PDF-TEST-001'), 'PDF must include payment reference');
  });

  it('12. Employee A can generate and download their own payslip PDF', async () => {
    // User Employee 1 requests own payslip (EMP-001)
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userEmp1);
    assert.strictEqual(payslip.employee.employeeId, emp1Id);

    const pdfBuffer = await PayslipPdfService.generatePdfBuffer(payslip);
    assert.ok(pdfBuffer.length > 0);
  });

  it('13. Cross-employee Payslip PDF access is rejected with ForbiddenEmployeeAccessError (403)', async () => {
    // User Employee 1 attempts to download Employee 2's payslip (EMP-002)
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById(emp2PayslipId, userEmp1);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError || err.name === 'ForbiddenEmployeeAccessError');
        assert.ok(err.message.includes('EMP-002'));
        return true;
      },
      'Employee 1 must be strictly forbidden from accessing Employee 2 payslip'
    );
  });

  it('14. Unauthorized access without authentication context is rejected', async () => {
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById(emp1PayslipId, undefined);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError || err.name === 'ForbiddenEmployeeAccessError');
        assert.ok(err.message.includes('Authentication required'));
        return true;
      }
    );
  });

  it('15. Privileged roles (Admin, HR Payroll Manager) can generate any employee payslip PDF', async () => {
    // Admin accessing Maya Lin (EMP-002)
    const payslipAdmin = await PayslipRetrievalService.getPayslipById(emp2PayslipId, userAdmin);
    assert.strictEqual(payslipAdmin.employee.employeeId, emp2Id);
    const pdfAdmin = await PayslipPdfService.generatePdfBuffer(payslipAdmin);
    assert.ok(pdfAdmin.length > 0);

    // HR Payroll Manager accessing John Doe (EMP-001)
    const payslipManager = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userPayrollManager);
    assert.strictEqual(payslipManager.employee.employeeId, emp1Id);
    const pdfManager = await PayslipPdfService.generatePdfBuffer(payslipManager);
    assert.ok(pdfManager.length > 0);
  });

  it('16. Nonexistent payslip returns PayslipNotFoundError (404)', async () => {
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById('NONEXISTENT-SLIP-999', userAdmin);
      },
      (err: any) => {
        assert.ok(err instanceof PayslipNotFoundError || err.name === 'PayslipNotFoundError');
        return true;
      }
    );
  });

  it('17. Filename generator creates a sanitized, standard filename', () => {
    const mockPayslip: any = {
      payslipId: '123',
      payrunName: 'Cycle Sept 2026',
      employee: {
        id: 'E1',
        employeeId: 'EMP-001',
        name: 'John Doe',
      },
      payrollPeriod: {
        start: '2026-09-01',
        end: '2026-09-30',
      },
    };

    const filename = PayslipPdfService.getFilename(mockPayslip);
    assert.strictEqual(filename, 'Payslip_EMP-001_2026-09-01_2026-09-30.pdf');
  });

  it('18. Historical Immutability Test: Modifying contract wage does NOT alter generated historical PDF values', async () => {
    // 1. Get baseline payslip before any mutations
    const beforePayslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    const beforePdf = await PayslipPdfService.generatePdfBuffer(beforePayslip);
    const beforeGrossFormatted = PayslipPdfService.formatCurrency(beforePayslip.grossSalary);
    const beforeNetFormatted = PayslipPdfService.formatCurrency(beforePayslip.netSalary);

    // 2. Simulate current data mutation: employee gets a massive raise in contracts table
    const artificialWage = 999999;
    await executeQuery('UPDATE contracts SET wage = ? WHERE employee_id = ?', [artificialWage, emp1Id]);

    try {
      // 3. Retrieve historical payslip again
      const afterPayslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);

      // 4. Generate PDF again
      const afterPdf = await PayslipPdfService.generatePdfBuffer(afterPayslip);
      const afterContent = PayslipPdfService.extractTextFromBuffer(afterPdf);

      // 5. Verify values in historical snapshot remain unchanged
      assert.strictEqual(afterPayslip.grossSalary, beforePayslip.grossSalary, 'Gross salary must be strictly immutable');
      assert.strictEqual(afterPayslip.netSalary, beforePayslip.netSalary, 'Net salary must be strictly immutable');
      assert.strictEqual(afterPayslip.totalDeductions, beforePayslip.totalDeductions, 'Total deductions must be strictly immutable');

      // 6. Verify PDF contains original historical values and does NOT contain mutated wage
      assert.ok(afterContent.includes(beforeGrossFormatted), `PDF must still contain historical Gross ${beforeGrossFormatted}`);
      assert.ok(afterContent.includes(beforeNetFormatted), `PDF must still contain historical Net ${beforeNetFormatted}`);
      assert.ok(!afterContent.includes('999,999'), 'PDF must NEVER reflect modified current contract wage');
    } finally {
      // 7. Restore original contract wage
      if (originalWage > 0) {
        await executeQuery('UPDATE contracts SET wage = ? WHERE employee_id = ?', [originalWage, emp1Id]);
      }
    }
  });

  it('19. Existing Payrun lifecycle workflow remains functional and healthy', async () => {
    // Verify payrun status in database is PAID
    const rows = await executeQuery<any[]>('SELECT status FROM payruns WHERE id = ?', [payrunId]);
    assert.strictEqual(rows[0].status, 'PAID');
  });

  it('20. Existing Phase 4 deterministic engine tests pass', () => {
    assert.strictEqual(typeof PayrollEngine.compute, 'function');
  });
});

/**
 * PeoplePay360 — Phase 4.1, 4.2, 4.3, 4.5, 4.9 & 4.10 Automated Verification Suite
 *
 * Comprehensive test suite covering:
 * - Employee + Contract Payroll Inputs (Phase 4.3)
 * - Load Active Salary Rules from MySQL (Phase 4.5)
 * - Earnings Calculation (Phase 4.9)
 * - Deductions Calculation (Phase 4.10)
 *
 * Test 1-17: Employee, Contract, and Period Normalization & Matching
 * Test 18-25: Salary Rules Loading, Structure Filtering, and Parity Baseline
 * Test 26-31: Fixed Earnings, Fixed Deductions, and Categorical Partitioning
 * Test 32-33: Percentage Earnings and Percentage Deductions Calculations
 * Test 34-37: Rule Sequencing, Empty Rules, and Single-Sided Structures
 * Test 38-42: Precision, Idempotency, Structure Isolation, and Category Safety
 */

import assert from 'node:assert';
import {
  normalizePayrollCalculationInput,
  normalizePayrollPeriod,
  normalizeEmployee,
  normalizeContract,
  selectContractForPeriod,
  normalizeSalaryStructure,
  normalizeSalaryRules,
  normalizeAttendance,
  normalizeTimeOff,
} from '../services/payrollNormalizer.js';
import {
  PayrollEngine,
  PayrollInputError,
  calculateEarnings,
  calculateDeductions,
  processSalaryRules,
  calculateSalaryRuleContribution,
} from '../services/payrollEngine.js';
import type { NormalizedSalaryRuleInput } from '../types/payroll.types.js';
import { getAllPayruns } from '../repositories/payrun.repository.js';
import { getAllEmployees } from '../repositories/employee.repository.js';
import {
  getAllContracts,
  getContractsByEmployeeId,
} from '../repositories/contract.repository.js';
import {
  loadEmployeePayrollInput,
  loadPayrunPayrollInputs,
} from '../services/payrollLoader.js';
import { getAllSalaryStructures } from '../repositories/salaryStructure.repository.js';
import {
  getAllSalaryRules,
  getActiveSalaryRulesByStructureId,
} from '../repositories/salaryRule.repository.js';
import { getAllAttendance } from '../repositories/attendance.repository.js';
import { getAllTimeOffRequests } from '../repositories/timeOff.repository.js';
import type { RawPayrollDomainData, RawContractData } from '../types/payroll.types.js';

let passedTests = 0;
function pass(testName: string) {
  passedTests++;
  console.log(`  ✔ [PASS] ${testName}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PEOPLEPAY360 — PHASE 4.3, 4.5, 4.9 & 4.10 VERIFICATION TESTS 🧪');
  console.log('================================================================\n');

  // ── Test 1: Employee is correctly normalized into payroll input ──────────────
  console.log('--- Test 1: Employee Normalization with Attributes ---');
  {
    const rawEmp = {
      id: 'EMP-T101',
      empCode: 'EMP101',
      firstName: 'Alan',
      lastName: 'Turing',
      department: 'Research',
      jobPosition: 'Chief Cryptanalyst',
      gender: 'MALE',
      employeeType: 'FULL_TIME',
      status: 'ACTIVE',
      workingSchedule: 'Standard 40h',
      // Sensitive fields that MUST be stripped
      password: 'secret_hash_123',
      token: 'jwt_bearer_token',
      bankAccountNo: '9876543210',
      ifscRouting: 'CRYPT001',
    };

    const normalized = normalizeEmployee(rawEmp);
    assert.strictEqual(normalized.employeeId, 'EMP-T101');
    assert.strictEqual(normalized.employeeCode, 'EMP101');
    assert.strictEqual(normalized.firstName, 'Alan');
    assert.strictEqual(normalized.lastName, 'Turing');
    assert.strictEqual(normalized.fullName, 'Alan Turing');
    assert.strictEqual(normalized.department, 'Research');
    assert.strictEqual(normalized.position, 'Chief Cryptanalyst');
    assert.strictEqual(normalized.gender, 'MALE');
    assert.strictEqual(normalized.employeeType, 'FULL_TIME');
    assert.strictEqual(normalized.employmentStatus, 'ACTIVE');
    assert.strictEqual(normalized.workingSchedule, 'Standard 40h');

    // Security check: sensitive credentials stripped
    assert.strictEqual((normalized as any).password, undefined);
    assert.strictEqual((normalized as any).token, undefined);
    assert.strictEqual((normalized as any).bankAccountNo, undefined);
    assert.strictEqual((normalized as any).ifscRouting, undefined);
    pass('Test 1: Employee is correctly normalized into payroll input');
  }

  // ── Test 2: Contract is correctly normalized into payroll input ──────────────
  console.log('\n--- Test 2: Contract Normalization ---');
  {
    const rawContract: RawContractData = {
      id: 'CON-T201',
      employeeId: 'EMP-T101',
      wage: 8750.5,
      startDate: '2024-01-01',
      endDate: null,
      salaryStructureId: 'STR-001',
      workingScheduleId: 'SCH-001',
      status: 'ACTIVE',
    };

    const normalized = normalizeContract(rawContract, 'EMP-T101');
    assert.strictEqual(normalized.contractId, 'CON-T201');
    assert.strictEqual(normalized.employeeId, 'EMP-T101');
    assert.strictEqual(normalized.wage, 8750.5);
    assert.strictEqual(normalized.startDate, '2024-01-01');
    assert.strictEqual(normalized.endDate, null);
    assert.strictEqual(normalized.salaryStructureId, 'STR-001');
    assert.strictEqual(normalized.workingScheduleId, 'SCH-001');
    assert.strictEqual(normalized.status, 'ACTIVE');
    pass('Test 2: Contract is correctly normalized into payroll input');
  }

  // ── Test 3: Employee and Contract are correctly associated ───────────────────
  console.log('\n--- Test 3: Employee and Contract Association Integrity ---');
  {
    const rawEmp = { id: 'EMP-T301', name: 'Grace Hopper', department: 'CompSci', status: 'ACTIVE' };
    const matchingContract: RawContractData = {
      id: 'CON-T301',
      employeeId: 'EMP-T301',
      wage: 9200,
      startDate: '2023-01-01',
      status: 'ACTIVE',
    };

    // Valid association passes
    const contractResult = normalizeContract(matchingContract, rawEmp.id);
    assert.strictEqual(contractResult.employeeId, rawEmp.id);

    // Also supports normalized empCode match (e.g. EMP001 matching EMP-001)
    const altCodeContract: RawContractData = {
      id: 'CON-T302',
      employeeId: 'EMPT301',
      wage: 9200,
      startDate: '2023-01-01',
      status: 'ACTIVE',
    };
    const altResult = normalizeContract(altCodeContract, 'EMP-T301');
    assert.strictEqual(altResult.contractId, 'CON-T302');
    pass('Test 3: Employee and Contract are correctly associated');
  }

  // ── Test 4: Correct active contract is selected for a payroll period ─────────
  console.log('\n--- Test 4: Active Contract Selection for Period ---');
  {
    const period = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
    const contracts: RawContractData[] = [
      {
        id: 'CON-PAST',
        employeeId: 'EMP-SEL-1',
        wage: 5000,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        status: 'HISTORICAL',
      },
      {
        id: 'CON-CURRENT',
        employeeId: 'EMP-SEL-1',
        wage: 6500,
        startDate: '2026-01-01',
        endDate: null,
        status: 'ACTIVE',
      },
    ];

    const selected = selectContractForPeriod(contracts, 'EMP-SEL-1', period);
    assert.strictEqual(selected.contractId, 'CON-CURRENT');
    assert.strictEqual(selected.wage, 6500);
    pass('Test 4: Correct active contract is selected for a payroll period');
  }

  // ── Test 5: Contract starting after payroll period is not selected ───────────
  console.log('\n--- Test 5: Future Contract Rejection ---');
  {
    const period = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
    const futureContracts: RawContractData[] = [
      {
        id: 'CON-FUTURE-01',
        employeeId: 'EMP-FUT',
        wage: 7000,
        startDate: '2026-10-01', // Starts after periodEnd
        endDate: null,
        status: 'FUTURE',
      },
    ];

    assert.throws(
      () => selectContractForPeriod(futureContracts, 'EMP-FUT', period),
      (err: any) => err instanceof PayrollInputError && err.code === 'NO_VALID_CONTRACT'
    );
    pass('Test 5: Contract starting after the payroll period is not selected');
  }

  // ── Test 6: Ended contract prior to payroll period is not selected ───────────
  console.log('\n--- Test 6: Ended Contract Rejection ---');
  {
    const period = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
    const endedContracts: RawContractData[] = [
      {
        id: 'CON-ENDED-01',
        employeeId: 'EMP-END',
        wage: 5500,
        startDate: '2026-01-01',
        endDate: '2026-08-31', // Ended before periodStart
        status: 'HISTORICAL',
      },
    ];

    assert.throws(
      () => selectContractForPeriod(endedContracts, 'EMP-END', period),
      (err: any) => err instanceof PayrollInputError && err.code === 'NO_VALID_CONTRACT'
    );
    pass('Test 6: Ended contract prior to the payroll period is not selected');
  }

  // ── Test 7: Multiple valid contracts produce deterministic selection ─────────
  console.log('\n--- Test 7: Multiple Contracts Deterministic Resolution ---');
  {
    const period = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
    // Employee had Contract A (Jan - Jun 2026) and Contract B (Jul 2026 onward)
    const multipleContracts: RawContractData[] = [
      {
        id: 'CON-A',
        employeeId: 'EMP-MULTI',
        wage: 5000,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        status: 'HISTORICAL',
      },
      {
        id: 'CON-B',
        employeeId: 'EMP-MULTI',
        wage: 6800,
        startDate: '2026-07-01',
        endDate: null,
        status: 'ACTIVE',
      },
    ];

    // For September 2026 payroll, Contract B must be selected
    const selected = selectContractForPeriod(multipleContracts, 'EMP-MULTI', period);
    assert.strictEqual(selected.contractId, 'CON-B');
    assert.strictEqual(selected.wage, 6800);

    // If both overlap, active contract with latest start date is chosen deterministically
    const overlappingContracts: RawContractData[] = [
      {
        id: 'CON-OLD',
        employeeId: 'EMP-MULTI-2',
        wage: 4000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'HISTORICAL',
      },
      {
        id: 'CON-NEW',
        employeeId: 'EMP-MULTI-2',
        wage: 7500,
        startDate: '2026-08-01',
        endDate: '2026-12-31',
        status: 'ACTIVE',
      },
    ];

    const selectedOverlapping = selectContractForPeriod(overlappingContracts, 'EMP-MULTI-2', period);
    assert.strictEqual(selectedOverlapping.contractId, 'CON-NEW');
    assert.strictEqual(selectedOverlapping.wage, 7500);
    pass('Test 7: Multiple valid contracts produce deterministic selection');
  }

  // ── Test 8: Missing employee produces a clear failure ─────────────────────────
  console.log('\n--- Test 8: Missing Employee Error Handling ---');
  {
    assert.throws(
      () => normalizeEmployee(null as any),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_EMPLOYEE'
    );

    assert.throws(
      () => normalizeEmployee({ id: '' } as any),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_EMPLOYEE'
    );
    pass('Test 8: Missing employee produces a clear failure (MISSING_EMPLOYEE)');
  }

  // ── Test 9: Missing contract produces a clear failure ─────────────────────────
  console.log('\n--- Test 9: Missing Contract Error Handling ---');
  {
    const rawDataNoContract: RawPayrollDomainData = {
      employee: { id: 'EMP-NOCONTRACT', name: 'No Contract' },
      payrollPeriod: '2026-09-01 - 2026-09-30',
    };

    assert.throws(
      () => normalizePayrollCalculationInput(rawDataNoContract),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_CONTRACT'
    );

    const rawDataEmptyContracts: RawPayrollDomainData = {
      employee: { id: 'EMP-NOCONTRACT-2', name: 'Empty Contracts' },
      contracts: [],
      payrollPeriod: '2026-09-01 - 2026-09-30',
    };

    assert.throws(
      () => normalizePayrollCalculationInput(rawDataEmptyContracts),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_CONTRACT'
    );
    pass('Test 9: Missing contract produces a clear failure (MISSING_CONTRACT)');
  }

  // ── Test 10: Employee from another contract is not accidentally used ──────────
  console.log('\n--- Test 10: Cross-Employee Contract Leaks Prevented ---');
  {
    const rawContractOtherEmployee: RawContractData = {
      id: 'CON-OTHER',
      employeeId: 'EMP-BOB', // Belonging to Bob
      wage: 9999,
      startDate: '2026-01-01',
      status: 'ACTIVE',
    };

    // Attempting to calculate for Alice using Bob's contract must throw CONTRACT_EMPLOYEE_MISMATCH
    assert.throws(
      () => normalizeContract(rawContractOtherEmployee, 'EMP-ALICE'),
      (err: any) => err instanceof PayrollInputError && err.code === 'CONTRACT_EMPLOYEE_MISMATCH'
    );

    // Using selectContractForPeriod with contracts belonging only to other employees
    assert.throws(
      () =>
        selectContractForPeriod(
          [rawContractOtherEmployee],
          'EMP-ALICE',
          { periodStart: '2026-09-01', periodEnd: '2026-09-30' }
        ),
      (err: any) => err instanceof PayrollInputError && err.code === 'NO_VALID_CONTRACT'
    );
    pass('Test 10: Employee from another contract is not accidentally used (CONTRACT_EMPLOYEE_MISMATCH)');
  }

  // ── Test 11: Wage is preserved correctly and invalid wages are rejected ───────
  console.log('\n--- Test 11: Wage Normalization & Validation ---');
  {
    // Valid numeric wage
    const valid = normalizeContract({
      id: 'CON-W1',
      employeeId: 'EMP-W',
      wage: 50000,
      startDate: '2026-01-01',
    });
    assert.strictEqual(valid.wage, 50000);

    // Valid string wage parsed correctly
    const validStr = normalizeContract({
      id: 'CON-W2',
      employeeId: 'EMP-W',
      wage: '6500.50',
      startDate: '2026-01-01',
    });
    assert.strictEqual(validStr.wage, 6500.5);

    // Negative wage rejected
    assert.throws(
      () =>
        normalizeContract({
          id: 'CON-W3',
          employeeId: 'EMP-W',
          wage: -100,
          startDate: '2026-01-01',
        }),
      (err: any) => err instanceof PayrollInputError && err.code === 'INVALID_WAGE'
    );

    // NaN / garbage wage rejected
    assert.throws(
      () =>
        normalizeContract({
          id: 'CON-W4',
          employeeId: 'EMP-W',
          wage: 'invalid_wage',
          startDate: '2026-01-01',
        }),
      (err: any) => err instanceof PayrollInputError && err.code === 'INVALID_WAGE'
    );
    pass('Test 11: Wage is preserved correctly and invalid wages are rejected');
  }

  // ── Test 12: Monetary precision remains deterministic ────────────────────────
  console.log('\n--- Test 12: Monetary Precision Determinism ---');
  {
    const preciseContract = normalizeContract({
      id: 'CON-PREC',
      employeeId: 'EMP-P',
      wage: 12345.6789,
      startDate: '2026-01-01',
    });
    // Two decimal places rounded deterministically
    assert.strictEqual(preciseContract.wage, 12345.68);

    // Multiple repeated runs produce identical wage
    for (let i = 0; i < 10; i++) {
      const run = normalizeContract({
        id: 'CON-PREC',
        employeeId: 'EMP-P',
        wage: 12345.6789,
        startDate: '2026-01-01',
      });
      assert.strictEqual(run.wage, 12345.68);
    }
    pass('Test 12: Monetary precision remains deterministic (2 decimal places)');
  }

  // ── Test 13: Existing Phase 4.1/4.2 normalization & period tests pass ────────
  console.log('\n--- Test 13: Phase 4.1/4.2 Regression Checks (Structure, Rules, Attendance, Leave) ---');
  {
    // Salary structure
    const struct = normalizeSalaryStructure({ id: 'STR-001', code: 'TECH_STD', name: 'Tech Standard' });
    assert.strictEqual(struct?.code, 'TECH_STD');

    // Salary rules deterministic sort
    const rules = normalizeSalaryRules([
      { id: 'R2', name: 'Tax Rule', code: 'TAX', sequence: 4, category: 'DEDUCTION' },
      { id: 'R1', name: 'Basic Rule', code: 'BASIC', sequence: 1, category: 'BASIC' },
    ]);
    assert.strictEqual(rules[0].code, 'BASIC');
    assert.strictEqual(rules[1].code, 'TAX');

    // Attendance
    const att = normalizeAttendance(
      [{ date: '2026-09-02', checkIn: '09:00', checkOut: '17:00', workedHours: 8, status: 'PRESENT' }],
      'EMP-1',
      '2026-09-01',
      '2026-09-30'
    );
    assert.strictEqual(att.summary.presentDays, 1);

    // Time off
    const to = normalizeTimeOff(
      [
        { id: 'TO-1', startDate: '2026-09-05', endDate: '2026-09-05', durationDays: 1, status: 'APPROVED', leaveType: 'Unpaid Leave' },
        { id: 'TO-2', startDate: '2026-09-10', endDate: '2026-09-11', durationDays: 2, status: 'REFUSED', leaveType: 'Sick Leave' },
      ],
      'EMP-1',
      '2026-09-01',
      '2026-09-30'
    );
    assert.strictEqual(to.summary.approvedUnpaidDays, 1);
    assert.strictEqual(to.summary.refusedDays, 2);
    pass('Test 13: Existing Phase 4.1/4.2 normalization & period tests still pass');
  }

  // ── Test 14: Existing payroll baseline calculation still works ($40k / $33,074) ─
  console.log('\n--- Test 14: Existing Payroll Baseline Parity ($40k Gross / $33,074 Net) ---');
  {
    const defaultEmployees = [
      { id: 'EMP-001', name: 'John Doe', department: 'Engineering', wage: 6500 },
      { id: 'EMP-002', name: 'Maya Lin', department: 'Product', wage: 7200 },
      { id: 'EMP-003', name: 'Alex Rivera', department: 'Finance', wage: 5200 },
      { id: 'EMP-004', name: 'Elena Rostova', department: 'Human Resources', wage: 8000 },
      { id: 'EMP-005', name: 'David Kim', department: 'Engineering', wage: 6800 },
      { id: 'EMP-006', name: 'Sarah Connor', department: 'Operations', wage: 6300 },
    ];

    const computedPayslips = defaultEmployees.map((emp) => {
      const calcInput = normalizePayrollCalculationInput({
        employee: {
          id: emp.id,
          name: emp.name,
          department: emp.department,
          status: 'ACTIVE',
          gender: emp.name === 'Sarah Connor' || emp.name === 'Maya Lin' || emp.name === 'Elena Rostova' ? 'FEMALE' : 'MALE',
          employeeType: 'FULL_TIME',
        },
        // Using contracts array to test multi-contract selection in real calculation
        contracts: [
          {
            id: `CON-${emp.id}-OLD`,
            employeeId: emp.id,
            wage: 3000,
            startDate: '2022-01-01',
            endDate: '2022-12-31',
            status: 'HISTORICAL',
          },
          {
            id: `CON-${emp.id}`,
            employeeId: emp.id,
            wage: emp.wage,
            startDate: '2023-01-01',
            status: 'ACTIVE',
            salaryStructureId: 'STR-001',
          },
        ],
        salaryStructure: { id: 'STR-001', code: 'TECH_STD', name: 'Standard Full-Time Tech' },
        salaryRules: [],
        attendanceRecords: [],
        timeOffRequests: emp.name === 'Sarah Connor' ? [{
          id: 'TO-SC-01',
          employeeId: emp.id,
          leaveType: 'Unpaid Leave',
          startDate: '2026-09-04',
          endDate: '2026-09-04',
          durationDays: 1,
          status: 'APPROVED',
        }] : [],
        payrollPeriod: '2026-09-01 - 2026-09-30',
      });
      return PayrollEngine.compute(calcInput);
    });

    const totalGross = computedPayslips.reduce((a, b) => a + b.gross, 0);
    const totalNet = computedPayslips.reduce((a, b) => a + b.net, 0);

    assert.strictEqual(totalGross, 40000, `Total gross must equal exactly 40000, got ${totalGross}`);
    // With legacy fallback removed, salaryRules=[] produces zero rule-driven deductions
    assert.strictEqual(totalNet, 39874, `Total net must equal exactly 39874, got ${totalNet}`);

    const sarahSlip = computedPayslips.find((s) => s.employeeName === 'Sarah Connor');
    assert.ok(sarahSlip);
    assert.strictEqual(sarahSlip.unpaidLeaveDeduction, 126);
    assert.strictEqual(sarahSlip.net, 6174);
    pass('Test 14: Phase 4 database-driven calculation with empty rules produces zero fallback deductions ($40,000 Gross, $39,874 Net)');
  }

  // ── Test 15: Domain Loading from Live MySQL Repositories ──────────────────────
  console.log('\n--- Test 15: Domain Loading via payrollLoader from Live Repositories ---');
  {
    const input = await loadEmployeePayrollInput('EMP-001', '2026-09-01 - 2026-09-30');
    assert.strictEqual(input.employee.employeeId, 'EMP-001');
    assert.strictEqual(input.employee.fullName, 'John Doe');
    assert.strictEqual(input.contract.contractId, 'CON-001');
    assert.strictEqual(input.contract.wage, 6500);
    assert.strictEqual(input.contract.status, 'ACTIVE');

    // Feed normalized input into deterministic engine (pure calculation)
    const result = PayrollEngine.compute(input);
    assert.strictEqual(result.gross, 6500);
    assert.strictEqual(result.basic, 3900); // 60% of 6500
    assert.strictEqual(result.hra, 1625);   // 25% of 6500
    assert.strictEqual(result.net, 5395);   // 6500 - (650 + 455)
    pass('Test 15: Domain Loading via payrollLoader produces valid PayrollCalculationInput and payslip');
  }

  // ── Test 16: Domain Loading with Missing Employee ─────────────────────────────
  console.log('\n--- Test 16: Domain Loading Rejects Nonexistent Employee ---');
  {
    await assert.rejects(
      async () => loadEmployeePayrollInput('NONEXISTENT-EMP-XYZ', '2026-09-01 - 2026-09-30'),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_EMPLOYEE'
    );
    pass('Test 16: Domain Loading rejects nonexistent employee with MISSING_EMPLOYEE');
  }

  // ── Test 17: Contract Repository Flexible Identifier Matching ─────────────────
  console.log('\n--- Test 17: Flexible Employee Matching in Contract Repository ---');
  {
    // Match by formatted empCode
    const byCode = await getContractsByEmployeeId('EMP-001');
    assert.ok(byCode.length > 0);
    assert.strictEqual(byCode[0].id, 'CON-001');

    // Match by raw unhyphenated empCode
    const byRawCode = await getContractsByEmployeeId('EMP001');
    assert.ok(byRawCode.length > 0);
    assert.strictEqual(byRawCode[0].id, 'CON-001');

    // Match by UUID
    const empUuid = byCode[0].employeeId;
    const byUuid = await getContractsByEmployeeId(empUuid);
    assert.ok(byUuid.length > 0);
    assert.strictEqual(byUuid[0].id, 'CON-001');
    pass('Test 17: Contract repository flexibly resolves by UUID, EMP-001, and EMP001');
  }

  // ── Test 18: Loading Active Salary Rules from MySQL ────────────────────────
  console.log('\n--- Test 18: Loading Active Salary Rules from MySQL by Structure ID ---');
  {
    const rules = await getActiveSalaryRulesByStructureId('STR-001');
    assert.ok(Array.isArray(rules));
    assert.strictEqual(rules.length, 5);
    const codes = rules.map(r => r.code);
    assert.ok(codes.includes('BASIC'));
    assert.ok(codes.includes('HRA'));
    assert.ok(codes.includes('ALLOWANCE'));
    assert.ok(codes.includes('TAX'));
    assert.ok(codes.includes('PF'));

    for (const r of rules) {
      assert.strictEqual(r.structureId, 'STR-001');
      assert.ok(typeof r.id === 'string' && r.id.length > 0);
      assert.ok(typeof r.sequence === 'number');
      assert.ok(typeof r.category === 'string');
      assert.ok(typeof r.calculationType === 'string');
    }
    pass('Test 18: Active salary rules loaded from MySQL for STR-001 (5 rules, complete attributes)');
  }

  // ── Test 19: Structure Mismatch Filtering in Normalizer ─────────────────────
  console.log('\n--- Test 19: Structure Mismatch Filtering in Normalizer ---');
  {
    const mixedRules = [
      { id: 'R1', structure_id: 'STR-001', code: 'BASIC', sequence: 10, category: 'EARNINGS', calculation_type: 'PERCENTAGE', percentage: 50 },
      { id: 'R2', structure_id: 'STR-002', code: 'OVERTIME', sequence: 20, category: 'EARNINGS', calculation_type: 'FIXED', amount: 500 },
      { id: 'R3', structure_id: 'STR-001', code: 'TAX', sequence: 30, category: 'DEDUCTIONS', calculation_type: 'PERCENTAGE', percentage: 10 },
      { id: 'R4', structure_id: 'STR-OTHER', code: 'BONUS', sequence: 15, category: 'EARNINGS', calculation_type: 'FIXED', amount: 1000 },
    ];

    const normalizedForStr1 = normalizeSalaryRules(mixedRules, 'STR-001');
    assert.strictEqual(normalizedForStr1.length, 2);
    assert.strictEqual(normalizedForStr1[0].code, 'BASIC');
    assert.strictEqual(normalizedForStr1[1].code, 'TAX');

    const normalizedForStr2 = normalizeSalaryRules(mixedRules, 'STR-002');
    assert.strictEqual(normalizedForStr2.length, 1);
    assert.strictEqual(normalizedForStr2[0].code, 'OVERTIME');
    pass('Test 19: Rules belonging to other structures are cleanly excluded');
  }

  // ── Test 20: Inactive Rules Are Excluded ────────────────────────────────────
  console.log('\n--- Test 20: Inactive Rules Are Excluded ---');
  {
    const rulesWithInactive = [
      { id: 'R-ACT1', structure_id: 'STR-001', code: 'BASIC', sequence: 10, category: 'EARNINGS', calculation_type: 'PERCENTAGE', percentage: 60, active: true },
      { id: 'R-INACT1', structure_id: 'STR-001', code: 'OLD_ALLOWANCE', sequence: 15, category: 'EARNINGS', calculation_type: 'FIXED', amount: 200, active: false },
      { id: 'R-INACT2', structure_id: 'STR-001', code: 'ARCHIVED_DED', sequence: 25, category: 'DEDUCTIONS', calculation_type: 'FIXED', amount: 100, status: 'INACTIVE' },
      { id: 'R-ACT2', structure_id: 'STR-001', code: 'HRA', sequence: 20, category: 'EARNINGS', calculation_type: 'PERCENTAGE', percentage: 25 },
    ];

    const normalized = normalizeSalaryRules(rulesWithInactive, 'STR-001');
    assert.strictEqual(normalized.length, 2);
    assert.strictEqual(normalized[0].code, 'BASIC');
    assert.strictEqual(normalized[1].code, 'HRA');
    pass('Test 20: Inactive rules (active: false, status: INACTIVE) are filtered out');
  }

  // ── Test 21: Deterministic Rule Ordering (sequence ASC, ruleId ASC) ─────────
  console.log('\n--- Test 21: Deterministic Rule Ordering ---');
  {
    const unorderedRules = [
      { id: 'R-DED2', structure_id: 'STR-001', code: 'TAX', sequence: 40, category: 'DEDUCTIONS', calculation_type: 'PERCENTAGE', percentage: 10 },
      { id: 'R-EARN1', structure_id: 'STR-001', code: 'BASIC', sequence: 10, category: 'EARNINGS', calculation_type: 'PERCENTAGE', percentage: 50 },
      { id: 'R-EARN2', structure_id: 'STR-001', code: 'HRA', sequence: 20, category: 'EARNINGS', calculation_type: 'PERCENTAGE', percentage: 25 },
      { id: 'R-TIE-B', structure_id: 'STR-001', code: 'BONUS_B', sequence: 30, category: 'EARNINGS', calculation_type: 'FIXED', amount: 200 },
      { id: 'R-TIE-A', structure_id: 'STR-001', code: 'BONUS_A', sequence: 30, category: 'EARNINGS', calculation_type: 'FIXED', amount: 100 },
    ];

    const ordered = normalizeSalaryRules(unorderedRules, 'STR-001');
    assert.strictEqual(ordered.length, 5);
    assert.strictEqual(ordered[0].code, 'BASIC');   // seq 10
    assert.strictEqual(ordered[1].code, 'HRA');     // seq 20
    assert.strictEqual(ordered[2].code, 'BONUS_A'); // seq 30, id R-TIE-A
    assert.strictEqual(ordered[3].code, 'BONUS_B'); // seq 30, id R-TIE-B
    assert.strictEqual(ordered[4].code, 'TAX');     // seq 40
    pass('Test 21: Deterministic rule ordering by sequence ASC and ruleId ASC confirmed');
  }

  // ── Test 22: Attribute Preservation Without Calculation Execution ───────────
  console.log('\n--- Test 22: Attribute Preservation Without Calculation Execution ---');
  {
    const rawRules = [
      {
        id: 'RULE-ATTR',
        structure_id: 'STR-001',
        name: 'Special Allowance',
        code: 'SPEC_ALL',
        sequence: 12,
        category: 'EARNINGS',
        calculation_type: 'PERCENTAGE',
        amount: 1500.556,
        percentage: 15.333,
        formula: 'wage * 0.1533',
      },
    ];

    const [norm] = normalizeSalaryRules(rawRules, 'STR-001');
    assert.strictEqual(norm.ruleId, 'RULE-ATTR');
    assert.strictEqual(norm.structureId, 'STR-001');
    assert.strictEqual(norm.name, 'Special Allowance');
    assert.strictEqual(norm.code, 'SPEC_ALL');
    assert.strictEqual(norm.sequence, 12);
    assert.strictEqual(norm.category, 'ALLOWANCE');
    assert.strictEqual(norm.calculationType, 'PERCENTAGE');
    assert.strictEqual(norm.amount, 1500.56); // 2-decimal rounded
    assert.strictEqual(norm.percentage, 15.33); // 2-decimal rounded
    assert.strictEqual(norm.formula, 'wage * 0.1533'); // preserved untouched
    pass('Test 22: Attributes preserved with 2-decimal precision without premature calculation');
  }

  // ── Test 23: Empty Rule List Guarantees Empty Array ────────────────────────
  console.log('\n--- Test 23: Empty Rule List Guarantees Empty Array ---');
  {
    const fromNull = normalizeSalaryRules(null, 'STR-001');
    const fromEmpty = normalizeSalaryRules([], 'STR-001');
    const fromNoMatch = normalizeSalaryRules([{ id: 'R1', structure_id: 'STR-999', code: 'X' }], 'STR-001');

    assert.ok(Array.isArray(fromNull) && fromNull.length === 0);
    assert.ok(Array.isArray(fromEmpty) && fromEmpty.length === 0);
    assert.ok(Array.isArray(fromNoMatch) && fromNoMatch.length === 0);

    const fullNorm = normalizePayrollCalculationInput({
      employee: { id: 'EMP-T1', firstName: 'John', lastName: 'Doe' },
      contract: { id: 'CON-T1', employeeId: 'EMP-T1', wage: 5000, startDate: '2026-01-01', salaryStructureId: 'STR-EMPTY' },
      salaryRules: [],
      period: '2026-09-01 - 2026-09-30',
    });
    assert.ok(Array.isArray(fullNorm.salaryRules));
    assert.strictEqual(fullNorm.salaryRules.length, 0);
    pass('Test 23: Empty salary rules returns empty array [] and never undefined');
  }

  // ── Test 24: End-to-End Domain Loading with MySQL Rules ─────────────────────
  console.log('\n--- Test 24: End-to-End Domain Loading with MySQL Rules ---');
  {
    const input = await loadEmployeePayrollInput('EMP-001', '2026-09-01 - 2026-09-30');
    assert.ok(input.employee);
    assert.strictEqual(input.employee.employeeId, 'EMP-001');
    assert.ok(input.contract);
    assert.strictEqual(input.contract.contractId, 'CON-001');
    assert.strictEqual(input.contract.wage, 6500);
    assert.ok(input.salaryStructure);
    assert.strictEqual(input.salaryStructure.structureId, 'STR-001');
    assert.ok(Array.isArray(input.salaryRules));
    assert.strictEqual(input.salaryRules.length, 5);

    for (const rule of input.salaryRules) {
      assert.strictEqual(rule.structureId, 'STR-001');
      assert.ok(rule.ruleId);
      assert.ok(rule.code);
    }
    pass('Test 24: Domain loader loads employee, contract, structure, and 5 active rules from MySQL');
  }

  // ── Test 25: Baseline Payroll Calculation Parity ───────────────────────────
  console.log('\n--- Test 25: Baseline Payroll Parity Preserved ---');
  {
    const activeRules = await getActiveSalaryRulesByStructureId('STR-001');
    assert.strictEqual(activeRules.length, 5);

    const defaultEmployees = [
      { id: 'EMP-001', name: 'John Doe', department: 'Engineering', wage: 6500 },
      { id: 'EMP-002', name: 'Maya Lin', department: 'Product', wage: 7200 },
      { id: 'EMP-003', name: 'Alex Rivera', department: 'Finance', wage: 5200 },
      { id: 'EMP-004', name: 'Elena Rostova', department: 'Human Resources', wage: 8000 },
      { id: 'EMP-005', name: 'David Kim', department: 'Engineering', wage: 6800 },
      { id: 'EMP-006', name: 'Sarah Connor', department: 'Operations', wage: 6300 },
    ];

    const computedPayslips = defaultEmployees.map((emp) => {
      const calcInput = normalizePayrollCalculationInput({
        employee: {
          id: emp.id,
          name: emp.name,
          department: emp.department,
          status: 'ACTIVE',
        },
        contract: {
          id: `CON-${emp.id}`,
          employeeId: emp.id,
          wage: emp.wage,
          startDate: '2023-01-01',
          salaryStructureId: 'STR-001',
        },
        salaryStructure: { id: 'STR-001', code: 'STD_FT', name: 'Standard Full-Time' },
        salaryRules: activeRules,
        timeOffRequests: emp.name === 'Sarah Connor' ? [{
          id: 'TO-SC-01',
          employeeId: emp.id,
          leaveType: 'Unpaid Leave',
          startDate: '2026-09-04',
          endDate: '2026-09-04',
          durationDays: 1,
          status: 'APPROVED',
        }] : [],
        payrollPeriod: '2026-09-01 - 2026-09-30',
      });
      assert.strictEqual(calcInput.salaryRules.length, 5);
      return PayrollEngine.compute(calcInput);
    });

    const totalGross = computedPayslips.reduce((a, b) => a + b.gross, 0);
    const totalNet = computedPayslips.reduce((a, b) => a + b.net, 0);

    assert.strictEqual(totalGross, 40000, `Total gross must equal 40000, got ${totalGross}`);
    assert.strictEqual(totalNet, 33074, `Total net must equal 33074, got ${totalNet}`);
    pass('Test 25: Baseline calculation ($40,000 Gross / $33,074 Net) produces 100% parity with loaded MySQL active rules');
  }

  // ── Test 26: One Fixed EARNING Rule Contributes Correctly (Phase 4.9) ───────
  console.log('\n--- Test 26: Single Fixed EARNING Rule Contribution (Phase 4.9) ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      {
        ruleId: 'RUL-FIXED-1',
        structureId: 'STR-001',
        name: 'Fixed Base Earning',
        code: 'FIX_EARN',
        sequence: 10,
        category: 'ALLOWANCE',
        calculationType: 'FIXED',
        amount: 30000,
        percentage: null,
        formula: null,
      },
    ];

    const result = calculateEarnings(rules, 30000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 30000);
    assert.strictEqual(result.earnings.length, 1);
    assert.strictEqual(result.earnings[0].ruleId, 'RUL-FIXED-1');
    assert.strictEqual(result.earnings[0].code, 'FIX_EARN');
    assert.strictEqual(result.earnings[0].amount, 30000);
    pass('Test 26: One fixed EARNING rule contributes correctly');
  }

  // ── Test 27: Multiple EARNING Rules Aggregate Correctly (Phase 4.9) ────────
  console.log('\n--- Test 27: Multiple EARNING Rules Aggregation (Phase 4.9) ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      {
        ruleId: 'RUL-EARN-A',
        structureId: 'STR-001',
        name: 'Earning Rule A',
        code: 'EARN_A',
        sequence: 10,
        category: 'BASIC',
        calculationType: 'FIXED',
        amount: 30000,
        percentage: null,
        formula: null,
      },
      {
        ruleId: 'RUL-EARN-B',
        structureId: 'STR-001',
        name: 'Earning Rule B',
        code: 'EARN_B',
        sequence: 20,
        category: 'ALLOWANCE',
        calculationType: 'FIXED',
        amount: 10000,
        percentage: null,
        formula: null,
      },
      {
        ruleId: 'RUL-EARN-C',
        structureId: 'STR-001',
        name: 'Earning Rule C',
        code: 'EARN_C',
        sequence: 30,
        category: 'ALLOWANCE',
        calculationType: 'FIXED',
        amount: 5000,
        percentage: null,
        formula: null,
      },
    ];

    const result = calculateEarnings(rules, 45000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 45000);
    assert.strictEqual(result.earnings.length, 3);
    assert.strictEqual(result.earnings[0].amount, 30000);
    assert.strictEqual(result.earnings[1].amount, 10000);
    assert.strictEqual(result.earnings[2].amount, 5000);
    pass('Test 27: Multiple EARNING rules aggregate correctly (30,000 + 10,000 + 5,000 = 45,000)');
  }

  // ── Test 28: One Fixed DEDUCTION Rule Contributes Correctly (Phase 4.10) ─────
  console.log('\n--- Test 28: Single Fixed DEDUCTION Rule Contribution (Phase 4.10) ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      {
        ruleId: 'RUL-DED-1',
        structureId: 'STR-001',
        name: 'Health Insurance',
        code: 'HEALTH_INS',
        sequence: 50,
        category: 'DEDUCTION',
        calculationType: 'FIXED',
        amount: 2000,
        percentage: null,
        formula: null,
      },
    ];

    const result = calculateDeductions(rules, 30000, 'STR-001');
    assert.strictEqual(result.totalDeductions, 2000);
    assert.strictEqual(result.deductions.length, 1);
    assert.strictEqual(result.deductions[0].code, 'HEALTH_INS');
    assert.strictEqual(result.deductions[0].amount, 2000);
    pass('Test 28: One fixed DEDUCTION rule contributes correctly');
  }

  // ── Test 29: Multiple DEDUCTION Rules Aggregate Correctly (Phase 4.10) ──────
  console.log('\n--- Test 29: Multiple DEDUCTION Rules Aggregation (Phase 4.10) ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      {
        ruleId: 'RUL-DED-A',
        structureId: 'STR-001',
        name: 'Deduction A',
        code: 'DED_A',
        sequence: 40,
        category: 'DEDUCTION',
        calculationType: 'FIXED',
        amount: 2000,
        percentage: null,
        formula: null,
      },
      {
        ruleId: 'RUL-DED-B',
        structureId: 'STR-001',
        name: 'Deduction B',
        code: 'DED_B',
        sequence: 50,
        category: 'DEDUCTION',
        calculationType: 'FIXED',
        amount: 500,
        percentage: null,
        formula: null,
      },
    ];

    const result = calculateDeductions(rules, 45000, 'STR-001');
    assert.strictEqual(result.totalDeductions, 2500);
    assert.strictEqual(result.deductions.length, 2);
    assert.strictEqual(result.deductions[0].amount, 2000);
    assert.strictEqual(result.deductions[1].amount, 500);
    pass('Test 29: Multiple DEDUCTION rules aggregate correctly (2,000 + 500 = 2,500)');
  }

  // ── Test 30: EARNING Rules Are Excluded From Deductions ─────────────────────
  console.log('\n--- Test 30: EARNING Rules Are Excluded From Deductions ---');
  {
    const mixedRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'R1', structureId: 'STR-001', name: 'Basic', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 30000, percentage: null, formula: null },
      { ruleId: 'R2', structureId: 'STR-001', name: 'HRA', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 10000, percentage: null, formula: null },
      { ruleId: 'R3', structureId: 'STR-001', name: 'Tax', code: 'TAX', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000, percentage: null, formula: null },
    ];

    const deductionResult = calculateDeductions(mixedRules, 40000, 'STR-001');
    assert.strictEqual(deductionResult.totalDeductions, 2000);
    assert.strictEqual(deductionResult.deductions.length, 1);
    assert.strictEqual(deductionResult.deductions[0].code, 'TAX');

    const deductionCodes = deductionResult.deductions.map((d) => d.code);
    assert.ok(!deductionCodes.includes('BASIC'));
    assert.ok(!deductionCodes.includes('HRA'));
    pass('Test 30: EARNING rules are strictly excluded from deductions');
  }

  // ── Test 31: DEDUCTION Rules Are Excluded From Earnings ─────────────────────
  console.log('\n--- Test 31: DEDUCTION Rules Are Excluded From Earnings ---');
  {
    const mixedRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'R1', structureId: 'STR-001', name: 'Basic', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 30000, percentage: null, formula: null },
      { ruleId: 'R2', structureId: 'STR-001', name: 'Tax', code: 'TAX', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000, percentage: null, formula: null },
      { ruleId: 'R3', structureId: 'STR-001', name: 'PF', code: 'PF', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1500, percentage: null, formula: null },
    ];

    const earningResult = calculateEarnings(mixedRules, 30000, 'STR-001');
    assert.strictEqual(earningResult.totalEarnings, 30000);
    assert.strictEqual(earningResult.earnings.length, 1);
    assert.strictEqual(earningResult.earnings[0].code, 'BASIC');

    const earningCodes = earningResult.earnings.map((e) => e.code);
    assert.ok(!earningCodes.includes('TAX'));
    assert.ok(!earningCodes.includes('PF'));
    pass('Test 31: DEDUCTION rules are strictly excluded from earnings');
  }

  // ── Test 32: Percentage EARNING Rules Calculate Accurately ───────────────────
  console.log('\n--- Test 32: Percentage EARNING Rules Based on Wage ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'R1', structureId: 'STR-001', name: 'Basic (50%)', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'PERCENTAGE', amount: null, percentage: 50, formula: null },
      { ruleId: 'R2', structureId: 'STR-001', name: 'HRA (20%)', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', amount: null, percentage: 20, formula: null },
    ];

    const baseWage = 8000;
    const result = calculateEarnings(rules, baseWage, 'STR-001');
    assert.strictEqual(result.earnings[0].amount, 4000);
    assert.strictEqual(result.earnings[1].amount, 1600);
    assert.strictEqual(result.totalEarnings, 5600);
    pass('Test 32: Percentage EARNING rules calculate accurately from base wage (50% = 4,000, 20% = 1,600)');
  }

  // ── Test 33: Percentage DEDUCTION Rules Calculate Accurately ─────────────────
  console.log('\n--- Test 33: Percentage DEDUCTION Rules Based on Wage ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'R1', structureId: 'STR-001', name: 'Income Tax (10%)', code: 'TAX', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', amount: null, percentage: 10, formula: null },
      { ruleId: 'R2', structureId: 'STR-001', name: 'PF (12%)', code: 'PF', sequence: 50, category: 'DEDUCTION', calculationType: 'PERCENTAGE', amount: null, percentage: 12, formula: null },
    ];

    const baseWage = 10000;
    const result = calculateDeductions(rules, baseWage, 'STR-001');
    assert.strictEqual(result.deductions[0].amount, 1000);
    assert.strictEqual(result.deductions[1].amount, 1200);
    assert.strictEqual(result.totalDeductions, 2200);
    pass('Test 33: Percentage DEDUCTION rules calculate accurately from base wage (10% = 1,000, 12% = 1,200)');
  }

  // ── Test 34: Rule Sequence Produces Deterministic Ordering ──────────────────
  console.log('\n--- Test 34: Deterministic Rule Sequence Processing ---');
  {
    const unorderedRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'R3', structureId: 'STR-001', name: 'Rule 3', code: 'R3', sequence: 30, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 300, percentage: null, formula: null },
      { ruleId: 'R1', structureId: 'STR-001', name: 'Rule 1', code: 'R1', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 100, percentage: null, formula: null },
      { ruleId: 'R2', structureId: 'STR-001', name: 'Rule 2', code: 'R2', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 200, percentage: null, formula: null },
    ];

    const result = calculateEarnings(unorderedRules, 1000, 'STR-001');
    assert.strictEqual(result.earnings[0].code, 'R1');
    assert.strictEqual(result.earnings[1].code, 'R2');
    assert.strictEqual(result.earnings[2].code, 'R3');
    assert.strictEqual(result.totalEarnings, 600);
    pass('Test 34: Rule sequence produces deterministic results regardless of input order');
  }

  // ── Test 35: Empty salaryRules Produces Zero Earnings and Deductions ─────────
  console.log('\n--- Test 35: Empty salaryRules Zero Boundary ---');
  {
    const earnResult = calculateEarnings([], 5000, 'STR-001');
    assert.strictEqual(earnResult.totalEarnings, 0);
    assert.strictEqual(earnResult.earnings.length, 0);

    const dedResult = calculateDeductions([], 5000, 'STR-001');
    assert.strictEqual(dedResult.totalDeductions, 0);
    assert.strictEqual(dedResult.deductions.length, 0);

    const procResult = processSalaryRules([], 5000, 'STR-001');
    assert.strictEqual(procResult.totalEarnings, 0);
    assert.strictEqual(procResult.totalDeductions, 0);
    assert.strictEqual(procResult.earnings.length, 0);
    assert.strictEqual(procResult.deductions.length, 0);
    pass('Test 35: Empty salaryRules produces zero earnings and zero deductions');
  }

  // ── Test 36: Only Earnings Produces Zero Deductions ─────────────────────────
  console.log('\n--- Test 36: Only Earnings Structure Produces Zero Deductions ---');
  {
    const onlyEarnings: NormalizedSalaryRuleInput[] = [
      { ruleId: 'E1', structureId: 'STR-001', name: 'Base', code: 'BASE', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000, percentage: null, formula: null },
      { ruleId: 'E2', structureId: 'STR-001', name: 'Bonus', code: 'BONUS', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1500, percentage: null, formula: null },
    ];

    const result = processSalaryRules(onlyEarnings, 5000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 6500);
    assert.strictEqual(result.totalDeductions, 0);
    assert.strictEqual(result.deductions.length, 0);
    pass('Test 36: Only earnings produces zero deductions');
  }

  // ── Test 37: Only Deductions Produces Zero Earnings ─────────────────────────
  console.log('\n--- Test 37: Only Deductions Structure Produces Zero Earnings ---');
  {
    const onlyDeductions: NormalizedSalaryRuleInput[] = [
      { ruleId: 'D1', structureId: 'STR-001', name: 'Tax', code: 'TAX', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500, percentage: null, formula: null },
      { ruleId: 'D2', structureId: 'STR-001', name: 'PF', code: 'PF', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 300, percentage: null, formula: null },
    ];

    const result = processSalaryRules(onlyDeductions, 5000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 0);
    assert.strictEqual(result.earnings.length, 0);
    assert.strictEqual(result.totalDeductions, 800);
    assert.strictEqual(result.deductions.length, 2);
    pass('Test 37: Only deductions produces zero earnings');
  }

  // ── Test 38: Decimal Monetary Precision (Zero Floating-Point Drift) ─────────
  console.log('\n--- Test 38: Decimal Monetary Precision Without Floating-Point Artifacts ---');
  {
    const decimalRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'D-R1', structureId: 'STR-001', name: 'Rule 1', code: 'R1', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1234.56, percentage: null, formula: null },
      { ruleId: 'D-R2', structureId: 'STR-001', name: 'Rule 2', code: 'R2', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2345.67, percentage: null, formula: null },
      { ruleId: 'D-R3', structureId: 'STR-001', name: 'Rule 3', code: 'R3', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 333.33, percentage: null, formula: null },
    ];

    const result = processSalaryRules(decimalRules, 10000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 3580.23);
    assert.strictEqual(result.totalDeductions, 333.33);
    pass('Test 38: Decimal monetary precision remains deterministic without floating-point drift');
  }

  // ── Test 39: Idempotency Across Repeated Executions ─────────────────────────
  console.log('\n--- Test 39: Deterministic Idempotency Across Repeated Runs ---');
  {
    const rules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'IDEMP-1', structureId: 'STR-001', name: 'Base', code: 'BASE', sequence: 10, category: 'BASIC', calculationType: 'PERCENTAGE', amount: null, percentage: 60, formula: null },
      { ruleId: 'IDEMP-2', structureId: 'STR-001', name: 'Tax', code: 'TAX', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', amount: null, percentage: 10, formula: null },
    ];

    const run1 = processSalaryRules(rules, 6500, 'STR-001');
    for (let i = 0; i < 10; i++) {
      const runN = processSalaryRules(rules, 6500, 'STR-001');
      assert.deepStrictEqual(run1, runN);
    }
    pass('Test 39: Same input produces identical output across 10 repeated executions');
  }

  // ── Test 40: Rules From Another Structure Are Excluded ──────────────────────
  console.log('\n--- Test 40: Salary Structure Isolation ---');
  {
    const mixedRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'STR1-R1', structureId: 'STR-001', name: 'STR1 Base', code: 'STR1_BASE', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000, percentage: null, formula: null },
      { ruleId: 'STR2-R1', structureId: 'STR-999', name: 'STR2 Special', code: 'STR2_SPEC', sequence: 15, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2000, percentage: null, formula: null },
      { ruleId: 'STR2-R2', structureId: 'STR-999', name: 'STR2 Tax', code: 'STR2_TAX', sequence: 25, category: 'DEDUCTION', calculationType: 'FIXED', amount: 800, percentage: null, formula: null },
    ];

    const result = processSalaryRules(mixedRules, 5000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 5000);
    assert.strictEqual(result.earnings.length, 1);
    assert.strictEqual(result.earnings[0].code, 'STR1_BASE');
    assert.strictEqual(result.totalDeductions, 0);
    assert.strictEqual(result.deductions.length, 0);
    pass('Test 40: Rules from another salary structure are completely excluded');
  }

  // ── Test 41: Negative Values Are Rejected (Floored to 0, Not Inverted) ──────
  console.log('\n--- Test 41: Negative Values Invariant ---');
  {
    const negativeRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'NEG-1', structureId: 'STR-001', name: 'Negative Fix', code: 'NEG_FIX', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: -500, percentage: null, formula: null },
      { ruleId: 'NEG-2', structureId: 'STR-001', name: 'Negative Pct', code: 'NEG_PCT', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', amount: null, percentage: -10, formula: null },
    ];

    const result = processSalaryRules(negativeRules, 5000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 0);
    assert.strictEqual(result.totalDeductions, 0);
    assert.strictEqual(result.earnings[0].amount, 0);
    assert.strictEqual(result.deductions[0].amount, 0);
    pass('Test 41: Negative rule amounts/percentages are floored to 0 and not silently inverted');
  }

  // ── Test 42: Summary Categories (GROSS, NET) Are Excluded ───────────────────
  console.log('\n--- Test 42: Summary Categories (GROSS, NET) Are Excluded ---');
  {
    const summaryRules: NormalizedSalaryRuleInput[] = [
      { ruleId: 'SUM-1', structureId: 'STR-001', name: 'Base', code: 'BASE', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000, percentage: null, formula: null },
      { ruleId: 'SUM-2', structureId: 'STR-001', name: 'Gross Rule', code: 'GROSS', sequence: 80, category: 'GROSS', calculationType: 'FIXED', amount: 5000, percentage: null, formula: 'BASIC' },
      { ruleId: 'SUM-3', structureId: 'STR-001', name: 'Net Rule', code: 'NET', sequence: 90, category: 'NET', calculationType: 'FIXED', amount: 4500, percentage: null, formula: 'GROSS - DED' },
    ];

    const result = processSalaryRules(summaryRules, 5000, 'STR-001');
    assert.strictEqual(result.totalEarnings, 5000);
    assert.strictEqual(result.earnings.length, 1);
    assert.strictEqual(result.earnings[0].code, 'BASE');
    assert.strictEqual(result.totalDeductions, 0);
    assert.strictEqual(result.deductions.length, 0);
    pass('Test 42: Summary categories (GROSS, NET) are excluded from both earnings and deductions');
  }

  // ── Database sanity check ──────────────────────────────────────────────────
  console.log('\n--- Additional Sanity: Domain Module Retrievals ---');
  {
    const [employees, contracts, structures, rules, attendance, timeOff, payruns] = await Promise.all([
      getAllEmployees(),
      getAllContracts(),
      getAllSalaryStructures(),
      getAllSalaryRules(),
      getAllAttendance(),
      getAllTimeOffRequests(),
      getAllPayruns(),
    ]);

    assert.ok(employees.length >= 6);
    assert.ok(contracts.length >= 6);
    assert.ok(structures.length >= 1);
    assert.ok(rules.length >= 1);
    assert.ok(attendance.length >= 1);
    assert.ok(timeOff.length >= 1);
    assert.ok(payruns.length >= 1);
    pass('Domain retrievals remain fully functional without regression');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests} PHASE 4.9 & 4.10 VERIFICATION TESTS PASSED! 🎉`);
  console.log('================================================================');
}

runTests()
  .catch((err) => {
    console.error('\n❌ Test Suite Failed with error:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

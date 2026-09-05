/**
 * PeoplePay360 — Payroll Domain Loading Service
 *
 * Sits strictly between the MySQL data-access layer (Repositories) and the pure
 * in-memory Payroll Normalization Layer (payrollNormalizer.ts).
 *
 * Architectural Boundary:
 * MySQL / ORM
 *       ↓
 * Repositories / domain loading (payrollLoader.ts)
 *       ↓
 * Payroll normalization (payrollNormalizer.ts)
 *       ↓
 * PayrollCalculationInput (payroll.types.ts)
 *       ↓
 * Payroll Engine (payrollEngine.ts)
 *       ↓
 * Calculation Result (CalculatedPayslip)
 *
 * Guarantees:
 * - Pure engine boundary preserved: neither payrollEngine.ts nor payrollNormalizer.ts query the database.
 * - Centralizes database hydration so route controllers stay thin.
 * - Emits strongly typed PayrollCalculationInput instances ready for deterministic computation.
 */

import {
  getEmployeeById,
  getAllEmployees,
  EmployeeRecord,
} from '../repositories/employee.repository.js';
import {
  getContractsByEmployeeId,
  ContractRecord,
} from '../repositories/contract.repository.js';
import {
  getActiveSalaryRulesByStructureId,
} from '../repositories/salaryRule.repository.js';
import {
  getSalaryStructureById,
  SalaryStructureRecord,
} from '../repositories/salaryStructure.repository.js';
import {
  normalizePayrollCalculationInput,
} from './payrollNormalizer.js';
import {
  PayrollInputError,
  type PayrollCalculationInput,
  type RawPayrollDomainData,
} from '../types/payroll.types.js';

export interface LoadPayrunInputsOptions {
  employeeIds?: string[];
  payrollPeriod: string | { startDate: string; endDate: string };
  salaryStructureId?: string | null;
}

/**
 * Loads domain records for a single employee and returns the normalized
 * PayrollCalculationInput contract.
 *
 * Throws PayrollInputError('MISSING_EMPLOYEE') if employee does not exist.
 * Throws PayrollInputError('NO_VALID_CONTRACT') if no valid active contract exists for period.
 */
export async function loadEmployeePayrollInput(
  employeeId: string,
  payrollPeriod: string | { startDate: string; endDate: string },
  salaryStructureId?: string | null
): Promise<PayrollCalculationInput> {
  const trimmedId = String(employeeId || '').trim();
  if (!trimmedId) {
    throw new PayrollInputError('MISSING_EMPLOYEE', 'Employee ID is required for payroll calculation.');
  }

  const employee = await getEmployeeById(trimmedId);
  if (!employee) {
    throw new PayrollInputError(
      'MISSING_EMPLOYEE',
      `Employee '${trimmedId}' was not found in database.`
    );
  }

  // Load contracts associated with employee (checks by employee.id and original requested identifier)
  const contracts = await getContractsByEmployeeId(employee.id);

  // Resolve structure ID from parameter or active contract
  const activeContract = contracts.find((c) => c.status === 'ACTIVE') || contracts[0];
  const effectiveStructureId = salaryStructureId || activeContract?.salaryStructureId || activeContract?.structure || null;

  let structureData: { id: string; code: string; name: string } | null = null;
  let salaryRulesData: any[] = [];

  if (effectiveStructureId) {
    const struct = await getSalaryStructureById(effectiveStructureId);
    structureData = struct
      ? { id: struct.id, code: struct.code, name: struct.name }
      : { id: effectiveStructureId, code: 'STD_STRUCT', name: 'Salary Structure' };

    salaryRulesData = await getActiveSalaryRulesByStructureId(effectiveStructureId);
  }

  const rawDomain: RawPayrollDomainData = {
    employee,
    contracts,
    payrollPeriod,
    salaryStructure: structureData,
    salaryRules: salaryRulesData,
    attendanceRecords: [],
    timeOffRequests: [],
  };

  return normalizePayrollCalculationInput(rawDomain);
}

/**
 * Batch-loads domain records for payrun processing.
 *
 * If `employeeIds` is specified:
 * - Loads exactly those employees.
 * - Throws immediately if an employee does not exist or lacks a valid active contract for the period.
 *
 * If `employeeIds` is omitted:
 * - Loads all active employees from MySQL.
 * - Filters to employees who have at least one valid contract for the specified period.
 */
export async function loadPayrunPayrollInputs(
  options: LoadPayrunInputsOptions
): Promise<PayrollCalculationInput[]> {
  const { employeeIds, payrollPeriod, salaryStructureId } = options;

  let employeesToProcess: EmployeeRecord[] = [];

  if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
    for (const rawId of employeeIds) {
      const trimmed = String(rawId || '').trim();
      if (!trimmed) continue;
      const emp = await getEmployeeById(trimmed);
      if (!emp) {
        throw new PayrollInputError(
          'MISSING_EMPLOYEE',
          `Referenced employee '${trimmed}' does not exist in database.`
        );
      }
      employeesToProcess.push(emp);
    }
  } else {
    employeesToProcess = await getAllEmployees();
  }

  const calculationInputs: PayrollCalculationInput[] = [];

  // Cache structure and active rule queries to avoid redundant DB queries across employees
  const structureCache = new Map<string, { id: string; code: string; name: string }>();
  const rulesCache = new Map<string, any[]>();

  async function getStructure(structId: string) {
    if (!structureCache.has(structId)) {
      const s = await getSalaryStructureById(structId);
      structureCache.set(
        structId,
        s ? { id: s.id, code: s.code, name: s.name } : { id: structId, code: 'TECH_STD', name: 'Standard Full-Time Tech' }
      );
    }
    return structureCache.get(structId)!;
  }

  async function getRules(structId: string) {
    if (!rulesCache.has(structId)) {
      const r = await getActiveSalaryRulesByStructureId(structId);
      rulesCache.set(structId, r);
    }
    return rulesCache.get(structId)!;
  }

  for (const emp of employeesToProcess) {
    const contracts = await getContractsByEmployeeId(emp.id);

    // If explicit employee list was requested and employee has no contracts, this will throw
    // as required by Phase 4.3 specification.
    if (employeeIds && employeeIds.length > 0 && (!contracts || contracts.length === 0)) {
      throw new PayrollInputError(
        'NO_VALID_CONTRACT',
        `No contract records found for requested employee '${emp.name}' (${emp.id}).`
      );
    }

    // For bulk payruns without explicit employee filter, skip employees with zero contracts
    if (!employeeIds && (!contracts || contracts.length === 0)) {
      continue;
    }

    const activeContract = contracts.find((c) => c.status === 'ACTIVE') || contracts[0];
    const effectiveStructureId = salaryStructureId || activeContract?.salaryStructureId || activeContract?.structure || null;

    let structureData: { id: string; code: string; name: string } | null = null;
    let salaryRulesData: any[] = [];

    if (effectiveStructureId) {
      structureData = await getStructure(effectiveStructureId);
      salaryRulesData = await getRules(effectiveStructureId);
    }

    try {
      const rawDomain: RawPayrollDomainData = {
        employee: emp,
        contracts,
        payrollPeriod,
        salaryStructure: structureData,
        salaryRules: salaryRulesData,
        attendanceRecords: [],
        timeOffRequests: [],
      };

      const normalized = normalizePayrollCalculationInput(rawDomain);
      calculationInputs.push(normalized);
    } catch (err) {
      // If explicit employee was requested, propagate the contract error
      if (employeeIds && employeeIds.length > 0) {
        throw err;
      }
      // In bulk mode, skip inactive/uncontracted staff
      if (err instanceof PayrollInputError && (err.code === 'NO_VALID_CONTRACT' || err.code === 'MISSING_CONTRACT')) {
        continue;
      }
      throw err;
    }
  }

  return calculationInputs;
}

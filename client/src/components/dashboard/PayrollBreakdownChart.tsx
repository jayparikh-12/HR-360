import React from 'react';
import { Building2, ArrowRight, Layers } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface PayrollBreakdownChartProps {
  departmentCosts: Record<string, number>;
  totalPayrollCost: number;
  selectedDepartment?: string;
  onSelectDepartment?: (dept: string) => void;
  onViewStaff?: () => void;
  loading?: boolean;
}

export const PayrollBreakdownChart: React.FC<PayrollBreakdownChartProps> = ({
  departmentCosts,
  totalPayrollCost,
  selectedDepartment,
  onSelectDepartment,
  onViewStaff,
  loading = false,
}) => {
  // Sort departments by expenditure DESC
  const sortedEntries = Object.entries(departmentCosts || {})
    .filter(([_, cost]) => cost > 0)
    .sort((a, b) => b[1] - a[1]);

  const hasData = sortedEntries.length > 0;
  const maxSpend = hasData ? Math.max(...sortedEntries.map(([_, c]) => c)) : 1;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Payroll Allocation by Department
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '3px 0 0 0' }}>
            Proportional wage distribution across organizational departments.
          </p>
        </div>

        {onViewStaff && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onViewStaff}
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Staff Directory</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--slate-400)', fontSize: '13px' }}>Loading department breakdown…</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !hasData && (
        <div
          style={{
            height: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--slate-500)',
            background: 'var(--slate-50)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border-color)',
            padding: '20px',
          }}
        >
          <Layers size={32} color="var(--slate-400)" />
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
            No Department Payroll Allocation Found
          </div>
          <div style={{ fontSize: '12px', textAlign: 'center', maxWidth: '340px' }}>
            {selectedDepartment && selectedDepartment !== 'ALL'
              ? `No active payroll expenses logged for department "${selectedDepartment}".`
              : 'Enrolled employee contracts or payruns will automatically populate department cost allocations.'}
          </div>
        </div>
      )}

      {/* Department Progress Bars */}
      {!loading && hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {sortedEntries.map(([dept, cost]) => {
            const pctOfTotal =
              totalPayrollCost > 0 ? Math.round((cost / totalPayrollCost) * 100) : 0;
            const barWidth = maxSpend > 0 ? Math.min(100, Math.max(3, (cost / maxSpend) * 100)) : 0;
            const isSelected =
              selectedDepartment &&
              selectedDepartment !== 'ALL' &&
              dept.trim().toLowerCase() === selectedDepartment.trim().toLowerCase();

            return (
              <div
                key={dept}
                onClick={() => onSelectDepartment && onSelectDepartment(dept)}
                style={{
                  cursor: onSelectDepartment ? 'pointer' : 'default',
                  padding: isSelected ? '8px 10px' : '4px 0',
                  background: isSelected ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                  border: isSelected ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid transparent',
                  borderRadius: '6px',
                  transition: 'background 0.2s ease',
                }}
                title={onSelectDepartment ? `Click to filter dashboard by ${dept}` : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                      {dept}
                    </span>
                    {isSelected && (
                      <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 5px' }}>
                        Active Filter
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {formatCurrency(cost)}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--slate-500)', minWidth: '40px', textAlign: 'right' }}>
                      {pctOfTotal}%
                    </span>
                  </div>
                </div>

                {/* Progress Track */}
                <div style={{ width: '100%', height: '7px', background: 'var(--slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: isSelected
                        ? 'linear-gradient(90deg, var(--primary) 0%, #059669 100%)'
                        : 'linear-gradient(90deg, var(--primary) 0%, #818cf8 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Total */}
      {!loading && hasData && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
          fontSize: '12px',
          color: 'var(--slate-600)'
        }}>
          <span>Total Department Allocation:</span>
          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
            {formatCurrency(totalPayrollCost)}
          </strong>
        </div>
      )}
    </div>
  );
};

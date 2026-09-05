import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  TrendingUp,
} from 'lucide-react';

import { PageHeader } from '../layout/PageHeader';
import { MetricCard } from '../data-display/MetricCard';
import { SmartStatPill } from '../data-display/SmartStatPill';
import { StatusBadge } from '../feedback/StatusBadge';
import { AlertBanner } from '../feedback/AlertBanner';
import { Stepper, StepItem } from '../data-display/Stepper';
import { DataTable, ColumnDef } from '../data-display/DataTable';
import { EmptyState } from '../data-display/EmptyState';
import { Skeleton } from '../feedback/Skeleton';
import {
  TextInput,
  SelectDropdown,
  ToggleSwitch,
  SearchInput,
  DatePicker,
} from '../forms';

export interface ComponentShowcaseViewProps {
  onNavigate?: (tab: string) => void;
}

interface DemoTableItem {
  id: string;
  name: string;
  department: string;
  wage: number;
  status: string;
}

export const ComponentShowcaseView: React.FC<ComponentShowcaseViewProps> = ({
  onNavigate,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [toggleState, setToggleState] = useState<boolean>(true);
  const [inputValue, setInputValue] = useState<string>('John Doe');

  const demoSteps: StepItem[] = [
    { label: 'Scope Selection', status: 'complete' },
    { label: 'Employee Checklist', status: 'current' },
    { label: 'Computation & Audit', status: 'upcoming' },
    { label: 'Disbursement', status: 'upcoming' },
  ];

  const demoTableData: DemoTableItem[] = [
    { id: 'EMP-001', name: 'John Doe', department: 'Engineering', wage: 6500, status: 'ACTIVE' },
    { id: 'EMP-002', name: 'Maya Lin', department: 'Product', wage: 7200, status: 'ACTIVE' },
    { id: 'EMP-003', name: 'Alex Rivera', department: 'Finance', wage: 5200, status: 'PROBATION' },
  ];

  const demoColumns: ColumnDef<DemoTableItem>[] = [
    { header: 'ID', accessor: 'id', width: '100px' },
    { header: 'Name', accessor: 'name' },
    { header: 'Department', accessor: 'department' },
    {
      header: 'Monthly Wage',
      render: (item: DemoTableItem) => `$${item.wage.toLocaleString()}`,
    },
    {
      header: 'Status',
      render: (item: DemoTableItem) => <StatusBadge status={item.status} size="sm" />,
    },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* 1. Page Header */}
      <PageHeader
        title="PeoplePay360 Design System Showcase"
        description="Master interactive catalog of production UI primitives and data-display components."
        badge={<StatusBadge status="ACTIVE" size="sm">Design System v1.0</StatusBadge>}
        actions={
          onNavigate && (
            <button
              onClick={() => onNavigate('dashboard')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          )
        }
      />

      {/* 2. Alert Banners */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Alert Banners & Notifications
        </h2>
        <AlertBanner
          type="info"
          title="Information"
          message="Active pay cycle for September 2026 is currently open."
          action={{ label: 'View Cycle', onClick: () => onNavigate?.('payruns') }}
        />
        <AlertBanner
          type="warning"
          title="Attention Required"
          message="1 employee has an unapproved leave request pending review."
        />
      </section>

      {/* 3. Metric KPI Cards */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Executive Metric Cards
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <MetricCard
            title="Total Monthly Payroll"
            value="$40,000"
            trend={{ delta: '4.2% vs last cycle', isPositive: true }}
            icon={CreditCard}
            color="#4f46e5"
          />
          <MetricCard
            title="Active Workforce"
            value="6 Employees"
            icon={Users}
            subtext="100% contracts active"
            color="#059669"
          />
          <MetricCard
            title="Attendance Health"
            value="98.2%"
            trend={{ delta: '1.1% increase', isPositive: true }}
            icon={Clock}
            color="#d97706"
          />
        </div>
      </section>

      {/* 4. Smart Stat Pills & Status Badges */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Smart Stat Pills & Semantic Status Badges
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <SmartStatPill label="Contracts" count="6 Active" icon={FileText} variant="active" />
          <SmartStatPill label="Attendance" count="98%" icon={Clock} variant="info" />
          <SmartStatPill label="Time Off" count="3 Pending" icon={Calendar} variant="warning" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="PROBATION" />
          <StatusBadge status="TERMINATED" />
          <StatusBadge status="PRESENT" />
          <StatusBadge status="LATE" />
          <StatusBadge status="ABSENT" />
          <StatusBadge status="COMPUTED" />
          <StatusBadge status="PAID" />
        </div>
      </section>

      {/* 5. Stepper Wizard */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          4-Stage Workflow Stepper
        </h2>
        <div style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <Stepper
            steps={demoSteps}
            currentStep={currentStep}
            onStepClick={(idx: number) => setCurrentStep(idx)}
          />
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Current Step: <strong>{demoSteps[currentStep]?.label}</strong>
          </div>
        </div>
      </section>

      {/* 6. Form Inputs & Controls */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Form Controls & Inputs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <TextInput
            label="Full Employee Name"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            placeholder="e.g. John Doe"
          />
          <SelectDropdown
            label="Department"
            defaultValue="Engineering"
            options={[
              { label: 'Engineering', value: 'Engineering' },
              { label: 'Finance', value: 'Finance' },
              { label: 'Product', value: 'Product' },
              { label: 'Human Resources', value: 'Human Resources' },
            ]}
          />
          <SearchInput placeholder="Filter staff..." />
          <DatePicker label="Contract Start Date" defaultValue="2026-09-01" />
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
            <ToggleSwitch
              label="Automatic TDS / PF Withholding"
              checked={toggleState}
              onChange={(checked: boolean) => setToggleState(checked)}
            />
          </div>
        </div>
      </section>

      {/* 7. Data Table */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Configurable Data Table
        </h2>
        <DataTable
          columns={demoColumns}
          data={demoTableData}
          onRowClick={(item: DemoTableItem) => console.log('Selected employee:', item.name)}
        />
      </section>

      {/* 8. Skeletons & Empty State */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1e293b' }}>
          Loading Skeletons & Zero-State Fallback
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#64748b' }}>
              Skeleton Loader Preview
            </h3>
            <Skeleton height="32px" width="60%" style={{ marginBottom: '12px' }} />
            <Skeleton height="18px" width="100%" style={{ marginBottom: '8px' }} />
            <Skeleton height="18px" width="80%" />
          </div>

          <EmptyState
            title="No payslips generated"
            description="Run the 2-step payrun wizard to compute salary calculations for this cycle."
            icon={TrendingUp}
            actionLabel="Launch Payrun Wizard"
            onAction={() => onNavigate?.('payruns')}
          />
        </div>
      </section>
    </div>
  );
};

export default ComponentShowcaseView;

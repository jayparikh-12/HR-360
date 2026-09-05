import React, { useState } from 'react';
import { 
  Search, 
  FileText, 
  Clock, 
  Palmtree, 
  DollarSign, 
  ArrowLeft,
  Building,
  CreditCard
} from 'lucide-react';
import type { Employee } from '../types';

interface EmployeesProps {
  employees: Employee[];
  onNavigateTab: (tab: string) => void;
}

export const Employees: React.FC<EmployeesProps> = ({ employees, onNavigateTab }) => {
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const filtered = employees.filter((emp) => {
    const matchSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
                        emp.email.toLowerCase().includes(search.toLowerCase()) ||
                        emp.id.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'ALL' || emp.department === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <div>
      {/* If an employee is selected, render Employee 360 Hub! */}
      {selectedEmp ? (
        <div>
          {/* Back button */}
          <div style={{ marginBottom: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmp(null)}>
              <ArrowLeft size={13} /> Back to Directory
            </button>
          </div>

          {/* Profile Header Card */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                  {selectedEmp.avatarInitials}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--slate-900)' }}>{selectedEmp.name}</h2>
                    <span className={`badge ${selectedEmp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      <span className="badge-dot" />
                      {selectedEmp.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    {selectedEmp.position} • {selectedEmp.department} • ID: {selectedEmp.id}
                  </div>
                </div>
              </div>

              {/* SMART STAT ACTION BUTTONS (Crucial from blueprint) */}
              <div className="smart-pills-bar" style={{ marginBottom: 0 }}>
                <div className="smart-pill" onClick={() => alert(`Active Contract: ${selectedEmp.activeContractId}\nWage: $${selectedEmp.wage}/mo\nSchedule: ${selectedEmp.schedule}`)}>
                  <FileText size={14} color="var(--primary)" />
                  <span>Contract: <strong>1 Active</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('attendance')}>
                  <Clock size={14} color="#059669" />
                  <span>Attendance: <strong>{selectedEmp.attendanceRate}%</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('time-off')}>
                  <Palmtree size={14} color="#d97706" />
                  <span>Time Off: <strong>{selectedEmp.leaveBalance}d Left</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('payruns')}>
                  <DollarSign size={14} color="var(--primary)" />
                  <span>Wage: <strong>${selectedEmp.wage.toLocaleString()}/mo</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Job & Org */}
            <div className="card">
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="var(--primary)" /> Job & Organization
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Department</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.department}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Work Email</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Working Schedule</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.schedule}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Joined Organization</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.joinDate}</span>
                </div>
              </div>
            </div>

            {/* Compensation & Bank */}
            <div className="card">
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} color="var(--primary)" /> Compensation & Bank Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Base Monthly Wage</span>
                  <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>${selectedEmp.wage.toLocaleString()}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Salary Structure</span>
                  <span style={{ fontWeight: 600 }}>Standard Tech (Basic + HRA + Allowances)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Disbursement Bank</span>
                  <span style={{ fontWeight: 600 }}>Chase Enterprise ({selectedEmp.bankAccount})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Tax Status</span>
                  <span className="badge badge-success">Standard W-2 Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Employee Directory List */
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Employee Directory</h1>
              <p className="page-desc">Central operational hub for {employees.length} active staff members.</p>
            </div>
          </div>

          <div className="table-container">
            {/* Filter / Search Bar */}
            <div className="table-search-bar">
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
                <div className="search-box" style={{ width: '240px' }}>
                  <Search size={14} color="var(--slate-400)" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select 
                  className="role-select" 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="ALL">All Departments</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Finance">Finance</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                Showing {filtered.length} of {employees.length} employees
              </div>
            </div>

            {/* Table */}
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department & Role</th>
                  <th>Contract Wage</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar">{emp.avatarInitials}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{emp.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{emp.department}</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.position}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>${emp.wage.toLocaleString()}/mo</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.schedule}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: emp.attendanceRate >= 95 ? '#047857' : '#b45309' }}>
                        {emp.attendanceRate}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${emp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                        <span className="badge-dot" />
                        {emp.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmp(emp)}>
                        Open 360 Hub
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

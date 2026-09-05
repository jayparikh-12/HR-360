const BASE_URL = 'http://localhost:5000/api';

async function main() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@company.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token;

  const authHeaders = { Authorization: `Bearer ${token}` };

  const empsRes = await fetch(`${BASE_URL}/employees`, { headers: authHeaders });
  const emps = (await empsRes.json()).data;
  console.log('Employees:', emps.map(e => ({ id: e.id, name: e.name, activeContractId: e.activeContractId })));

  const contractsRes = await fetch(`${BASE_URL}/contracts`, { headers: authHeaders });
  const contracts = (await contractsRes.json()).data;
  console.log('Contracts:', contracts.map(c => ({ id: c.id, empId: c.employeeId, empName: c.employeeName, wage: c.wage, structure: c.salaryStructure })));

  const attRes = await fetch(`${BASE_URL}/attendance`, { headers: authHeaders });
  const att = (await attRes.json()).data;
  console.log('Attendance records:', att.map(a => ({ id: a.id, empId: a.employeeId, empName: a.employeeName, date: a.date, status: a.status })));

  const toRes = await fetch(`${BASE_URL}/time-off`, { headers: authHeaders });
  const to = (await toRes.json()).data;
  console.log('Time Off requests:', to.map(t => ({ id: t.id, empId: t.employeeId, empName: t.employeeName, type: t.leaveType, status: t.status })));

  const structRes = await fetch(`${BASE_URL}/salary-structures`, { headers: authHeaders });
  const structs = (await structRes.json()).data;
  console.log('Salary structures:', structs);

  const rulesRes = await fetch(`${BASE_URL}/salary-rules`, { headers: authHeaders });
  const rules = (await rulesRes.json()).data;
  console.log('Salary rules count:', rules.length);

  const payrunsRes = await fetch(`${BASE_URL}/payroll/payruns`, { headers: authHeaders });
  const payruns = (await payrunsRes.json()).data;
  console.log('Total payruns:', payruns.length);
  console.log('First payrun payslips:', payruns[0]?.payslips?.length);
}

main().catch(console.error);

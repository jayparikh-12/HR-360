import React from 'react';

export interface ColumnDef<T = any> {
  key?: string;
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  render?: (item: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T = any> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T = any>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  loading,
}: DataTableProps<T>) {
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: '#475569',
                  textAlign: col.align || 'left',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => {
              const rowKey = keyExtractor ? keyExtractor(item, rowIdx) : (item as any).id || rowIdx;
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((col, colIdx) => {
                    let cellContent: React.ReactNode;
                    if (col.render) {
                      cellContent = col.render(item);
                    } else if (typeof col.accessor === 'function') {
                      cellContent = col.accessor(item);
                    } else if (col.accessor) {
                      cellContent = (item as any)[col.accessor];
                    } else if (col.key) {
                      cellContent = (item as any)[col.key];
                    } else {
                      cellContent = null;
                    }

                    return (
                      <td
                        key={col.key || colIdx}
                        style={{
                          padding: '12px 16px',
                          color: '#1e293b',
                          textAlign: col.align || 'left',
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

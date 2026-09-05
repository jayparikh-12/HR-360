import React from 'react';

// 1. TextInput
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ElementType | React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  leftIcon: LeftIcon,
  style,
  ...props
}) => {
  return (
    <div style={{ marginBottom: '14px', ...style }}>
      {label && (
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {LeftIcon && (
          <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', display: 'flex' }}>
            {typeof LeftIcon === 'function' ? <LeftIcon size={16} /> : LeftIcon}
          </span>
        )}
        <input
          {...props}
          style={{
            width: '100%',
            padding: LeftIcon ? '8px 12px 8px 34px' : '8px 12px',
            fontSize: '14px',
            borderRadius: '6px',
            border: `1px solid ${error ? '#ef4444' : '#cbd5e1'}`,
            outline: 'none',
            backgroundColor: '#ffffff',
          }}
        />
      </div>
      {(error || helperText) && (
        <span style={{ display: 'block', fontSize: '12px', marginTop: '4px', color: error ? '#ef4444' : '#64748b' }}>
          {error || helperText}
        </span>
      )}
    </div>
  );
};

// 2. SelectDropdown
export interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: Array<{ label: string; value: string | number }>;
  children?: React.ReactNode;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  label,
  error,
  options,
  children,
  style,
  ...props
}) => {
  return (
    <div style={{ marginBottom: '14px', ...style }}>
      {label && (
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '14px',
          borderRadius: '6px',
          border: `1px solid ${error ? '#ef4444' : '#cbd5e1'}`,
          outline: 'none',
          backgroundColor: '#ffffff',
        }}
      >
        {options ? options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        )) : children}
      </select>
      {error && (
        <span style={{ display: 'block', fontSize: '12px', marginTop: '4px', color: '#ef4444' }}>
          {error}
        </span>
      )}
    </div>
  );
};

// 3. ToggleSwitch
export interface ToggleSwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  checked,
  onChange,
  disabled,
}) => {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: '36px',
          height: '20px',
          backgroundColor: checked ? '#4f46e5' : '#cbd5e1',
          borderRadius: '10px',
          position: 'relative',
          transition: 'background-color 0.2s',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            transition: 'left 0.2s',
          }}
        />
      </div>
      {label && <span>{label}</span>}
    </label>
  );
};

// 4. SearchInput
export interface SearchInputProps extends Omit<TextInputProps, 'leftIcon'> {
  onSearch?: (value: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = (props) => {
  return <TextInput {...props} type="search" placeholder={props.placeholder || 'Search...'} />;
};

// 5. DatePicker
export const DatePicker: React.FC<TextInputProps> = (props) => {
  return <TextInput {...props} type="date" />;
};

// 6. NumberInput
export const NumberInput: React.FC<TextInputProps> = (props) => {
  return <TextInput {...props} type="number" />;
};

import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      className,
      label,
      description,
      checked,
      onChange,
      size = 'md',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const sizes = {
      sm: {
        track: 'w-8 h-5',
        thumb: 'w-3.5 h-3.5',
        translate: 'translate-x-3.5',
      },
      md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-5',
      },
      lg: {
        track: 'w-14 h-7',
        thumb: 'w-6 h-6',
        translate: 'translate-x-7',
      },
    };

    return (
      <div className={clsx('flex items-start gap-3', className)}>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={label ? `${inputId}-label` : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={clsx(
            'relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizes[size].track,
            checked ? 'bg-primary-600' : 'bg-slate-200'
          )}
        >
          <span
            className={clsx(
              'pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
              sizes[size].thumb,
              'absolute top-0.5 left-0.5',
              checked && sizes[size].translate
            )}
          />
        </button>
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                id={`${inputId}-label`}
                htmlFor={inputId}
                className={clsx(
                  'text-sm font-medium cursor-pointer',
                  disabled ? 'text-slate-400' : 'text-slate-700'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

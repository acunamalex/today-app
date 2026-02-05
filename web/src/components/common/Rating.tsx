import { useState } from 'react';
import { clsx } from 'clsx';
import { Star } from 'lucide-react';

export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  showValue?: boolean;
  label?: string;
}

export function Rating({
  value,
  onChange,
  max = 5,
  size = 'md',
  readonly = false,
  showValue = false,
  label,
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const displayValue = hoverValue ?? value;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= displayValue;

          return (
            <button
              key={starValue}
              type="button"
              disabled={readonly}
              onClick={() => onChange?.(starValue)}
              onMouseEnter={() => !readonly && setHoverValue(starValue)}
              onMouseLeave={() => setHoverValue(null)}
              className={clsx(
                'transition-all duration-150',
                !readonly && 'cursor-pointer hover:scale-110',
                readonly && 'cursor-default'
              )}
              aria-label={`Rate ${starValue} out of ${max}`}
            >
              <Star
                className={clsx(
                  sizes[size],
                  'transition-colors duration-150',
                  isFilled
                    ? 'fill-warning-500 text-warning-500'
                    : 'fill-transparent text-slate-300'
                )}
              />
            </button>
          );
        })}
        {showValue && (
          <span className="ml-2 text-sm font-medium text-slate-600">
            {value}/{max}
          </span>
        )}
      </div>
    </div>
  );
}

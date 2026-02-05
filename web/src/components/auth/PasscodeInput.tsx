import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { clsx } from 'clsx';

export interface PasscodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PasscodeInput({
  length = 4,
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  autoFocus = true,
}: PasscodeInputProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasCalledComplete = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset the completion flag when value changes to less than full
  useEffect(() => {
    if (value.length < length) {
      hasCalledComplete.current = false;
    }
  }, [value.length, length]);

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Focus appropriate input when value changes
  useEffect(() => {
    const nextIndex = value.length < length ? value.length : length - 1;
    setFocusedIndex(nextIndex);
    inputRefs.current[nextIndex]?.focus();
  }, [value.length, length]);

  // Trigger onComplete when passcode is filled (only once)
  useEffect(() => {
    if (value.length === length && onCompleteRef.current && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onCompleteRef.current(value);
    }
  }, [value, length]);

  const handleChange = (index: number, inputValue: string) => {
    // Only accept digits
    const digit = inputValue.replace(/\D/g, '').slice(-1);

    if (!digit && inputValue) return;

    // Build new value
    const newValue = value.substring(0, index) + digit + value.substring(index + 1);

    // Ensure we don't exceed length
    onChange(newValue.slice(0, length));

    // Move to next input if we have a digit
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[index]) {
        // Clear current digit
        const newValue = value.substring(0, index) + value.substring(index + 1);
        onChange(newValue);
      } else if (index > 0) {
        // Move to previous input and clear it
        inputRefs.current[index - 1]?.focus();
        const newValue = value.substring(0, index - 1) + value.substring(index);
        onChange(newValue);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.select();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => handleFocus(index)}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`Digit ${index + 1}`}
            className={clsx(
              'w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-danger-500 focus:ring-danger-500 bg-danger-50'
                : focusedIndex === index
                ? 'border-primary-500 focus:ring-primary-500'
                : value[index]
                ? 'border-primary-300 bg-primary-50'
                : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500'
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-danger-500 animate-fade-in">{error}</p>
      )}
    </div>
  );
}

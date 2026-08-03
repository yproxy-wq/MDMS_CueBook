import React, { useEffect, useRef, useState } from 'react';

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  initialValue: string;
  onChange: (value: string) => void;
  delay?: number;
}

export const DebouncedTextarea: React.FC<DebouncedTextareaProps> = ({ initialValue, onChange, delay = 450, onBlur, ...props }) => {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<number | null>(null);

  const flush = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChange(value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  return <textarea {...props} value={value} onChange={(event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      onChange(nextValue);
    }, delay);
  }} onBlur={(event) => {
    flush();
    onBlur?.(event);
  }} />;
};

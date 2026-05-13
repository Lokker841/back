import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 ' +
  'placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

export const selectCls = (hasValue: boolean) =>
  cn(
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
    hasValue ? 'text-gray-900' : 'text-gray-500',
  );

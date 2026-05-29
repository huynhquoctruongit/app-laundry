export const colors = {
  // Primary brand
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#dbeafe',
  primaryForeground: '#ffffff',

  // Status colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Order status colors
  statusCreated: '#6b7280',
  statusReceived: '#3b82f6',
  statusWashing: '#f59e0b',
  statusReady: '#8b5cf6',
  statusDelivered: '#10b981',
  statusCancelled: '#ef4444',

  // Surfaces
  background: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  // Text
  text: '#111827',
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',
  textInverse: '#ffffff',

  // Misc
  shadow: '#0000001a',
  overlay: '#00000080',
  inputBg: '#ffffff',
  hover: '#f3f4f6',
} as const;

export type ColorKey = keyof typeof colors;

export const VoipServiceStatus = {
  ACTIVE: 'ACTIVE',
  LOW_BALANCE: 'LOW_BALANCE',
  ZERO_BALANCE: 'ZERO_BALANCE',
} as const;

export type VoipServiceStatus = (typeof VoipServiceStatus)[keyof typeof VoipServiceStatus];

export const SipAccountStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;

export type SipAccountStatus = (typeof SipAccountStatus)[keyof typeof SipAccountStatus];

export const PhoneNumberStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type PhoneNumberStatus = (typeof PhoneNumberStatus)[keyof typeof PhoneNumberStatus];

export const CallDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;

export type CallDirection = (typeof CallDirection)[keyof typeof CallDirection];

export const CallStatus = {
  INITIATED: 'INITIATED',
  RINGING: 'RINGING',
  ANSWERED: 'ANSWERED',
  COMPLETED: 'COMPLETED',
  BUSY: 'BUSY',
  NO_ANSWER: 'NO_ANSWER',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const TransactionType = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const ReservationStatus = {
  ACTIVE: 'ACTIVE',
  RELEASED: 'RELEASED',
  CONSUMED: 'CONSUMED',
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const NotificationType = {
  LOW_BALANCE: 'LOW_BALANCE',
  ZERO_BALANCE: 'ZERO_BALANCE',
  WELCOME: 'WELCOME',
  SUSPENDED: 'SUSPENDED',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ProviderName = {
  TELNYX: 'telnyx',
} as const;

export type ProviderName = (typeof ProviderName)[keyof typeof ProviderName];

export const DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE = '0.016';
export const DEFAULT_RESERVE_MINUTES = 5;
export const DEFAULT_MAX_CALL_DURATION_MINUTES = 60;
export const DEFAULT_BILLING_INCREMENT_SECONDS = 60;
export const DEFAULT_MINIMUM_BILLABLE_SECONDS = 60;
export const DEFAULT_CURRENCY = 'USD';

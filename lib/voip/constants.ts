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
  RESERVATION: 'RESERVATION',
  RELEASE: 'RELEASE',
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
  KYC_SUBMITTED: 'KYC_SUBMITTED',
  KYC_UNDER_REVIEW: 'KYC_UNDER_REVIEW',
  KYC_MORE_INFORMATION_REQUIRED: 'KYC_MORE_INFORMATION_REQUIRED',
  KYC_APPROVED: 'KYC_APPROVED',
  KYC_REJECTED: 'KYC_REJECTED',
  KYC_SUSPENDED: 'KYC_SUSPENDED',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ProviderName = {
  TELNYX: 'telnyx',
} as const;

export type ProviderName = (typeof ProviderName)[keyof typeof ProviderName];

export const CarrierType = {
  API: 'API',
  SIP_GATEWAY: 'SIP_GATEWAY',
} as const;

export type CarrierType = (typeof CarrierType)[keyof typeof CarrierType];

export const CarrierAuthType = {
  IP_AUTH: 'IP_AUTH',
  CREDENTIAL_AUTH: 'CREDENTIAL_AUTH',
} as const;

export type CarrierAuthType = (typeof CarrierAuthType)[keyof typeof CarrierAuthType];

export const CarrierStatus = {
  TEST: 'TEST',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type CarrierStatus = (typeof CarrierStatus)[keyof typeof CarrierStatus];

export const Transport = {
  UDP: 'UDP',
  TCP: 'TCP',
  TLS: 'TLS',
} as const;

export type Transport = (typeof Transport)[keyof typeof Transport];

export const CliMode = {
  FIXED: 'FIXED',
  POOL: 'POOL',
  PASS_THROUGH: 'PASS_THROUGH',
} as const;

export type CliMode = (typeof CliMode)[keyof typeof CliMode];

export const DestinationType = {
  FIXED: 'FIXED',
  MOBILE: 'MOBILE',
  ALL: 'ALL',
} as const;

export type DestinationType = (typeof DestinationType)[keyof typeof DestinationType];

export const DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE = '0.016';
export const DEFAULT_RESERVE_MINUTES = 5;
export const DEFAULT_MAX_CALL_DURATION_MINUTES = 60;
export const DEFAULT_BILLING_INCREMENT_SECONDS = 60;
export const DEFAULT_MINIMUM_BILLABLE_SECONDS = 60;
export const DEFAULT_CURRENCY = 'USD';

// Wallet reservations expire well beyond the maximum call duration so a
// sweeper can safely reclaim funds from calls that never reached a final
// state. In-progress calls get their reservation extended, never released.
export const WALLET_RESERVATION_TTL_MS = 2 * 60 * 60 * 1000;

import { describe, it, expect } from 'vitest';
import {
  normalizeDestination,
  validateDestination,
  NormalizationError,
} from '@/lib/voip/services/normalization';
import { DestinationType } from '@/lib/voip/constants';

describe('Destination normalization', () => {
  it('parses a Greek mobile number', () => {
    const result = normalizeDestination('+306912345678');
    expect(result.countryCode).toBe('30');
    expect(result.countryIso).toBe('GR');
    expect(result.nationalNumber).toBe('6912345678');
    expect(result.destinationType).toBe(DestinationType.MOBILE);
  });

  it('parses a Greek fixed-line number', () => {
    const result = normalizeDestination('+302101234567');
    expect(result.countryCode).toBe('30');
    expect(result.destinationType).toBe(DestinationType.FIXED);
  });

  it('parses all supplied Teloz test destinations', () => {
    const cases = [
      { input: '+302101234567', code: '30', iso: 'GR' },
      { input: '+37061234567', code: '370', iso: 'LT' },
      { input: '+37251234567', code: '372', iso: 'EE' },
      { input: '+40211234567', code: '40', iso: 'RO' },
      { input: '+37121234567', code: '371', iso: 'LV' },
      { input: '+35921234567', code: '359', iso: 'BG' },
      { input: '+38611234567', code: '386', iso: 'SI' },
      { input: '+431234567', code: '43', iso: 'AT' },
      { input: '+38511234567', code: '385', iso: 'HR' },
      { input: '+35621234567', code: '356', iso: 'MT' },
    ];

    for (const { input, code, iso } of cases) {
      const result = normalizeDestination(input);
      expect(result.countryCode).toBe(code);
      expect(result.countryIso).toBe(iso);
    }
  });

  it('handles numbers with formatting characters', () => {
    const result = normalizeDestination('+30 (210) 123-4567');
    expect(result.digits).toBe('302101234567');
    expect(result.e164).toBe('+302101234567');
  });

  it('rejects a US-only legacy destination', () => {
    expect(validateDestination('+15551234567')).toBe(true);
  });

  it('rejects missing leading plus', () => {
    expect(() => normalizeDestination('306912345678')).toThrow(NormalizationError);
  });

  it('rejects unknown country code', () => {
    expect(() => normalizeDestination('+9991234567')).toThrow(NormalizationError);
  });

  it('rejects too short numbers', () => {
    expect(() => normalizeDestination('+30')).toThrow(NormalizationError);
  });

  it('rejects non-numeric characters', () => {
    expect(() => normalizeDestination('+30-abc-123')).toThrow(NormalizationError);
  });
});

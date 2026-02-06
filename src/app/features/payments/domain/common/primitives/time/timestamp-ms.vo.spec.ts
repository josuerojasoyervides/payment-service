import { TimestampMs } from './timestamp-ms.vo';

describe('TimestampMs', () => {
  describe('from', () => {
    it('should create a valid TimestampMs from epoch ms', () => {
      const value = 1700000000000; // 2023 in ms
      const result = TimestampMs.from(value);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(value);
      }
    });

    it('should accept zero', () => {
      const result = TimestampMs.from(0);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(0);
      }
    });

    it('should accept large valid epoch ms (2030)', () => {
      const value = 1893456000000; // 2030
      const result = TimestampMs.from(value);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(value);
      }
    });

    it('should accept historical epoch ms (2000)', () => {
      const value = 946684800000; // 2000
      const result = TimestampMs.from(value);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(value);
      }
    });

    it('should fail for negative value', () => {
      const result = TimestampMs.from(-1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].code).toBe('TIMESTAMP_MS_NEGATIVE');
      }
    });

    it('should fail for NaN', () => {
      const result = TimestampMs.from(Number.NaN);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('TIMESTAMP_MS_NOT_FINITE');
      }
    });

    it('should fail for Infinity', () => {
      const result = TimestampMs.from(Number.POSITIVE_INFINITY);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('TIMESTAMP_MS_NOT_FINITE');
      }
    });

    it('should fail for -Infinity (not finite)', () => {
      const result = TimestampMs.from(Number.NEGATIVE_INFINITY);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('TIMESTAMP_MS_NOT_FINITE');
      }
    });

    describe('rejectLikelySeconds option', () => {
      it('should accept value above threshold when rejectLikelySeconds is true', () => {
        const value = 1700000000000; // 2023 in ms
        const result = TimestampMs.from(value, { rejectLikelySeconds: true });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe(value);
        }
      });

      it('should reject value that looks like seconds when rejectLikelySeconds is true', () => {
        const valueInSeconds = 1700000000; // 2023 in seconds
        const result = TimestampMs.from(valueInSeconds, { rejectLikelySeconds: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('TIMESTAMP_MS_LIKELY_SECONDS');
          expect(result.violations[0].meta?.['threshold']).toBe(1e11);
        }
      });

      it('should accept value below threshold when rejectLikelySeconds is false (default)', () => {
        const valueInSeconds = 1700000000;
        const result = TimestampMs.from(valueInSeconds);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe(valueInSeconds);
        }
      });
    });

    it('should fail for non-number type', () => {
      const result = TimestampMs.from('not a number' as unknown as number);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('TIMESTAMP_MS_NOT_A_NUMBER');
      }
    });
  });

  describe('now', () => {
    it('should return a TimestampMs with value close to Date.now()', () => {
      const before = Date.now();
      const result = TimestampMs.now();
      const after = Date.now();

      expect(result.value).toBeGreaterThanOrEqual(before);
      expect(result.value).toBeLessThanOrEqual(after + 1);
    });
  });

  describe('LIKELY_SECONDS_THRESHOLD', () => {
    it('should expose the threshold constant', () => {
      expect(TimestampMs.LIKELY_SECONDS_THRESHOLD).toBe(1e11);
    });
  });
});

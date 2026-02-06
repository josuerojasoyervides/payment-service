import { FlowId } from './flow-id.vo';

describe('FlowId', () => {
  describe('from', () => {
    it('should create a valid FlowId from a valid string', () => {
      const result = FlowId.from('flow_lxyz123_abc1def2');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('flow_lxyz123_abc1def2');
      }
    });

    it('should trim whitespace from the input', () => {
      const result = FlowId.from('  flow_abc_123  ');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('flow_abc_123');
      }
    });

    it('should accept format matching defaultFlowIdGenerator', () => {
      const value = `flow_${(1700000000000).toString(36)}_a1b2c3d4`;
      const result = FlowId.from(value);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(value);
      }
    });

    it('should fail for empty string', () => {
      const result = FlowId.from('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_EMPTY');
      }
    });

    it('should fail for whitespace-only string', () => {
      const result = FlowId.from('   ');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_EMPTY');
      }
    });

    it('should fail when prefix is missing', () => {
      const result = FlowId.from('notflow_abc_123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_MISSING_PREFIX');
      }
    });

    it('should fail when prefix is wrong case', () => {
      const result = FlowId.from('Flow_abc_123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_MISSING_PREFIX');
      }
    });

    it('should fail for string exceeding max length', () => {
      const longId = 'flow_' + 'a'.repeat(125);
      const result = FlowId.from(longId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_TOO_LONG');
        expect(result.violations[0].meta?.['max']).toBe(128);
      }
    });

    it('should accept string at max length', () => {
      const maxId = 'flow_' + 'a'.repeat(123);
      const result = FlowId.from(maxId);

      expect(result.ok).toBe(true);
    });

    it('should fail for invalid characters (space)', () => {
      const result = FlowId.from('flow_abc 123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_INVALID_CHARSET');
      }
    });

    it('should fail for invalid characters (special)', () => {
      const result = FlowId.from('flow_abc@123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_INVALID_CHARSET');
      }
    });

    it('should handle null input gracefully', () => {
      const result = FlowId.from(null as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_EMPTY');
      }
    });
  });

  describe('build', () => {
    it('should build a valid FlowId from nowMs and suffix', () => {
      const nowMs = 1700000000000;
      const suffix = 'a1b2c3d4';
      const result = FlowId.build(nowMs, suffix);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(`flow_${nowMs.toString(36)}_${suffix}`);
      }
    });

    it('should produce format compatible with from()', () => {
      const nowMs = Date.now();
      const suffix = 'hex12345';
      const buildResult = FlowId.build(nowMs, suffix);
      expect(buildResult.ok).toBe(true);

      if (buildResult.ok) {
        const fromResult = FlowId.from(buildResult.value.value);
        expect(fromResult.ok).toBe(true);
        if (fromResult.ok) {
          expect(fromResult.value.value).toBe(buildResult.value.value);
        }
      }
    });

    it('should fail when built string would be invalid (suffix with spaces)', () => {
      const result = FlowId.build(1700000000000, 'invalid suffix');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('FLOW_ID_INVALID_CHARSET');
      }
    });
  });

  describe('PREFIX and MAX_LENGTH', () => {
    it('should expose PREFIX constant', () => {
      expect(FlowId.PREFIX).toBe('flow_');
    });

    it('should expose MAX_LENGTH constant', () => {
      expect(FlowId.MAX_LENGTH).toBe(128);
    });
  });
});

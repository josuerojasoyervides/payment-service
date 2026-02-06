import { UrlString } from './url-string.vo';

describe('UrlString', () => {
  describe('from', () => {
    describe('valid URLs', () => {
      it('should create a valid UrlString from http URL', () => {
        const result = UrlString.from('http://example.com');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('http://example.com');
        }
      });

      it('should create a valid UrlString from https URL', () => {
        const result = UrlString.from('https://example.com/path');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('https://example.com/path');
        }
      });

      it('should trim whitespace from the input', () => {
        const result = UrlString.from('  https://example.com  ');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('https://example.com');
        }
      });

      it('should accept URL with query parameters', () => {
        const result = UrlString.from('https://example.com/return?orderId=123&status=success');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('https://example.com/return?orderId=123&status=success');
        }
      });

      it('should accept URL with fragment', () => {
        const result = UrlString.from('https://example.com/page#section');

        expect(result.ok).toBe(true);
      });

      it('should accept URL with port', () => {
        const result = UrlString.from('http://localhost:3000/callback');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('http://localhost:3000/callback');
        }
      });

      it('should accept custom schemes when provided in options', () => {
        const result = UrlString.from('myapp://return', {
          allowedSchemes: ['http:', 'https:', 'myapp:'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.value).toBe('myapp://return');
        }
      });
    });

    describe('invalid URLs', () => {
      it('should fail for empty string', () => {
        const result = UrlString.from('');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations).toHaveLength(1);
          expect(result.violations[0].code).toBe('URL_STRING_EMPTY');
        }
      });

      it('should fail for whitespace-only string', () => {
        const result = UrlString.from('   ');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_EMPTY');
        }
      });

      it('should fail for invalid URL format', () => {
        const result = UrlString.from('not a url');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_INVALID_FORMAT');
        }
      });

      it('should fail for relative URL', () => {
        const result = UrlString.from('/relative/path');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_INVALID_FORMAT');
        }
      });

      it('should fail for URL without protocol', () => {
        const result = UrlString.from('example.com');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_INVALID_FORMAT');
        }
      });

      it('should fail for disallowed scheme (ftp)', () => {
        const result = UrlString.from('ftp://example.com');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_INVALID_SCHEME');
          expect(result.violations[0].meta?.['scheme']).toBe('ftp:');
        }
      });

      it('should fail for custom scheme when not in allowed list', () => {
        const result = UrlString.from('myapp://return');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_INVALID_SCHEME');
          expect(result.violations[0].meta?.['scheme']).toBe('myapp:');
        }
      });

      it('should handle null input gracefully', () => {
        const result = UrlString.from(null as unknown as string);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_EMPTY');
        }
      });

      it('should handle undefined input gracefully', () => {
        const result = UrlString.from(undefined as unknown as string);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.violations[0].code).toBe('URL_STRING_EMPTY');
        }
      });
    });

    describe('edge cases', () => {
      it('should accept localhost URLs', () => {
        const result = UrlString.from('http://localhost/callback');

        expect(result.ok).toBe(true);
      });

      it('should accept IP address URLs', () => {
        const result = UrlString.from('http://192.168.1.1:8080/return');

        expect(result.ok).toBe(true);
      });

      it('should accept URLs with authentication', () => {
        const result = UrlString.from('https://user:pass@example.com/secure');

        expect(result.ok).toBe(true);
      });
    });
  });

  describe('DEFAULT_ALLOWED_SCHEMES', () => {
    it('should expose default allowed schemes', () => {
      expect(UrlString.DEFAULT_ALLOWED_SCHEMES).toEqual(['http:', 'https:']);
    });
  });
});

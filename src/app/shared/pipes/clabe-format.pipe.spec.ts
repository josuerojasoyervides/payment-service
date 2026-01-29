import { ClabeFormatPipe } from '@shared/pipes/clabe-format.pipe';

describe('ClabeFormatPipe', () => {
  let pipe: ClabeFormatPipe;

  beforeEach(() => {
    pipe = new ClabeFormatPipe();
  });

  it('should create the instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should format a valid 18-digit CLABE', () => {
      const clabe = '646180157000000001';
      const result = pipe.transform(clabe);
      expect(result).toBe('646 180 15700000000 1');
    });

    it('should format CLABE using XXX XXX XXXXXXXXXXX X', () => {
      const clabe = '646180111812345678';
      const result = pipe.transform(clabe);
      expect(result).toBe('646 180 11181234567 8');
    });

    it('should handle CLABE passed as a number', () => {
      const clabe = '646180157000000001';
      const result = pipe.transform(clabe);
      expect(result).toBe('646 180 15700000000 1');
    });

    it('should handle CLABE with existing spaces', () => {
      const clabe = '646 180 15700000000 1';
      const result = pipe.transform(clabe);
      expect(result).toBe('646 180 15700000000 1');
    });

    it('should return empty string when value is null', () => {
      expect(pipe.transform(null)).toBe('');
    });

    it('should return empty string when value is undefined', () => {
      expect(pipe.transform(undefined)).toBe('');
    });

    it('should return unformatted value when it does not have 18 digits', () => {
      const shortClabe = '123456789';
      const result = pipe.transform(shortClabe);
      expect(result).toBe(shortClabe);
    });

    it('should return unformatted value when it has more than 18 digits', () => {
      const longClabe = '64618015700000000123';
      const result = pipe.transform(longClabe);
      expect(result).toBe(longClabe);
    });

    it('should format multiple CLABEs correctly', () => {
      const testCases = [
        { input: '646180157000000001', expected: '646 180 15700000000 1' },
        { input: '646180111812345678', expected: '646 180 11181234567 8' },
        { input: '012345678901234567', expected: '012 345 67890123456 7' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(pipe.transform(input)).toBe(expected);
      });
    });
  });
});

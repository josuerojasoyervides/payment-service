import { ClabeFormatPipe } from './clabe-format.pipe';

describe('ClabeFormatPipe', () => {
    let pipe: ClabeFormatPipe;

    beforeEach(() => {
        pipe = new ClabeFormatPipe();
    });

    it('debe crear la instancia', () => {
        expect(pipe).toBeTruthy();
    });

    describe('transform', () => {
        it('debe formatear una CLABE válida de 18 dígitos', () => {
            const clabe = '646180157000000001';
            const result = pipe.transform(clabe);
            expect(result).toBe('646 180 15700000000 1');
        });

        it('debe formatear CLABE con formato correcto: XXX XXX XXXXXXXXXXX X', () => {
            const clabe = '646180111812345678';
            const result = pipe.transform(clabe);
            expect(result).toBe('646 180 11181234567 8');
        });

        it('debe manejar CLABE como número', () => {
            const clabe = '646180157000000001';
            const result = pipe.transform(clabe);
            expect(result).toBe('646 180 15700000000 1');
        });

        it('debe manejar CLABE con espacios existentes', () => {
            const clabe = '646 180 15700000000 1';
            const result = pipe.transform(clabe);
            expect(result).toBe('646 180 15700000000 1');
        });

        it('debe retornar string vacío si el valor es null', () => {
            expect(pipe.transform(null)).toBe('');
        });

        it('debe retornar string vacío si el valor es undefined', () => {
            expect(pipe.transform(undefined)).toBe('');
        });

        it('debe retornar el valor sin formatear si no tiene 18 dígitos', () => {
            const shortClabe = '123456789';
            const result = pipe.transform(shortClabe);
            expect(result).toBe(shortClabe);
        });

        it('debe retornar el valor sin formatear si tiene más de 18 dígitos', () => {
            const longClabe = '64618015700000000123';
            const result = pipe.transform(longClabe);
            expect(result).toBe(longClabe);
        });

        it('debe formatear diferentes CLABEs correctamente', () => {
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

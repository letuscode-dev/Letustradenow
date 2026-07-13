import { evaluateExpression } from '../evaluate-expression';

describe('evaluateExpression', () => {
    it('evaluates simple numeric and arithmetic expressions', () => {
        expect(evaluateExpression('5')).toBe(5);
        expect(evaluateExpression('2+3')).toBe(5);
        expect(evaluateExpression('(10-4)/2')).toBe(3);
        expect(evaluateExpression('1.5e2')).toBe(150);
    });

    it('rejects empty and non-numeric input', () => {
        expect(evaluateExpression('')).toBe('invalid_input');
        expect(evaluateExpression(null)).toBe('invalid_input');
        expect(evaluateExpression('myVar')).toBe('invalid_input');
        expect(evaluateExpression('Math.sqrt(4)')).toBe('invalid_input');
    });

    it('rejects executable / XSS-like payloads', () => {
        expect(evaluateExpression('alert(1)')).toBe('invalid_input');
        expect(evaluateExpression('fetch("https://evil.test")')).toBe('invalid_input');
        expect(evaluateExpression('1; process.exit(1)')).toBe('invalid_input');
        expect(evaluateExpression('constructor')).toBe('invalid_input');
    });
});

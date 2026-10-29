/**
 * TemplateExpression.js
 * The small expression language inside a template's {...} blocks, parsed by hand so the card runs
 * under a Content-Security-Policy without 'unsafe-eval' (no eval, no new Function).
 *
 * Supported: numbers, 'strings' and "strings", true/false/null; the helpers states(), state_attr()
 * and get_value(); Math.round/floor/ceil/abs/min/max; a trailing .toFixed(n); parentheses;
 * unary - + !; * / %; + -; < <= > >=; == != === !==; && || ??; and a ? b : c.
 * Anything else (other names, property access, assignments) is a syntax error.
 */
const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|\.\d+)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(===|!==|==|!=|<=|>=|&&|\|\||\?\?|[-+*/%<>!?:(),.]))/y;
const MATH = { __proto__: null, round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs, min: Math.min, max: Math.max };
const LITERALS = { __proto__: null, true: true, false: false, null: null };
const BINARY = [
    ['??', '||'], ['&&'], ['==', '!=', '===', '!=='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%'],
];
const APPLY = {
    '??': (a, b) => a ?? b(), '||': (a, b) => a || b(), '&&': (a, b) => a && b(),
    '==': (a, b) => a == b(), '!=': (a, b) => a != b(), '===': (a, b) => a === b(), '!==': (a, b) => a !== b(),
    '<': (a, b) => a < b(), '<=': (a, b) => a <= b(), '>': (a, b) => a > b(), '>=': (a, b) => a >= b(),
    '+': (a, b) => a + b(), '-': (a, b) => a - b(), '*': (a, b) => a * b(), '/': (a, b) => a / b(), '%': (a, b) => a % b(),
};

function tokenize(source) {
    const tokens = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < source.length) {
        const start = TOKEN.lastIndex;
        const m = TOKEN.exec(source);
        if (!m) {
            if (/^\s*$/.test(source.slice(start))) break;
            throw new SyntaxError(`unexpected "${source.slice(start).trim()[0]}"`);
        }
        if (m[1] !== undefined) tokens.push({ kind: 'value', value: Number(m[1]) });
        else if (m[2] !== undefined) tokens.push({ kind: 'value', value: m[2].slice(1, -1).replace(/\\(.)/g, '$1') });
        else if (m[3] !== undefined) tokens.push(m[3] in LITERALS ? { kind: 'value', value: LITERALS[m[3]] } : { kind: 'name', value: m[3] });
        else tokens.push({ kind: 'op', value: m[4] });
    }
    return tokens;
}

/** Compiles `source` to a function of the helpers ({states, state_attr, get_value}); throws a SyntaxError. */
export function compileExpression(source) {
    const tokens = tokenize(source);
    let at = 0;
    const peek = () => tokens[at];
    const isOp = (value) => peek()?.kind === 'op' && peek().value === value;
    const expect = (value) => {
        if (!isOp(value)) throw new SyntaxError(`expected "${value}"`);
        at++;
    };

    function args() {
        expect('(');
        const list = [];
        if (!isOp(')')) {
            do list.push(ternary()); while (isOp(',') && ++at);
        }
        expect(')');
        return list;
    }

    function primary() {
        const token = tokens[at++];
        if (!token) throw new SyntaxError('unexpected end');
        if (token.kind === 'value') return () => token.value;
        if (token.kind === 'op' && token.value === '(') {
            const inner = ternary();
            expect(')');
            return inner;
        }
        if (token.kind === 'name' && token.value === 'Math') {
            expect('.');
            const fn = MATH[tokens[at++]?.value];
            if (!fn) throw new SyntaxError('unknown Math function');
            const list = args();
            return (env) => fn(...list.map((arg) => arg(env)));
        }
        if (token.kind === 'name' && ['states', 'state_attr', 'get_value'].includes(token.value)) {
            const list = args();
            return (env) => env[token.value](...list.map((arg) => arg(env)));
        }
        throw new SyntaxError(`unknown "${token.value}"`);
    }

    function postfix() {
        let node = primary();
        while (isOp('.')) {
            at++;
            if (tokens[at++]?.value !== 'toFixed') throw new SyntaxError('only .toFixed() may follow a value');
            const [digits] = args(), target = node;
            node = (env) => Number(target(env)).toFixed(digits ? digits(env) : 0);
        }
        return node;
    }

    function unary() {
        if (isOp('-') || isOp('+') || isOp('!')) {
            const op = tokens[at++].value, operand = unary();
            if (op === '-') return (env) => -operand(env);
            if (op === '+') return (env) => +operand(env);
            return (env) => !operand(env);
        }
        return postfix();
    }

    function binary(level) {
        if (level === BINARY.length) return unary();
        let left = binary(level + 1);
        while (peek()?.kind === 'op' && BINARY[level].includes(peek().value)) {
            const apply = APPLY[tokens[at++].value], a = left, b = binary(level + 1);
            left = (env) => apply(a(env), () => b(env));
        }
        return left;
    }

    function ternary() {
        const test = binary(0);
        if (!isOp('?')) return test;
        at++;
        const yes = ternary();
        expect(':');
        const no = ternary();
        return (env) => (test(env) ? yes(env) : no(env));
    }

    const root = ternary();
    if (at < tokens.length) throw new SyntaxError(`unexpected "${tokens[at].value}"`);
    return root;
}

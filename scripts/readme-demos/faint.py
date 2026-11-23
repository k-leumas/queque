"""Rewrite SGR 2 (dim/faint) as an explicit colour, since svg-term ignores it.

Terminals draw faint text by blending the foreground toward the background;
FAINT is the 50% blend of svg-term's default fg (#b9c0cb) and bg (#282d35).
Only dim on the default foreground needs rewriting (QueQue never dims a
coloured span); dim on an explicit colour is left as that colour.

Usage: python3 -I faint.py <in.cast> <out.cast>   (asciicast v2, one event per line)
"""
import json
import re
import sys

FAINT = '38;2;112;118;128'
SGR = re.compile(r'\x1b\[([0-9;]*)m')


class State:
    def __init__(self):
        self.dim = False
        self.fg = False  # True when an explicit foreground colour is set

    def faint_active(self):
        return self.dim and not self.fg


def rewrite_sgr(params, st):
    before = st.faint_active()
    parts = params.split(';') if params else ['0']
    out, i = [], 0
    while i < len(parts):
        p = parts[i]
        if p in ('38', '48') and i + 1 < len(parts):
            n = 3 if parts[i + 1] == '5' else 5
            chunk = parts[i:i + n]
            if p == '38':
                st.fg = True
            out.extend(chunk)
            i += n
            continue
        if p in ('', '0'):
            st.dim = st.fg = False
        elif p == '2':
            st.dim = True
            i += 1
            continue  # drop: svg-term can't draw it
        elif p == '22':
            st.dim = False
        elif p == '39':
            st.fg = False
        elif p.isdigit() and (30 <= int(p) <= 37 or 90 <= int(p) <= 97):
            st.fg = True
        out.append(p)
        i += 1
    after = st.faint_active()
    if after:
        out.append(FAINT)
    elif before and not st.fg:
        out.append('39')
    return f'\x1b[{";".join(out)}m' if out else ''


def convert(text, st):
    return SGR.sub(lambda m: rewrite_sgr(m.group(1), st), text)


if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    st = State()
    with open(src) as f, open(dst, 'w') as g:
        g.write(f.readline())
        for line in f:
            t, kind, data = json.loads(line)
            g.write(json.dumps([t, kind, convert(data, st) if kind == 'o' else data]) + '\n')

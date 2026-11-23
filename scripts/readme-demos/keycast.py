# Rebuild the README demo SVGs from asciinema-style .cast recordings:
#   python3 -I scripts/readme-demos/faint.py demo.cast demo-faint.cast
#   npx svg-term-cli --in demo-faint.cast --out demo.svg --window --no-cursor --padding 18 --height 21
#   python3 -I scripts/readme-demos/keycast.py demo.svg assets/demo-run.svg run
# faint.py turns the terminal's dim style (which svg-term ignores) into a faint colour.
# Key timings in SPECS come from the recording: a key the terminal never echoes
# (the second ?, arrows, Enter, Esc) shows up as the frame change it causes.
"""Add keycap overlays (the keys a recording can't show) to an svg-term SVG.

Usage: python3 -I keycast.py <in.svg> <out.svg> <overlay-spec name>
Each overlay: (start_s, end_s, [keys], highlight_index_or_None, caption).
"""
import re
import sys

FADE = 0.12  # seconds

SPECS = {
    'run': [
        (5.85, 5.95, ['?'], None, ''),
        (5.95, 7.9, ['?', '?'], 1, 'the second ? opens QueQue'),
        (10.04, 11.75, ['enter'], 0, 'pick one: it lands in your buffer'),
        (11.83, 13.6, ['enter'], 0, 'your call: you run it'),
    ],
    'guardrails': [
        (6.13, 6.19, ['?'], None, ''),
        (6.19, 8.1, ['?', '?'], 1, 'the second ? opens QueQue'),
        (10.21, 11.4, ['↓'], 0, 'move'),
        (11.51, 13.2, ['↓'], 0, 'move'),
        (13.33, 16.0, ['esc'], 0, 'cancel: what you typed comes back'),
    ],
}


def esc(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build(svg, spec):
    duration = float(re.search(r'animation-duration:([\d.]+)s', svg).group(1))
    width = float(re.search(r'<svg[^>]*?width="([\d.]+)"', svg).group(1))
    height = float(re.search(r'<svg[^>]*?height="([\d.]+)"', svg).group(1))
    pct = lambda t: max(0.0, min(100.0, t / duration * 100))

    styles, groups = [], []
    cap_h, gap, right = 34, 8, width - 24
    base_y = height - 24 - cap_h
    for i, (start, end, keys, hi, caption) in enumerate(spec):
        a0, a1 = pct(start - FADE), pct(start)
        b0, b1 = pct(end), pct(end + FADE)
        styles.append(
            f'@keyframes k{i}{{0%{{opacity:0}}{a0:.3f}%{{opacity:0}}{a1:.3f}%{{opacity:1}}'
            f'{b0:.3f}%{{opacity:1}}{b1:.3f}%{{opacity:0}}100%{{opacity:0}}}}'
            f'.k{i}{{opacity:0;animation:k{i} {duration}s linear infinite}}'
        )
        # Lay keys out right to left.
        x = right
        parts = []
        for j in reversed(range(len(keys))):
            label = keys[j]
            w = max(34, 14 + 10 * len(label))
            x -= w
            lit = hi == j
            parts.append(
                f'<rect x="{x}" y="{base_y}" width="{w}" height="{cap_h}" rx="7" '
                f'class="{"kc-lit" if lit else "kc"}"/>'
                f'<text x="{x + w / 2}" y="{base_y + 23}" text-anchor="middle" '
                f'class="{"kt-lit" if lit else "kt"}">{esc(label)}</text>'
            )
            x -= gap
        if caption:
            parts.append(
                f'<text x="{x - 6}" y="{base_y + 22}" text-anchor="end" class="kcap">{esc(caption)}</text>'
            )
        groups.append(f'<g class="k{i}">{"".join(parts)}</g>')

    common = (
        '.kc{fill:#1d2026;stroke:#5c6370;stroke-width:1.5}'
        '.kc-lit{fill:#3a2414;stroke:#ff8a3d;stroke-width:2}'
        '.kt,.kt-lit,.kcap{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}'
        '.kt{fill:#d7dae0;font-size:17px;font-weight:700}'
        '.kt-lit{fill:#ffb27a;font-size:17px;font-weight:700}'
        '.kcap{fill:#ffb27a;font-size:15px}'
    )
    overlay = f'<g><style>{common}{"".join(styles)}</style>{"".join(groups)}</g>'
    idx = svg.rstrip().rfind('</svg>')
    return svg[:idx] + overlay + svg[idx:]


if __name__ == '__main__':
    src, dst, name = sys.argv[1:4]
    with open(src) as f:
        svg = f.read()
    with open(dst, 'w') as f:
        f.write(build(svg, SPECS[name]))

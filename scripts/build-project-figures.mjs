#!/usr/bin/env node
/**
 * Original project miniatures, inspired by Anatomy's physical-object approach.
 * No Anatomy code or assets are copied. Run with --write to rebuild the SVGs.
 * Geometry lives here; palette, layout and restrained motion belong to SIGIL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const n = value => Number(value.toFixed(2));
const project = ([x, y, z = 0]) => [n(160 + (x - y) * .866), n(158 + (x + y) * .5 - z)];
const path = points => points.map((point, index) => `${index ? 'L' : 'M'}${project(point).join(' ')}`).join(' ') + 'Z';
const face = (points, tone = 'top', extra = '') => `<path class="sg-figure__${tone}" d="${path(points)}" ${extra}/>`;
const line = (points, tone = 'rule', extra = '') => `<path class="sg-figure__${tone}" d="${points.map((point, index) => `${index ? 'L' : 'M'}${project(point).join(' ')}`).join(' ')}" ${extra}/>`;
const group = (name, contents) => `<g class="sg-figure__${name}">${contents}</g>`;

function slab(x, y, w, d, z, h, tone = '') {
    const a = [x, y, z], b = [x + w, y, z], c = [x + w, y + d, z], e = [x, y + d, z];
    const lift = point => [point[0], point[1], point[2] + h];
    return group('solid',
        face([e, c, lift(c), lift(e)], tone || 'side') +
        face([b, c, lift(c), lift(b)], tone || 'end') +
        face([lift(a), lift(b), lift(c), lift(e)], tone || 'top'));
}

function ringPoints(x, y, r, z, count = 48) {
    return Array.from({ length: count }, (_, index) => {
        const angle = index / count * Math.PI * 2;
        return [x + Math.cos(angle) * r, y + Math.sin(angle) * r, z];
    });
}

function cylinder(x, y, r, z, h, tone = 'top') {
    const bottom = ringPoints(x, y, r, z), top = ringPoints(x, y, r, z + h);
    // The near semicircle runs from +x through +y; its far half stays hidden.
    return face([...bottom.slice(0, 25), ...top.slice(0, 25).reverse()], 'side') + face(top, tone);
}

function dot(point, radius = .8, tone = 'rule') {
    const [cx, cy] = project(point);
    return `<circle class="sg-figure__${tone}" cx="${cx}" cy="${cy}" r="${radius}"/>`;
}

function rod(from, to, width = 3, tone = 'metal') {
    const a = project(from), b = project(to);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = -(b[1] - a[1]) / length * width / 2, dy = (b[0] - a[0]) / length * width / 2;
    return `<path class="sg-figure__${tone}" d="M${n(a[0] + dx)} ${n(a[1] + dy)}L${n(b[0] + dx)} ${n(b[1] + dy)}L${n(b[0] - dx)} ${n(b[1] - dy)}L${n(a[0] - dx)} ${n(a[1] - dy)}Z"/>`;
}

function halo(rx = 101, ry = 37) {
    return `<ellipse class="sg-figure__shadow" cx="160" cy="178" rx="${rx}" ry="${ry}"/>`;
}

function press() {
    let svg = halo();
    for (const [x, y] of [[-68, -46], [62, -46], [-68, 40], [62, 40]]) svg += cylinder(x, y, 6, 0, 7, 'metal');
    svg += slab(-78, -56, 156, 112, 7, 8);
    svg += slab(-62, -41, 12, 17, 15, 87, 'metal');
    svg += slab(50, -41, 12, 17, 15, 87, 'metal');
    svg += slab(-62, -41, 124, 17, 102, 9, 'metal');
    svg += slab(-54, -38, 108, 77, 15, 9);
    svg += slab(-42, -30, 84, 58, 24, 2, 'paper');
    // Three inked marks echo the site's seal, printed onto the sheet itself.
    for (const [x, y] of [[0, -10], [-12, 10], [12, 10]]) svg += face(ringPoints(x, y, 4, 26.1, 24), 'ink');
    svg += line([[-34, 22, 26.2], [34, 22, 26.2]], 'rule');
    let head = cylinder(0, -32, 6, 69, 33, 'metal');
    head += slab(-45, -35, 90, 61, 59, 9, 'metal');
    head += slab(-40, -30, 80, 51, 56, 3);
    svg += group('press-head', head);
    svg += cylinder(0, -32, 4, 111, 10, 'metal');
    const wheel = ringPoints(0, -32, 23, 121, 48);
    svg += `<path class="sg-figure__wheel" d="${path(wheel)}"/>`;
    for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3;
        svg += line([[0, -32, 121], [Math.cos(angle) * 22, -32 + Math.sin(angle) * 22, 121]], 'metal-line');
    }
    svg += cylinder(0, -32, 4, 121, 3, 'ink');
    svg += cylinder(18, -20, 2.5, 121, 6, 'accent');
    svg += slab(-42, 40, 84, 9, 15, 4);
    svg += line([[-29, 49, 17], [29, 49, 17]], 'rule');
    for (const point of [[-57, -34, 111], [57, -34, 111], [-67, 44, 15], [67, 44, 15]]) svg += dot(point);
    return svg;
}

function desk() {
    let svg = halo(106, 38);
    for (const [x, y] of [[-68, -44], [59, -44]]) svg += slab(x, y, 9, 9, 0, 48, 'metal');
    svg += slab(-69, 32, 137, 12, 27, 16);
    svg += line([[-1, 44, 27], [-1, 44, 43]], 'rule');
    for (const x of [-38, 26]) svg += slab(x, 44, 13, 3, 33, 2, 'metal');
    for (const [x, y] of [[-68, 35], [59, 35]]) svg += slab(x, y, 9, 9, 0, 48, 'metal');
    svg += slab(-82, -57, 164, 114, 48, 7);
    svg += line([[-77, 57, 52], [77, 57, 52]], 'rule');
    svg += slab(-55, -38, 88, 65, 55, 3, 'ink');
    svg += slab(-52, -36, 83, 61, 58, 3, 'paper');
    svg += face([[-52, -36, 61], [-10, -34, 65], [-10, 25, 65], [-52, 25, 61]], 'paper');
    svg += face([[-10, -34, 65], [31, -36, 61], [31, 25, 61], [-10, 25, 65]], 'paper');
    svg += line([[-10, -34, 65], [-10, 25, 65]], 'rule');
    for (let i = 0; i < 8; i++) {
        const y = -23 + i * 5;
        svg += line([[-45, y, 61.8], [-17 - (i === 7 ? 9 : 0), y, 64.3]], 'print');
        svg += line([[-3, y, 64.3], [23 - (i === 5 ? 8 : 0), y, 61.8]], 'print');
    }
    svg += face([[-12, -34, 65.2], [-8, -34, 65.2], [-8, 33, 62], [-10, 30, 62], [-12, 33, 62]], 'accent');
    svg += slab(39, 3, 29, 32, 55, 3, 'paper');
    svg += slab(37, 1, 29, 32, 58, 1, 'paper');
    for (let i = 0; i < 3; i++) svg += line([[42, 9 + i * 5, 59.2], [60, 9 + i * 5, 59.2]], 'print');
    svg += rod([53, -9, 56], [44, 22, 60], 2.1, 'ink');
    svg += cylinder(54, -33, 8, 55, 12, 'metal');
    svg += face(ringPoints(54, -33, 4.5, 67.2, 32), 'ink');
    svg += rod([54, -33, 67], [57, -36, 86], 1.8);
    return svg;
}

function lamp() {
    let svg = halo(84, 30);
    svg += slab(-67, -46, 134, 92, 2, 5);
    svg += slab(-57, -37, 81, 60, 7, 2, 'paper');
    svg += slab(-54, -34, 81, 60, 9, .8, 'paper');
    for (let i = 0; i < 5; i++) svg += line([[-45, -23 + i * 8, 10], [13 - (i === 4 ? 13 : 0), -23 + i * 8, 10]], 'print');
    // A projected pool on the paper, not a live representation of plugin state.
    svg += group('light', face(ringPoints(-34, -6, 20, 10.1), 'glow'));
    const cableStart = project([39, 26, 9]), cableEnd = project([67, -12, 8]);
    svg += `<path class="sg-figure__cable" d="M${cableStart.join(' ')} C${n(cableStart[0] + 31)} ${n(cableStart[1] + 10)} ${n(cableEnd[0] + 27)} ${n(cableEnd[1] + 17)} ${cableEnd.join(' ')}"/>`;
    svg += slab(63, -15, 6, 6, 7, 3, 'metal');
    svg += cylinder(38, 25, 22, 8, 7, 'metal');
    svg += cylinder(38, 25, 15, 15, 2);
    svg += cylinder(38, 25, 5, 17, 5, 'metal');
    svg += cylinder(38, 25, 3, 22, 41, 'metal');
    svg += dot([38, 25, 63], 5, 'metal');
    svg += rod([38, 25, 63], [-40, -6, 106], 5);
    svg += rod([34, 27, 61], [-44, -4, 104], 2.4);
    svg += dot([-40, -6, 106], 4.5, 'metal');
    svg += dot([38, 25, 63], 1.5, 'ink');
    svg += dot([-40, -6, 106], 1.4, 'ink');
    svg += cylinder(-40, -6, 4, 99, 7, 'metal');
    const bottom = ringPoints(-40, -6, 24, 80), top = ringPoints(-40, -6, 9, 99);
    svg += face([...bottom.slice(0, 25), ...top.slice(0, 25).reverse()], 'end');
    svg += face([...bottom.slice(24), bottom[0], top[0], ...top.slice(24).reverse()], 'side');
    svg += face(top);
    svg += line(bottom.slice(0, 25), 'metal-line');
    svg += dot([29, 37, 17.2], 2.3, 'accent');
    return svg;
}

const figures = Object.fromEntries([
    ['sigil', 'A miniature letterpress', press()],
    ['scriptorium', 'A writing desk with an open book', desk()],
    ['desklamp', 'An articulated lamp over a page', lamp()],
].map(([key, title, contents]) => [key, `<svg xmlns="http://www.w3.org/2000/svg" class="sg-project-figure" viewBox="15 -14 290 239" width="290" height="239" aria-hidden="true" focusable="false"><title>${title}</title>${contents}</svg>\n`]));

if (process.argv.includes('--write')) {
    const directory = fileURLToPath(new URL('../assets/projects/', import.meta.url));
    mkdirSync(directory, { recursive: true });
    for (const [key, svg] of Object.entries(figures)) writeFileSync(`${directory}/${key}.svg`, svg);
    console.log(`Built ${Object.keys(figures).length} original project figures.`);
} else {
    console.log(JSON.stringify(figures));
}

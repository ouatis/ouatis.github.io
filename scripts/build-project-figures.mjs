#!/usr/bin/env node
/**
 * Project miniatures in the Anatomy style: solid isometric parts, four-tone
 * shading (lo / mid / hi, one lit accent), painter's order, and lines that
 * resolve. Method follows wheresryan22/anatomy (MIT); geometry, palette and
 * classes are this site's own. Run with --write to rebuild the SVGs.
 * Geometry lives here; palette, layout and restrained motion belong to SIGIL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const n = value => Number(value.toFixed(2));
const project = ([x, y, z = 0]) => [n(160 + (x - y) * .866), n(158 + (x + y) * .5 - z)];
const path = points => points.map((point, index) => `${index ? 'L' : 'M'}${project(point).join(' ')}`).join(' ') + 'Z';
const face = (points, tone = 'top', extra = '') => `<path class="sg-figure__${tone}" d="${path(points)}" ${extra}/>`;
const line = (points, tone = 'rule', extra = '') => `<path class="sg-figure__${tone}" d="${points.map((point, index) => `${index ? 'L' : 'M'}${project(point).join(' ')}`).join(' ')}" ${extra}/>`;
const outline = (points, tone = 'faint') => `<path class="sg-figure__${tone}" d="${path(points)}" fill="none"/>`;
const group = (name, contents) => `<g class="sg-figure__${name}">${contents}</g>`;
const depthOf = point => point[0] + point[1];

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

function dot(point, radius = .8, tone = 'mid') {
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

// --- Anatomy part recipes -------------------------------------------------

// Base plate on four feet; returns its top height so callers stack on it.
function bench({ x = -72, y = -52, w = 144, d = 96, foot = 6, plate = 9 } = {}) {
    const top = foot + plate;
    const footCorners = [[x + 7, y + 7], [x + w - 7, y + 7], [x + w - 7, y + d - 7], [x + 7, y + d - 7]];
    let svg = halo();
    for (const [fx, fy] of [...footCorners].sort((a, b) => depthOf(a) - depthOf(b))) {
        svg += cylinder(fx, fy, 6.4, 0, 1.6, 'lo');           // flange
        svg += cylinder(fx, fy, 4.6, 1.6, foot - 1.6, 'mid'); // foot
    }
    svg += slab(x, y, w, d, foot, plate);
    svg += outline([[x + 4.5, y + 4.5, top], [x + w - 4.5, y + 4.5, top], [x + w - 4.5, y + d - 4.5, top], [x + 4.5, y + d - 4.5, top]], 'faint');
    for (const [sx, sy] of [[x + 11, y + 11], [x + w - 11, y + 11], [x + w - 11, y + d - 11], [x + 11, y + d - 11]]) {
        svg += line(ringPoints(sx, sy, 2, top, 16), 'rule') + dot([sx, sy, top], .55, 'mid');
    }
    return { svg, top, x, y, w, d };
}

// Ruler strip along the bench front edge with minor (lo) and major (mid) ticks.
function rulerStrip(bench, { inset = 9, width = 7 } = {}) {
    const { x, y, w, d, top } = bench;
    const strip = { x: x + inset, y: y + d - inset - width, w: w - inset * 2, d: width };
    let svg = slab(strip.x, strip.y, strip.w, strip.d, top, .9, 'lo');
    const edge = strip.y + strip.d - .8, z = top + .9;
    let index = 0;
    for (let tx = strip.x + 4; tx <= strip.x + strip.w - 4; tx += 4.5, index++) {
        const len = index % 5 === 0 ? 3.4 : 2;
        svg += line([[tx, edge, z], [tx, edge - len, z]], index % 5 === 0 ? 'mid' : 'lo');
    }
    return svg;
}

// Label plate lying on a surface: three printed rules and two screws.
function labelPlate(plan, z, { w = 30, d = 12 } = {}) {
    const plate = { x: plan.x, y: plan.y, w, d };
    let svg = slab(plate.x, plate.y, plate.w, plate.d, z, .8, 'hi');
    svg += outline([[plate.x + 1.6, plate.y + 1.6, z + .8], [plate.x + plate.w - 1.6, plate.y + 1.6, z + .8],
        [plate.x + plate.w - 1.6, plate.y + plate.d - 1.6, z + .8], [plate.x + 1.6, plate.y + plate.d - 1.6, z + .8]], 'faint');
    const zz = z + .8;
    svg += line([[plate.x + 3.5, plate.y + 3.2, zz], [plate.x + plate.w - 3.5, plate.y + 3.2, zz]], 'lo');
    svg += line([[plate.x + 3.5, plate.y + 6, zz], [plate.x + plate.w - 8, plate.y + 6, zz]], 'lo');
    svg += line([[plate.x + 3.5, plate.y + 8.8, zz], [plate.x + plate.w - 5.5, plate.y + 8.8, zz]], 'lo');
    svg += dot([plate.x + 1.9, plate.y + 1.9, zz], .5, 'mid') + dot([plate.x + plate.w - 1.9, plate.y + plate.d - 1.9, zz], .5, 'mid');
    return svg;
}

function knurl(x, y, r, z0, z1, count = 18) {
    let svg = '';
    for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        svg += line([[x + Math.cos(angle) * r, y + Math.sin(angle) * r, z0],
            [x + Math.cos(angle) * r, y + Math.sin(angle) * r, z1]], 'lo');
    }
    return svg;
}

// Printed type across a paper region: the one place a line may end free.
function printLines(x, y, w, z, rows, rowStep = 6.5) {
    let svg = '';
    for (let i = 0; i < rows; i++) {
        const yy = y + i * rowStep;
        const shorten = i === rows - 1 ? w * .38 : 0;
        svg += line([[x, yy, z], [x + w - shorten, yy, z]], 'print', 'free="true"');
    }
    return svg;
}

function cable(from2d, to2d, tone = 'cable') {
    return `<path class="sg-figure__${tone}" d="M${from2d.join(' ')} C${n(from2d[0] + 10)} ${n(from2d[1] + 12)} ${n(to2d[0] - 10)} ${n(to2d[1] + 12)} ${to2d.join(' ')}"/>`;
}

// --- Figures ---------------------------------------------------------------

// SIGIL: a miniature letterpress pressing the site's three-dot seal.
function press() {
    const b = bench();
    let svg = b.svg + rulerStrip(b);
    // Press frame: two columns and a crossbar (structure, mid).
    for (const [cx, cy] of [[-50, -34], [38, -34]]) svg += slab(cx - 4, cy - 4, 8, 8, b.top, 72, 'mid');
    svg += slab(-56, -38, 96, 16, b.top + 72, 9, 'mid');
    // Screw rod up to the balance wheel.
    svg += rod([-8, -26, b.top + 81], [-8, -26, b.top + 96], 2.4);
    svg += dot([-8, -26, b.top + 96], 2, 'metal');
    svg += face(ringPoints(-8, -26, 19, b.top + 99, 48), 'wheel');
    // Platen hanging on its rod above the bed.
    svg += rod([-8, -24, b.top + 39], [-8, -24, b.top + 72], 2.4);
    svg += slab(-22, -34, 28, 26, b.top + 34, 5, 'mid');
    // The bed and the proof sheet with the three-dot seal (the subject).
    svg += slab(-30, -44, 72, 52, b.top, 5, 'lo');
    svg += slab(-22, -38, 52, 42, b.top + 5, 1.2, 'paper');
    for (const [sx, sy] of [[-4, -28], [4, -28], [0, -22]]) svg += face(ringPoints(sx, sy, 3.4, b.top + 6.3, 24), 'ink');
    svg += printLines(-16, -20, 40, b.top + 6.2, 4);
    // The ink pot: the one lit accent.
    svg += cylinder(52, 16, 3.2, b.top, 6, 'lit');
    svg += face(ringPoints(52, 16, 1.8, b.top + 6.1, 20), 'lo');
    // Label plate on the bed's front edge.
    svg += labelPlate({ x: -16, y: 10 }, b.top + 5, { w: 30, d: 8 });
    return svg;
}

// Scriptorium: a draftsman's writing desk with an open book and inkwell.
function desk() {
    const surface = 48;
    let svg = halo(106, 38);
    for (const [lx, ly] of [[-70, -46], [58, -46], [58, 40], [-70, 40]]) {
        svg += slab(lx, ly, 7, 7, 0, surface - 4, 'lo');
        svg += dot([lx + 3.5, ly + 3.5, 0], 1.6, 'mid');
    }
    svg += slab(-80, -56, 160, 110, surface - 4, 4, 'mid');
    svg += outline([[-75, -51, surface], [75, -51, surface], [75, 49, surface], [-75, 49, surface]], 'faint');
    for (const [sx, sy] of [[-74, -50], [74, -50], [74, 48], [-74, 48]]) {
        svg += line(ringPoints(sx, sy, 2, surface, 16), 'rule') + dot([sx, sy, surface], .55, 'mid');
    }
    // Ruler strip along the front edge of the desk top.
    svg += slab(-64, 36, 128, 7, surface, .9, 'lo');
    let index = 0;
    for (let tx = -60; tx <= 60; tx += 4.5, index++) {
        const len = index % 5 === 0 ? 3.4 : 2;
        svg += line([[tx, 41.4, surface + .9], [tx, 41.4 - len, surface + .9]], index % 5 === 0 ? 'mid' : 'lo');
    }
    // Open book (the subject): cover, two pages, spine groove, type.
    svg += slab(-44, -34, 88, 56, surface, 2.2, 'mid');
    svg += slab(-41, -31, 40, 50, surface + 2.2, 1, 'paper');
    svg += slab(1, -31, 40, 50, surface + 2.2, 1, 'paper');
    svg += line([[-1, -31, surface + 3.2], [-1, 19, surface + 3.2]], 'faint');
    svg += printLines(-37, -26, 33, surface + 3.3, 5);
    svg += printLines(5, -26, 33, surface + 3.3, 5);
    // The line being written: last row of each page, ink left and lit right.
    const rowY = -20 + 5 * 6.5;
    svg += face([[-35, rowY - 1.3, surface + 3.4], [-15, rowY - 1.3, surface + 3.4],
        [-15, rowY + 1.3, surface + 3.4], [-35, rowY + 1.3, surface + 3.4]], 'ink');
    svg += face([[7, rowY - 1.3, surface + 3.4], [31, rowY - 1.3, surface + 3.4],
        [31, rowY + 1.3, surface + 3.4], [7, rowY + 1.3, surface + 3.4]], 'lit');
    // Inkwell with bore, and the pen resting beside the book.
    svg += cylinder(58, -38, 6, surface, 9, 'metal');
    svg += face(ringPoints(58, -38, 4, surface + 9.1, 24), 'ink');
    svg += rod([30, 26, surface + 1.2], [58, 22, surface + 1.2], 1.8, 'metal');
    svg += dot([58, 22, surface + 1.2], 1.1, 'metal');
    // Label plate on the front apron face.
    svg += slab(-18, 49.5, 24, 3.5, surface - 6, 5, 'hi');
    svg += line([[-14, 53, surface - 4.4], [2, 53, surface - 4.4]], 'lo');
    svg += line([[-14, 53, surface - 2.9], [0, 53, surface - 2.9]], 'lo');
    svg += line([[-14, 53, surface - 1.4], [4, 53, surface - 1.4]], 'lo');
    return svg;
}

// Desk Lamp: an articulated lamp over a page with its pool of light.
function lamp() {
    const b = bench({ w: 136, d: 92, plate: 7 });
    let svg = b.svg;
    const top = b.top;
    svg += slab(-56, -34, 84, 56, top, 1.2, 'paper');
    svg += printLines(-48, -26, 66, top + 1.2, 5);
    // Pool of light on the page (a concept pool, not plugin state).
    svg += group('light', face(ringPoints(-26, -6, 19, top + 1.3, 40), 'glow'));
    svg += dot([-30, -12, top + 1.4], 1.4, 'ink');
    // Column and articulated arm (structure, mid).
    svg += cylinder(46, 28, 15, top, 6, 'metal');
    svg += cylinder(46, 28, 10, top + 6, 2, 'hi');
    svg += cylinder(46, 28, 4.5, top + 8, 34, 'metal');
    svg += dot([46, 28, top + 42], 4.6, 'metal');
    svg += knurl(46, 28, 5.4, top + 8, top + 14, 14);
    svg += rod([46, 28, top + 42], [-32, -14, top + 74], 4.4);
    svg += dot([-32, -14, top + 74], 4, 'metal');
    // Second arm down to the shade.
    svg += rod([-32, -14, top + 74], [-34, -10, top + 58], 3.6);
    svg += cylinder(-34, -10, 3, top + 52, 6, 'metal');
    // Shade: tapering shell with a lit inner face and bulb.
    const bottom = ringPoints(-34, -10, 20, top + 40), upper = ringPoints(-34, -10, 8, top + 54);
    svg += face([...bottom.slice(0, 25), ...upper.slice(0, 25).reverse()], 'side');
    svg += face([...bottom.slice(24), bottom[0], upper[0], ...upper.slice(24).reverse()], 'end');
    svg += face(upper, 'metal');
    svg += line(bottom.slice(0, 25), 'metal-line');
    svg += face(ringPoints(-34, -10, 6.4, top + 43, 32), 'lit');
    // Cable out of the base rear with its connector on the ground.
    const c0 = project([64, 20, top - 4]), c1 = project([78, 22, 4]);
    svg += `<path class="sg-figure__cable" d="M${c0.join(' ')} C${n(c0[0] + 20)} ${n(c0[1] + 10)} ${n(c1[0] - 16)} ${n(c1[1] - 12)} ${c1.join(' ')}"/>`;
    svg += slab(74, 18, 7, 7, 0, 4, 'metal') + dot([77.5, 21.5, 4], 1.2, 'ink');
    return svg;
}

// Skill Switchboard: a patch console wiring one source card to three ports.
function switchboard() {
    const b = bench();
    let svg = b.svg + rulerStrip(b);
    // Console board (structure) with an inset groove.
    svg += slab(-58, -44, 116, 62, b.top, 10, 'mid');
    svg += outline([[-54, -40, b.top + 10], [54, -40, b.top + 10], [54, 14, b.top + 10], [-54, 14, b.top + 10]], 'faint');
    const cz = b.top + 10;
    // Source card on the left of the console.
    svg += slab(-46, -34, 34, 30, cz, 1.4, 'paper');
    svg += printLines(-42, -30, 26, cz + 1.4, 3);
    svg += cylinder(-14, -20, 2.4, cz, 4, 'metal');
    svg += dot([-14, -20, cz + 4.1], .9, 'ink');
    // Three ports along the right (depth-sorted).
    const ports = [[22, -30], [38, -14], [22, 2]];
    for (const [px, py] of [...ports].sort((a, b2) => depthOf(a) - depthOf(b2))) {
        svg += cylinder(px, py, 4.2, cz, 3, 'metal');
        svg += face(ringPoints(px, py, 2.2, cz + 3.1, 20), 'lo');
        svg += dot([px, py, cz + 3.2], .8, 'ink');
    }
    // Patch cables from the source pin; the live port is lit.
    const from = project([-14, -20, cz + 4]);
    for (const [px, py, lit] of [[22, -30, false], [38, -14, true], [22, 2, false]]) {
        svg += cable(from, project([px, py, cz + 3.4]), lit ? 'cable-lit' : 'cable');
    }
    // Label plate between card and ports.
    svg += labelPlate({ x: -10, y: 2 }, cz, { w: 24, d: 10 });
    return svg;
}

// Collate: a comparison gantry holding two drafts over one bridge.
function collate() {
    const b = bench();
    let svg = b.svg + rulerStrip(b);
    // Two drafts side by side (the subjects).
    svg += slab(-54, -40, 50, 62, b.top, 1.4, 'paper');
    svg += slab(4, -40, 50, 62, b.top, 1.4, 'paper');
    const z = b.top + 1.4;
    // Three type rows above the watched row, four below; the bar replaces one.
    for (const yy of [-28, -21.5, -8.5, -2, 4.5, 11]) {
        const w = yy === 11 ? 40 * .62 : 40;
        svg += line([[-49, yy, z], [-49 + w, yy, z]], 'print', 'free="true"');
        svg += line([[9, yy, z], [9 + w, yy, z]], 'print', 'free="true"');
    }
    const rowY = -15;
    svg += face([[-49, rowY - 1.4, z + .1], [-31, rowY - 1.4, z + .1],
        [-31, rowY + 1.4, z + .1], [-49, rowY + 1.4, z + .1]], 'ink');
    svg += face([[9, rowY - 1.4, z + .1], [27, rowY - 1.4, z + .1],
        [27, rowY + 1.4, z + .1], [9, rowY + 1.4, z + .1]], 'lit');
    // Comparison gantry: two feet landing on the watched words, one plumb line.
    const postTop = z + .1 + 11;
    svg += slab(-42.4, rowY - 2.4, 4.8, 4.8, z + .1, 11, 'mid');
    svg += slab(17.6, rowY - 2.4, 4.8, 4.8, z + .1, 11, 'mid');
    svg += slab(-44, rowY - 3, 64, 6, postTop, 3.2, 'mid');
    svg += dot([-42.4 + 2.4, rowY, postTop + 3.2], .8, 'mid') + dot([17.6 + 2.4, rowY, postTop + 3.2], .8, 'mid');
    svg += rod([-10, rowY, postTop + 3.2], [-10, rowY, z], 1.2, 'metal');
    svg += dot([-10, rowY, z], 1.1, 'metal');
    return svg;
}

const figures = Object.fromEntries([
    ['sigil', 'A miniature letterpress pressing a three-dot seal', press()],
    ['scriptorium', 'A draftsman desk with an open book and inkwell', desk()],
    ['desklamp', 'An articulated lamp over a lit page', lamp()],
    ['switchboard', 'A patch console wiring one source to three ports', switchboard()],
    ['collate', 'A comparison gantry holding two drafts', collate()],
].map(([key, title, contents]) => [key, `<svg xmlns="http://www.w3.org/2000/svg" class="sg-project-figure" viewBox="15 -14 290 239" width="290" height="239" aria-hidden="true" focusable="false"><title>${title}</title>${contents}</svg>\n`]));

if (process.argv.includes('--write')) {
    const directory = fileURLToPath(new URL('../assets/projects/', import.meta.url));
    mkdirSync(directory, { recursive: true });
    for (const [key, svg] of Object.entries(figures)) writeFileSync(`${directory}/${key}.svg`, svg);
    console.log(`Built ${Object.keys(figures).length} project figures (Anatomy style).`);
} else {
    console.log(JSON.stringify(figures));
}

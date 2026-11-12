    // ======================= РИСУНКИ ЗВЕРЕЙ =======================
    // Звери рисуются векторно (SVG) отдельно от человека-фигуры из figure.js. Красивый рисунок лежит отдельно, поверх него —
    // прозрачные зоны боя (class "z zo", data-zone 0–3: голова, грудь, зад, лапы), которые подсвечиваются при ударах.
    // Если у врага нет рисунка (нет записи в CREATURES), бой показывает обычную фигуру.
    // Волк сбоку, смотрит вправо. Красивый рисунок отдельно от зон боя: поверх лежат прозрачные зоны
    // (0 голова, 1 грудь и шея, 2 зад и хвост, 3 лапы), которые подсвечиваются при ударах.
    function wolfSvg(p, id = "wolf") {
      const grad = (name, a, b) => `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
      const bodyPath = "M14 118 C16 106 34 102 54 104 C74 106 90 100 104 94 C110 90 116 88 122 88 L128 104 C122 114 116 124 110 132 C106 142 98 148 86 146 C72 142 58 138 44 138 C30 138 18 134 14 118 Z";
      const defs = `<defs>${grad("fur", p.dark, p.mid)}${grad("tail", p.mid, p.dark)}${grad("leg", p.mid, p.dark)}
        <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.eye}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.eye}" stop-opacity="0"/></radialGradient>
        <clipPath id="${id}-clip"><path d="${bodyPath}"/></clipPath></defs>`;
      // Лапа — ломаная линия: тёмная толстая под цветной тонкой даёт обводку и круглые суставы; носок идёт вперёд (вправо).
      const limb = (pts, w, color) => {
        const d = "M" + pts.map(q => q.join(" ")).join(" L");
        return `<path d="${d}" fill="none" stroke="${p.line}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>`
             + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      };
      const FRONT = "M90 124 C88 146 94 164 95 182 L93 194 C93 198 96 200 102 200 L112 200 C114 197 111 194 105 193 L106 180 C108 164 110 146 108 124 Z";
      const HIND = "M18 120 C8 136 12 152 22 162 C26 170 24 182 26 192 L24 196 C24 199 27 200 33 200 L44 200 C46 197 42 194 37 193 L37 176 C40 168 38 162 36 158 C46 150 52 138 48 122 Z";
      const legShape = (d, dx, fill) => `<path d="${d}" transform="translate(${dx} 0)" fill="${fill}" stroke="${p.line}" stroke-width="1.4" stroke-linejoin="round"/>`;
      const fang = p.fang ?? 1; // множитель клыков: у вожака крупнее
  const head = `<g transform="translate(22 6)">`
        + `<path d="M94 72 L96 55 L107 69 Z" fill="${p.dark}" stroke="${p.line}" stroke-width="1.2"/><path d="M97 68 L98 60 L103 68 Z" fill="#e9a3a3"/>`
        + `<path d="M92 74 C96 66 110 66 114 74 C120 80 126 86 133 91 L135 96 C135 100 128 103 120 103 L104 105 C96 104 90 98 88 88 C88 82 90 78 92 74 Z" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="1.4"/>`
        + `<path d="M100 98 C112 100 126 100 134 97 L135 99 C135 103 128 105 120 105 L104 106 Z" fill="${p.belly}" opacity="0.9"/>`
        + `<path d="M108 99 L132 99" stroke="#2a0d0d" stroke-width="1.6"/><path d="${[112, 120, 127].map(x => `M${x} 99 l${2 * fang} ${4 * fang} l${2 * fang} ${-4 * fang}`).join(" ")}" fill="#fff" stroke="#222" stroke-width="0.6"/>`
        + `<circle cx="106" cy="82" r="9" fill="url(#${id}-glow)"/>`
        + `<path d="M99 82 Q106 76 111 83 Q105 87 99 82 Z" fill="${p.eye}" stroke="${p.line}" stroke-width="1"/><ellipse cx="106" cy="82.5" rx="1.4" ry="2.6" fill="#111"/><circle cx="104.6" cy="81.2" r="0.9" fill="#fff"/>`
        + `<path d="M97 77 L111 81" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>`
        + `<circle cx="134" cy="92" r="2.8" fill="#111"/><circle cx="133.2" cy="91" r="0.9" fill="#fff"/></g>`;
      const art = [
        `<ellipse cx="66" cy="202" rx="68" ry="5" fill="#000" opacity="0.35"/>`,
        // дальние лапы темнее и рисуются до туловища
        legShape(HIND, 16, p.dark),
        legShape(FRONT, -16, p.dark),
        legShape(HIND, 0, `url(#${id}-leg)`),
        legShape(FRONT, 0, `url(#${id}-leg)`),
        // хвост: длинный, пушистый, свисает назад-вниз
        `<path d="M20 112 C8 114 -2 126 -4 146 C-6 162 -2 174 5 184 C9 174 15 160 17 146 C19 134 25 124 29 118 Z" fill="url(#${id}-tail)" stroke="${p.line}" stroke-width="1.3"/>`,
        `<path d="M-5 160 C-3 172 1 180 5 184 C9 176 12 170 14 162 C8 168 2 166 -5 160 Z" fill="${p.light}" opacity="0.75"/>`,
        // туловище, светлая грудь и брюхо, тёмная «накидка» на спине
        `<path d="${bodyPath}" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="1.4"/>`,
        `<g clip-path="url(#${id}-clip)"><ellipse cx="112" cy="130" rx="20" ry="22" fill="${p.belly}" opacity="0.9"/><ellipse cx="68" cy="146" rx="42" ry="9" fill="${p.belly}" opacity="0.75"/>
           <path d="M28 104 C50 98 82 102 100 110 C82 122 50 122 28 116 Z" fill="${p.dark}" opacity="0.35"/>
           <path d="M16 110 C40 102 74 106 106 92" stroke="#fff" stroke-opacity="0.28" stroke-width="1.6" fill="none"/></g>`,
        `<path d="M40 114 q5 -6 10 0 M58 120 q5 -6 10 0 M76 114 q5 -6 10 0" stroke="${p.line}" stroke-opacity="0.4" stroke-width="1.2" fill="none"/>`,
        // пушистая грудь: несколько мягких клочьев по передней кромке
        `<path d="M112 112 q6 2 4 8 q6 0 3 7 q-6 4 -10 0 Z M104 124 q6 2 3 8 q-6 3 -9 -1 Z" fill="${p.light}" opacity="0.9"/>`,
        head
      ].join("");
      const zone = (n, shape) => shape.replace(/^<(\w+)/, `<$1 class="z zo" data-zone="${n}"`);
      const zones = [
        zone(2, `<path d="M-8 100 L52 96 L52 148 L-8 148 Z"/>`),
        zone(1, `<path d="M52 86 L124 84 L122 148 L52 148 Z"/>`),
        zone(3, `<rect x="18" y="150" width="46" height="52"/>`),
        zone(3, `<rect x="76" y="150" width="46" height="52"/>`),
        zone(0, `<ellipse cx="136" cy="92" rx="26" ry="22"/>`)
      ].join("");
      return defs + `<g transform="translate(14 0)">${art}${zones}</g>`;
    }

    // Кабан сбоку, смотрит вправо. Те же четыре зоны: 0 — голова, 1 — холка и грудь, 2 — зад и хвост, 3 — ноги.
    function boarSvg(p, id = "boar") {
      const grad = (name, a, b) => `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
      const bodyPath = "M12 128 C6 110 14 96 34 92 C54 86 76 82 96 76 C110 72 122 78 128 88 C134 98 136 112 132 124 C130 138 118 150 100 152 C80 154 50 152 34 148 C20 146 14 140 12 128 Z";
      const defs = `<defs>${grad("fur", p.mid, p.dark)}${grad("leg", p.mid, p.dark)}<clipPath id="${id}-clip"><path d="${bodyPath}"/></clipPath></defs>`;
      const FRONT = "M104 140 L104 188 Q104 198 100 200 L118 200 Q120 196 117 188 L119 140 Z";
      const HIND = "M26 136 C22 158 30 172 30 188 L28 200 L47 200 Q45 192 45 186 L51 140 Z";
      const legShape = (d, dx, fill) => `<path d="${d}" transform="translate(${dx} 0)" fill="${fill}" stroke="${p.line}" stroke-width="1.4" stroke-linejoin="round"/>`;
      const art = [
        `<ellipse cx="72" cy="202" rx="76" ry="5" fill="#000" opacity="0.35"/>`,
        legShape(HIND, 16, p.dark), legShape(FRONT, -16, p.dark),
        legShape(HIND, 0, `url(#${id}-leg)`), legShape(FRONT, 0, `url(#${id}-leg)`),
        // хвост с кисточкой
        `<path d="M13 104 C-2 100 -6 86 3 78" fill="none" stroke="${p.line}" stroke-width="5" stroke-linecap="round"/><path d="M13 104 C-2 100 -6 86 3 78" fill="none" stroke="${p.mid}" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path d="M1 80 L-3 69 L4 73 L7 65 L9 76 Z" fill="${p.dark}" stroke="${p.line}" stroke-width="1"/>`,
        // туловище, светлый низ, блик по спине
        `<path d="${bodyPath}" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="1.4"/>`,
        `<g clip-path="url(#${id}-clip)"><ellipse cx="74" cy="156" rx="62" ry="14" fill="${p.light}" opacity="0.8"/>
           <path d="M16 100 C40 90 74 90 100 78" stroke="#fff" stroke-opacity="0.22" stroke-width="1.8" fill="none"/></g>`,
        // щетинистый гребень вдоль спины
        `<path d="M40 92 L46 80 L52 90 L58 78 L64 88 L72 76 L78 86 L86 74 L92 84 L100 70 L106 82 L114 72 L120 82 L124 90 Z" fill="${p.dark}" stroke="${p.line}" stroke-width="1"/>`,
        // голова: широкий лоб, плоский пятачок, клык
        `<path d="M120 80 L124 63 L134 78 Z" fill="${p.dark}" stroke="${p.line}" stroke-width="1.2"/><path d="M124 76 L125 68 L130 76 Z" fill="#c98a6a"/>`,
        `<path d="M118 82 C130 78 144 84 152 94 C158 100 166 108 168 116 L168 128 C166 134 156 136 150 134 C140 136 128 132 120 124 C112 114 112 92 118 82 Z" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="1.4"/>`,
        `<ellipse cx="168" cy="122" rx="6" ry="10" fill="#d9a27a" stroke="${p.line}" stroke-width="1.2"/><circle cx="170" cy="118" r="1.4" fill="#2a140a"/><circle cx="170" cy="125" r="1.4" fill="#2a140a"/>`,
        `<path d="M148 134 C142 124 148 112 158 106 C158 116 156 126 156 134 Z" fill="${p.tusk}" stroke="${p.line}" stroke-width="1.1"/>`,
        `<circle cx="138" cy="99" r="8" fill="${p.eye}" opacity="0.25"/><ellipse cx="138" cy="100" rx="4.2" ry="3.2" fill="${p.eye}" stroke="${p.line}" stroke-width="1"/><circle cx="139" cy="100" r="1.5" fill="#111"/><circle cx="137.6" cy="99" r="0.8" fill="#fff"/>`,
        `<path d="M131 94 L145 99" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round"/>`
      ].join("");
      const zone = (n, shape) => shape.replace(/^<(\w+)/, `<$1 class="z zo" data-zone="${n}"`);
      const zones = [
        zone(2, `<path d="M-8 70 L70 70 L70 150 L-8 150 Z"/>`),
        zone(1, `<path d="M70 66 L132 66 L132 150 L70 150 Z"/>`),
        zone(3, `<rect x="14" y="150" width="50" height="52"/>`),
        zone(3, `<rect x="74" y="150" width="50" height="52"/>`),
        zone(0, `<ellipse cx="150" cy="108" rx="28" ry="27"/>`)
      ].join("");
      return defs + `<g transform="translate(8 0)">${art}${zones}</g>`;
    }

    // Окно рисунка с запасом по краям: крупный зверь (scale > 1) не должен обрезаться. Ось зеркала проходит по x = w / 2.
    const CREATURE_VIEW = { w: 180, x: -5, y: 40, vw: 190, h: 180 };
    const CREATURES = {
      wolf: {
        draw: wolfSvg,
        palette: { dark: "#4a4f5c", mid: "#7d8494", light: "#c9ced9", belly: "#d9d4c7", eye: "#ffc933", line: "#22232b" },
        // Места надписей «×N» над зонами (голова, грудь, зад, лапы) в координатах рисунка, смотрящего вправо.
        labels: [[150, 78], [102, 110], [40, 116], [112, 176]]
      },
      boar: {
        draw: boarSvg,
        palette: { dark: "#4a2410", mid: "#8a4a24", light: "#b27a47", tusk: "#f3deb5", eye: "#f2c14e", line: "#24110a" },
        labels: [[164, 92], [112, 74], [40, 82], [124, 176]]
      },
      // Вожак стаи — тот же волк: темнее, крупнее (scale растёт от земли), клыки больше, глаза красные.
      leader: {
        draw: wolfSvg,
        palette: { dark: "#2c303c", mid: "#555a6b", light: "#9aa0b4", belly: "#b8b3a6", eye: "#ff6a3d", line: "#15161c", fang: 1.8 },
        labels: [[150, 78], [102, 110], [40, 116], [112, 176]],
        scale: 1.15
      }
    };

    // Рисунок зверя; mirrored — зверь смотрит влево (враг стоит справа от героя). Надписи лежат вне зеркальной группы, иначе цифры отразились бы.
    function creatureSvg(kind, mirrored) {
      const c = CREATURES[kind];
      const group = mirrored ? `<g transform="translate(${CREATURE_VIEW.w} 0) scale(-1 1)">` : `<g>`;
      const labels = c.labels
        .map(([x, y], i) => `<text class="lbl" data-zone="${i}" x="${mirrored ? CREATURE_VIEW.w - x : x}" y="${y}"></text>`).join("");
      // Масштаб вокруг точки на земле под серединой зверя: ноги остаются на месте, рисунок растёт вверх и в стороны.
      const k = c.scale ?? 1;
      const art = k === 1 ? c.draw(c.palette, "art-" + kind) : `<g transform="translate(90 200) scale(${k}) translate(-90 -200)">${c.draw(c.palette, "art-" + kind)}</g>`;
      return `<svg viewBox="${CREATURE_VIEW.x} ${CREATURE_VIEW.y} ${CREATURE_VIEW.vw} ${CREATURE_VIEW.h}" xmlns="http://www.w3.org/2000/svg">${group}${art}</g>${labels}</svg>`;
    }

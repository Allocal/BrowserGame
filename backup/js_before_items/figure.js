    // ======================= РИСУНОК ФИГУРЫ =======================
    // Фигура рисуется из простых фигур SVG. Каждая часть тела помечена номером зоны (data-zone),
    // чтобы подсвечивать зоны по правилам боя, а не по координатам.
    function itemSvg(shape, x) {
      switch (shape) {
        case "sword":
          return `<rect x="${x - 2}" y="35" width="4" height="82" fill="#d7dbe6" stroke="#222"/>`
               + `<rect x="${x - 9}" y="116" width="18" height="5" fill="#8a6a3b" stroke="#222"/>`
               + `<rect x="${x - 2.5}" y="121" width="5" height="16" fill="#5a3d1e" stroke="#222"/>`;
        case "knife":
          return `<rect x="${x - 1.5}" y="82" width="3" height="35" fill="#d7dbe6" stroke="#222"/>`
               + `<rect x="${x - 7}" y="116" width="14" height="4" fill="#8a6a3b" stroke="#222"/>`
               + `<rect x="${x - 2}" y="120" width="4" height="12" fill="#5a3d1e" stroke="#222"/>`;
        case "staff":
          return `<rect x="${x - 2}" y="34" width="4" height="108" fill="#6b4a26" stroke="#222"/>`
               + `<circle cx="${x}" cy="30" r="8" fill="#9a7bff" stroke="#222"/>`;
        case "axe":
          return `<rect x="${x - 2}" y="38" width="4" height="104" fill="#6b4a26" stroke="#222"/>`
               + `<path d="M${x - 2} 40 l-17 -7 v28 l17 -7 z" fill="#c4c9d6" stroke="#222"/>`;
        default:
          return "";
      }
    }

    function shieldSvg(shape) {
      if (shape === "buckler") {
        return `<circle cx="18" cy="98" r="13" fill="#9aa3b5" stroke="#222" stroke-width="2"/>`
             + `<circle cx="18" cy="98" r="4" fill="#d7dbe6" stroke="#222"/>`;
      }
      return `<path d="M3 72 h32 v32 q0 24 -16 32 q-16 -8 -16 -32 z" fill="#8a5a2b" stroke="#222" stroke-width="2"/>`
           + `<path d="M19 80 v46" stroke="#c9975a" stroke-width="3"/>`;
    }

    function figureSvg(gear, mirrored) {
      const body =
          `<circle class="z" data-zone="0" cx="60" cy="28" r="20"/>`
        + `<rect class="z" data-zone="1" x="36" y="52" width="48" height="62" rx="9"/>`
        + `<rect class="z" data-zone="1" x="18" y="56" width="14" height="62" rx="7"/>`
        + `<rect class="z" data-zone="1" x="88" y="56" width="14" height="62" rx="7"/>`
        + `<rect class="z" data-zone="2" x="38" y="117" width="44" height="30" rx="6"/>`
        + `<rect class="z" data-zone="3" x="38" y="150" width="20" height="92" rx="8"/>`
        + `<rect class="z" data-zone="3" x="62" y="150" width="20" height="92" rx="8"/>`;

      // Броня рисуется поверх тела полупрозрачно или частично, чтобы подсветка зоны оставалась видна.
      const armorShape = {
        0: c => `<path d="M40 26 a20 20 0 0 1 40 0 z" fill="${c}" stroke="#222" stroke-width="2"/>`,
        1: c => `<rect x="36" y="52" width="48" height="62" rx="9" fill="${c}" fill-opacity="0.6" stroke="#222"/>`
              + `<rect x="36" y="104" width="48" height="6" fill="#2b2118" fill-opacity="0.8"/>`,
        2: c => `<rect x="38" y="117" width="44" height="30" rx="6" fill="${c}" fill-opacity="0.6" stroke="#222"/>`,
        3: c => `<rect x="38" y="214" width="20" height="28" rx="6" fill="${c}" stroke="#222"/>`
              + `<rect x="62" y="214" width="20" height="28" rx="6" fill="${c}" stroke="#222"/>`
      };
      const armorSvg = gear.armorPieces.map(a => armorShape[a.zone](a.color)).join("");

      const isShield = s => s === "shield" || s === "buckler";
      let items = "";
      if (gear.mainShape) items += itemSvg(gear.mainShape, 108);
      if (gear.offShape) items += isShield(gear.offShape) ? shieldSvg(gear.offShape) : itemSvg(gear.offShape, 12);

      // Метки с числом ударов лежат вне отражённой группы, иначе цифры отразились бы зеркально.
      const group = mirrored ? `<g transform="translate(120 0) scale(-1 1)">` : `<g>`;
      const labels = [34, 88, 138, 200]
        .map((y, i) => `<text class="lbl" data-zone="${i}" x="60" y="${y}"></text>`).join("");

      return `<svg viewBox="0 0 120 250" xmlns="http://www.w3.org/2000/svg">${group}${body}${armorSvg}${items}</g>${labels}</svg>`;
    }

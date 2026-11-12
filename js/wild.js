    // ======================= ДИКИЕ ЗВЕРИ И ОБЩИЕ ПОМОЩНИКИ ДОБЫЧИ =======================
    // Бывший expedition.js: старая вылазка удалена, остались описания зверей, создание врага, добыча и помощники находок,
    // которыми пользуется подземелье (dungeon-screen.js).

    let capitalNote = "";   // сообщение о возвращении из подземелья, показывается на воротах один раз
    let afterLevelUp = null; // что сделать после экрана нового уровня (продолжение боя в подземелье)
    const pickRandom = list => list[Math.floor(Math.random() * list.length)];
    const rand = (a, b) => a + Math.random() * (b - a);

    // Враги вылазок. hp и dmg — множители к бойцу арены того же уровня (у зверя один удар, поэтому dmg выше).
    // style — привычки врага: strike/block — веса зон (Голова, Корпус, Пояс, Ноги; 1 — обычно), react — как сильно он реагирует на твой прошлый ход.
    // xp — множитель к опыту равного боя на арене: в лесу опыта больше, потому что нет лечения между боями и поражение отнимает добычу.
    // drops: шанс (0…1) и количество; copper — множитель к базовой денежной награде уровня.
    // Общий множитель урона диких врагов: ручка сложности, подобрана замерами (при ×1 бои с обычными врагами были почти непроигрываемыми).
    const WILD_DMG_FACTOR = 1.5;
    const WILD_ENEMIES = {
      wolf:   { name: "Волк", gear: "none", traits: { agility: 0.6, attention: 0.25, strength: 0.15 }, hp: 0.8, dmg: 1.4, xp: 1.2, style: { strike: [0.6, 1, 1.2, 1.6], react: 0.4 }, drops: [{ item: "wolfPelt", chance: 0.45, min: 1, max: 1 }] },
      boar:   { name: "Кабан", gear: "none", traits: { strength: 0.45, endurance: 0.4, attention: 0.15 }, hp: 1.0, dmg: 1.2, xp: 1.3, style: { strike: [0.7, 1.8, 1, 0.8], react: 0.3 }, drops: [{ item: "boarTusk", chance: 0.4, min: 1, max: 2 }] },
      bandit: { name: "Лесной разбойник", gear: "weapon", traits: { attention: 0.5, agility: 0.25, endurance: 0.25 }, hp: 1.0, dmg: 1.3, xp: 1.5, style: { strike: [1.5, 1.3, 0.8, 0.6], block: [1.8, 1, 0.8, 0.6], react: 0.6 }, armored: true, drops: [{ copper: true, chance: 0.55, min: 0.1, max: 1.5 }, { copper: true, chance: 0.06, min: 3, max: 6 }] },
      leader: { name: "Вожак стаи", gear: "none", traits: { agility: 0.3, strength: 0.25, endurance: 0.25, attention: 0.2 }, hp: 1.6, dmg: 1.8, xp: 3.0, style: { react: 0.8 }, rareBoost: 3, armored: true, drops: [{ item: "wolfPelt", chance: 1, min: 1, max: 2 }, { item: "leaderFang", chance: 0.6, min: 1, max: 1 }] }
    };

    // Редкость: ★ — необычное, ★★ — редкое. Это только пометка и цена, силы предметам не добавляет.
    const RARITY_STARS = { uncommon: "★", rare: "★★", unique: "★★★" };
    function rarityMark(key) { return RARITY_STARS[ITEMS[key].rarity] ?? ""; }

    function lootText(loot) {
      const parts = [];
      if (loot.copper > 0) parts.push(formatMoney(loot.copper));
      for (const key in loot.items) if (loot.items[key] > 0) parts.push(`${rarityMark(key)}${ITEMS[key].name} ×${loot.items[key]}`.trim());
      (loot.gear ?? []).forEach(inst => parts.push(instName(inst)));
      return parts.length ? parts.join(", ") : "пока ничего";
    }

    function addLoot(exp, copper, items, gear) {
      exp.loot.copper += copper;
      if (gear) (exp.loot.gear ??= []).push(gear);
      for (const key in (items ?? {})) exp.loot.items[key] = (exp.loot.items[key] ?? 0) + items[key];
    }

    // Для лагеря нужны оба предмета набора путешественника.
    const hasKit = p => (p.inventory.flint ?? 0) > 0 && (p.inventory.bedroll ?? 0) > 0;

    // Снаряжение, которое может найтись: то, что продаётся в магазине на уровне героя и ниже.
    // Так находка не обгонит магазин по базе, а силу ей добавляют только редкость и бонусы.
    function gearPoolFor(level) {
      const keys = [];
      SHOP_STOCK.forEach(tier => {
        if (tier.minLevel > level) return;
        tier.items.forEach(k => { if (!isStackable(k) && !keys.includes(k)) keys.push(k); });
      });
      return keys;
    }

    // Выбор по весам: { common: 70, uncommon: 25, rare: 5 } — ключ с вероятностью, пропорциональной своему весу.
    function pickWeighted(weights) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      for (const key in weights) {
        roll -= weights[key];
        if (roll < 0) return key;
      }
      return Object.keys(weights)[0]; // страховка от погрешности вычислений
    }

    // Бросок снаряжения для находки: с шансом spec.chance вообще что-то есть, тип любой (для любого класса), редкость по весам.
    function rollGearFind(spec, level) {
      if (Math.random() >= spec.chance) return null;
      const pool = gearPoolFor(level);
      const base = pool[Math.floor(Math.random() * pool.length)];
      return rollItem(base, pickWeighted(spec.rarity));
    }

    // Деньги и обычные предметы точки: общая часть основной находки и «заметил ещё» (Внимание).
    function rollBasicLoot(spec) {
      const unit = arenaBaseMoney(journey.player.level);
      const copper = spec.copper ? Math.round(unit * rand(spec.copper[0], spec.copper[1])) : 0;
      const items = (spec.items && Math.random() < (spec.itemChance ?? 1)) ? { ...spec.items } : {};
      return { copper, items };
    }

    function rollFindLoot(exp, spec) {
      const { copper, items } = rollBasicLoot(spec);
      const rare = rollRare(spec.rareBoost ?? 0.5);
      for (const k in rare) items[k] = (items[k] ?? 0) + rare[k];
      const gear = spec.gear ? rollGearFind(spec.gear, journey.player.level) : null;
      addLoot(exp, copper, items, gear);
      return { copper, items, gear };
    }

    function makeWildEnemy(kind, level, dmgBonus = 1, scale = 1) { // dmgBonus: множитель урона врага (ночное нападение), обычно 1; scale: общая сила (участник пачки)
      const t = WILD_ENEMIES[kind];
      const L = Math.max(1, level);
      const base = arenaFighterStats(L).dmg;
      const pts = enemyPoints(L, t.traits ?? {});
      return {
        name: t.name, art: kind, style: t.style, gear: t.gear, health: Math.round((25 + 9 * L) * t.hp * scale), magicResist: Math.floor(ENEMY_MAGIC_RESIST_PER_LEVEL * L),
        dmg: [Math.round(base[0] * t.dmg * WILD_DMG_FACTOR * dmgBonus * scale), Math.round(base[1] * t.dmg * WILD_DMG_FACTOR * dmgBonus * scale)],
        armor: t.armored ? [Math.floor(0.4 * L), Math.floor(0.6 * L), Math.floor(0.4 * L), Math.floor(0.3 * L)] : null,
        dodge: pts.agility ?? 0, critRating: pts.agility ?? 0, accuracy: pts.attention ?? 0, critResist: pts.endurance ?? 0,
        penetration: (pts.strength ?? 0) * PENETRATION_PER_STRENGTH
      };
    }

    // Редкие находки: шанс срабатывает на каждую победу и на каждую находку в точке.
    // boost умножает шансы (вожак, сундуки).
    const RARE_POOL = { uncommon: { chance: 0.08, items: ["amber"] }, rare: { chance: 0.03, items: ["oldRing", "goldNugget"] } };
    function rollRare(boost = 1) {
      const out = {};
      for (const tier of ["rare", "uncommon"]) {
        const t = RARE_POOL[tier];
        if (Math.random() < t.chance * boost) { out[t.items[Math.floor(Math.random() * t.items.length)]] = 1; break; }
      }
      return out;
    }

    function rollDrops(kind, level) {
      const t = WILD_ENEMIES[kind];
      const unit = arenaBaseMoney(level);
      const out = { copper: 0, items: {} };
      t.drops.forEach(d => {
        if (Math.random() >= d.chance) return;
        if (d.copper) out.copper += Math.round(unit * rand(d.min, d.max));
        else out.items[d.item] = (out.items[d.item] ?? 0) + Math.floor(rand(d.min, d.max + 0.999));
      });
      const rare = rollRare(WILD_ENEMIES[kind].rareBoost ?? 1);
      for (const k in rare) out.items[k] = (out.items[k] ?? 0) + rare[k];
      return out;
    }

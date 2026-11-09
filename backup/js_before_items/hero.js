    // ======================= СНАРЯЖЕНИЕ И ХАРАКТЕРИСТИКИ (не знает про экран) =======================
    function fullEquipment(partial) {
      const eq = {};
      SLOTS.forEach(s => { eq[s.key] = null; });
      return Object.assign(eq, partial);
    }

    // Из надетого считаем число ударов и блоков, бонусы урона и названия. Всё остальное опирается на этот результат.
    function gearFromEquipment(eq, label) {
      const main = eq.mainHand ? ITEMS[eq.mainHand] : null;
      const off = eq.offHand ? ITEMS[eq.offHand] : null;
      const offIsWeapon = off !== null && off.type === "weapon1h";
      const offIsShield = off !== null && off.type === "shield";

      const strikes = 1 + (offIsWeapon ? 1 : 0);
      const blocks = 1 + (offIsWeapon ? 1 : 0) + (offIsShield ? off.blocks : 0) + (main && main.type === "staff" ? main.blocks : 0);
      // Первый удар делается основной рукой, второй (если есть) — второй рукой.
      const asHit = w => ({ min: w.dmg[0], max: w.dmg[1], crit: w.crit, strMult: w.type === "weapon2h" ? BALANCE.twoHandStrength : 1 });
      const hits = [asHit(main ?? FISTS)];
      if (offIsWeapon) hits.push(asHit(off));

      const names = [main?.name, off?.name].filter(Boolean);
      const armor = ARMOR_SLOTS.map(slot => (eq[slot] ? ITEMS[eq[slot]].armor : 0));
      const armorPieces = [];
      ARMOR_SLOTS.forEach((slot, zone) => { if (eq[slot]) armorPieces.push({ zone, color: ITEMS[eq[slot]].color }); });
      return {
        name: label ?? (names.length ? names.join(" + ") : "Без снаряжения"),
        strikes, blocks, hits, armor, armorPieces,
        mainShape: main ? main.shape : null,
        offShape: off ? off.shape : null
      };
    }

    // Всё, что считается из характеристик и надетого, пересчитывается здесь одним местом.
    function refreshDerived(p) {
      p.gear = gearFromEquipment(p.equipment, p.gearLabel);
      const direction = DIRECTIONS[p.direction];
      const damageBonus = direction ? direction.damageBonus : 0;
      p.strikeDamages = p.gear.hits.map(h => ({ min: Math.round(p.strength * h.strMult) + damageBonus + h.min, max: Math.round(p.strength * h.strMult) + damageBonus + h.max, crit: Math.round((h.crit + critBonusOf(p)) * 10) / 10 }));
      p.dodge = dodgeOf(p);
      if (direction && direction.armorBonus) p.gear.armor = p.gear.armor.map(a => a + direction.armorBonus);
      p.maxHealth = maxHealthOf(p);
      p.maxMana = maxManaOf(p);
      p.magicResist = magicResistOf(p);
      const staffBonus = ITEMS[p.equipment.mainHand]?.spellBonus ?? 0;
      p.spellDamage = p.classKey === "mage"
        ? { min: SPELL.min + Math.round(p.intelligence * SPELL.intMult) + staffBonus, max: SPELL.max + Math.round(p.intelligence * SPELL.intMult) + staffBonus, crit: Math.round((SPELL.crit + critBonusOf(p)) * 10) / 10 }
        : null;
    }

    function createHero(name, stats, equipment, label) {
      const p = {
        name, level: stats.level, strength: stats.strength, endurance: stats.endurance, agility: stats.agility ?? BASE_STAT,
        intelligence: stats.intelligence ?? BASE_STAT, classKey: CLASSES[stats.classKey] ? stats.classKey : "warrior",
        classChosen: false, spells: stats.classKey === "mage" ? ["arrow"] : [],
        equipment: fullEquipment(equipment), gearLabel: label ?? null,
        xp: 0, pendingPoints: 0, inventory: {}, direction: null, copper: 0, arena: newArenaState()
      };
      refreshDerived(p);
      p.health = p.maxHealth;
      return p;
    }

    function createEnemy(def) {
      const preset = PRESETS[def.gear];
      const gear = gearFromEquipment(fullEquipment(preset.equipment), preset.label);
      if (def.armor) {
        // Броню противника задаём числами, поэтому и рисунок строим по числам: тёмный цвет отличает её от кожаной брони героя.
        gear.armor = def.armor;
        gear.armorPieces = [];
        def.armor.forEach((a, zone) => { if (a > 0) gear.armorPieces.push({ zone, color: "#4a4f5c" }); });
      }
      return {
        name: def.name, gear, dodge: def.dodge ?? 0, magicResist: def.magicResist ?? 0,
        health: def.health, maxHealth: def.health,
        strikeDamages: gear.hits.map(() => ({ min: def.dmg[0], max: def.dmg[1], crit: def.crit ?? ENEMY_CRIT }))
      };
    }

    const rangeText = d => (d.min === d.max ? `${d.min}` : `${d.min}–${d.max}`);

    function damageText(p) {
      return p.strikeDamages.map(rangeText).join(" и ");
    }

    function critText(p) {
      return p.strikeDamages.map(d => `${d.crit}%`).join(" и ");
    }

    function armorCutPercent(armor) {
      return Math.round(armor / (armor + ARMOR_K) * 100);
    }

    function armorText(gear) {
      return ZONES.map((z, i) => `${z} ${gear.armor[i]} (−${armorCutPercent(gear.armor[i])}%)`).join(", ");
    }

    // ----- смена снаряжения -----
    function addToInventory(p, key, count) {
      p.inventory[key] = (p.inventory[key] ?? 0) + count;
    }

    function unequipSlot(p, slot) {
      const key = p.equipment[slot];
      if (!key) return;
      p.equipment[slot] = null;
      addToInventory(p, key, 1);
    }

    // Снять предмет. Если снимаем основную руку, а во второй лежит оружие, то оно переходит в основную:
    // иначе получилось бы оружие во второй руке при пустой основной.
    function unequipFromUi(p, slot) {
      const off = p.equipment.offHand ? ITEMS[p.equipment.offHand] : null;
      unequipSlot(p, slot);
      if (slot === "mainHand" && off && off.type === "weapon1h") {
        p.equipment.mainHand = p.equipment.offHand;
        p.equipment.offHand = null;
      }
      refreshDerived(p);
    }

    // Маг не пользуется оружием и щитами (его сила в заклинаниях); броню носить может.
    // Посох только для мага; оружие и щиты только не для мага.
    const canUseItem = (p, item) => {
      const isMage = p.classKey === "mage";
      if (item.type === "staff") return isMage;
      if (item.type === "weapon1h" || item.type === "weapon2h" || item.type === "shield") return !isMage;
      return true;
    };

    // Убираем в рюкзак то, что классу не подходит (при смене класса и в старых сохранениях).
    function enforceClassGear(p) {
      ["mainHand", "offHand"].forEach(slot => { // оружие/щит мага и посох воина уходят в рюкзак
        const key = p.equipment[slot];
        if (key && !canUseItem(p, ITEMS[key])) unequipSlot(p, slot);
      });
    }

    function equipItem(p, key, slot) {
      const item = ITEMS[key];
      if (!(p.inventory[key] > 0) || !canUseItem(p, item)) return;
      p.inventory[key] -= 1;

      if (item.type === "armor") {
        // Броня всегда идёт в своё место и не трогает руки.
        unequipSlot(p, item.slot);
        p.equipment[item.slot] = key;
      } else if (item.type === "weapon2h") {
        unequipSlot(p, "mainHand");
        unequipSlot(p, "offHand");
        p.equipment.mainHand = key;
      } else {
        // Двуручное оружие занимает обе руки, поэтому при надевании щита или нового оружия сначала убираем его.
        const main = p.equipment.mainHand ? ITEMS[p.equipment.mainHand] : null;
        if (main && main.type === "weapon2h") unequipSlot(p, "mainHand");
        unequipSlot(p, slot);
        p.equipment[slot] = key;
      }
      refreshDerived(p);
    }

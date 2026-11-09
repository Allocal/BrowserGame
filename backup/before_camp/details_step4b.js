    // ======================= ПОДРОБНЫЕ ХАРАКТЕРИСТИКИ (не знает про экран) =======================
    // Для каждого итогового числа боя собираем из каких частей оно сложилось. Формулы здесь повторяют расчёт в hero.js и data.js:
    // это только объяснение, само число берётся оттуда (p.strikeDamages, p.dodge и т.д.), поэтому оно не может разойтись с боем.

    const num = x => String(Math.round(x * 10) / 10); // без лишних нулей: 12.5, 4, 0.8

    // Добавляет строку-часть, только если вклад не нулевой (кроме обязательных).
    const part = (parts, text, amount) => { if (amount === undefined || amount !== 0) parts.push(text); };

    function describeStats(p) {
      const direction = DIRECTIONS[p.direction];
      const agility = statOf(p, "agility");
      const ab = agilityBonus(p); // очки Ловкости сверх стартовых с учётом направления
      const agilityText = `Ловкость ${agility}${directionAgility(p) ? ` + направление ${directionAgility(p)}` : ""}`;
      const sections = [];

      // ----- Атака -----
      const attack = [];
      p.gear.hits.forEach((h, i) => {
        const profile = p.strikeDamages[i];
        const strength = statOf(p, "strength");
        const parts = [`Сила ${strength}${h.strMult > 1 ? ` ×${h.strMult}` : ""} = ${Math.round(strength * h.strMult)}`, `оружие +${h.min}…${h.max}`];
        part(parts, `направление +${direction?.damageBonus ?? 0}`, direction?.damageBonus ?? 0);
        part(parts, `снаряжение +${bonusOf(p, "damage")}`, bonusOf(p, "damage"));
        const label = p.gear.hits.length > 1 ? `Урон ${i === 0 ? "основной" : "второй"} руки` : "Урон за удар";
        attack.push({ label: p.spellDamage ? "Удар без маны" : label, value: rangeText(profile), parts });
      });
      if (p.spellDamage) {
        const intel = statOf(p, "intelligence");
        const staff = itemOf(p.equipment.mainHand)?.spellBonus ?? 0;
        const parts = [`основа ${SPELL.min}…${SPELL.max}`, `Интеллект ${intel} ×${SPELL.intMult} = +${Math.round(intel * SPELL.intMult)}`];
        part(parts, `посох +${staff}`, staff);
        part(parts, `снаряжение +${bonusOf(p, "spellPower")}`, bonusOf(p, "spellPower"));
        attack.unshift({ label: "Заклинание", value: rangeText(p.spellDamage), parts });
      }

      // Шанс крита: для мага важен крит заклинания, для воина — крит удара.
      const critProfile = p.spellDamage ?? p.strikeDamages[0];
      const critBase = p.spellDamage ? SPELL.crit : p.gear.hits[0].crit;
      const critRaw = critBase + critBonusOf(p);
      const critParts = [`${p.spellDamage ? "заклинание" : "оружие"} ${num(critBase)}%`, `${agilityText} → +${num(ab * CRIT_PER_AGILITY)}%`];
      part(critParts, `снаряжение +${num(bonusOf(p, "crit"))}%`, bonusOf(p, "crit"));
      if (critRaw > CRIT_CAP) critParts.push(`потолок ${CRIT_CAP}%`);
      attack.push({ label: "Шанс крита", value: `${critProfile.crit}%`, parts: critParts });

      const powerParts = [`база ×${CRIT_MULTIPLIER}`];
      part(powerParts, `снаряжение +${bonusOf(p, "critPower")}%`, bonusOf(p, "critPower"));
      attack.push({ label: "Сила крита", value: `×${Math.round(p.critMult * 100) / 100}`, parts: powerParts });
      sections.push({ title: "Атака", rows: attack });

      // ----- Защита -----
      const defense = [];
      const hc = classOf(p).health;
      const endurance = statOf(p, "endurance");
      const healthParts = [`база ${hc.base}`, `Выносливость ${endurance} ×${hc.perEndurance} = ${hc.perEndurance * endurance}`, `уровень ${p.level}: +${hc.perLevel * (p.level - 1)}`];
      part(healthParts, `снаряжение +${bonusOf(p, "health")}`, bonusOf(p, "health"));
      defense.push({ label: "Здоровье", value: `${p.maxHealth}`, parts: healthParts });

      const dodgeFormula = 100 * ab / (ab + DODGE_K);
      const dodgeParts = [`${agilityText}: очков сверх ${BASE_STAT} — ${ab} → ${num(dodgeFormula)}%`];
      part(dodgeParts, `снаряжение +${num(bonusOf(p, "dodge"))}%`, bonusOf(p, "dodge"));
      if (dodgeFormula + bonusOf(p, "dodge") > DODGE_CAP) dodgeParts.push(`потолок ${DODGE_CAP}%`);
      defense.push({ label: "Уклонение", value: `${p.dodge}%`, parts: dodgeParts });

      const main = itemOf(p.equipment.mainHand);
      const off = itemOf(p.equipment.offHand);
      const blockParts = ["базовый 1"];
      if (off?.type === "weapon1h") blockParts.push("оружие во второй руке +1");
      if (off?.type === "shield") blockParts.push(`${off.name} +${off.blocks}`);
      if (main?.type === "staff") blockParts.push(`${main.name} +${main.blocks}`);
      defense.push({ label: "Блоки за ход", value: `${p.gear.blocks}`, parts: blockParts });

      if (p.classKey === "mage") {
        const intel = statOf(p, "intelligence");
        const manaParts = [`Интеллект ${intel} ×${MANA_PER_INTELLIGENCE} = ${MANA_PER_INTELLIGENCE * intel}`];
        part(manaParts, `снаряжение +${bonusOf(p, "mana")}`, bonusOf(p, "mana"));
        manaParts.push(`в бою +${BALANCE_MANA.regen} за ход`);
        defense.push({ label: "Мана", value: `${p.maxMana}`, parts: manaParts });
      }
      const resistParts = [`Интеллект ${statOf(p, "intelligence")}: очков сверх ${BASE_STAT} — ${Math.max(0, statOf(p, "intelligence") - BASE_STAT)}`];
      part(resistParts, `снаряжение +${bonusOf(p, "magicResist")}`, bonusOf(p, "magicResist"));
      defense.push({ label: "Сопротивление магии", value: `${p.magicResist}`, parts: resistParts });

      ZONES.forEach((zone, i) => {
        const inst = p.equipment[ARMOR_SLOTS[i]];
        const parts = [];
        if (inst) {
          parts.push(`${itemOf(inst).name} ${itemOf(inst).armor}`);
          part(parts, `бонус предмета +${instBonus(inst, "armor")}`, instBonus(inst, "armor"));
        } else parts.push("нет брони");
        part(parts, `направление +${direction?.armorBonus ?? 0}`, direction?.armorBonus ?? 0);
        defense.push({ label: `Броня: ${zone.toLowerCase()}`, value: `${p.gear.armor[i]} (гасит ${armorCutPercent(p.gear.armor[i])}%)`, parts });
      });
      sections.push({ title: "Защита", rows: defense });

      // ----- Внимание -----
      const attention = statOf(p, "attention");
      const ax = Math.max(0, attention - BASE_STAT); // очки Внимания сверх стартовых
      const noticeParts = [`Внимание ${attention}: очков сверх ${BASE_STAT} — ${ax}`, `база ${NOTICE.base}%`, `от очков +${num(NOTICE.max * ax / (ax + NOTICE.k))}% (до ${NOTICE.base + NOTICE.max}%)`];
      const watchParts = [`Внимание ${attention}: очков сверх ${BASE_STAT} — ${ax}`, `база ${WATCH.base}%`, `от очков +${num(WATCH.max * ax / (ax + WATCH.k))}% (до ${WATCH.base + WATCH.max}%)`, `заметил — шанс нападения в ${num(1 / CAMP.signsFactor)} раз меньше`];
      sections.push({ title: "Внимание", rows: [
        { label: "Заметить ещё при находке", value: `${noticeChanceOf(p)}%`, parts: noticeParts },
        { label: "Заметить опасность заранее", value: `${watchChanceOf(p)}%`, parts: watchParts }
      ] });
      return sections;
    }

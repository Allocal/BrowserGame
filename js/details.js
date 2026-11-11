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
      const critParts = [`${p.spellDamage ? "заклинание" : "оружие"}: база ${num(critProfile.critBase)}%`, `${agilityText}: очков сверх ${BASE_STAT} — ${ab}`];
      part(critParts, `снаряжение +${num(bonusOf(p, "crit"))} очк.`, bonusOf(p, "crit"));
      critParts.push(`каждые ${CRIT_K} очков перевеса над защитой цели от крита удваивают шансы`);
      attack.push({ label: "Шанс крита", value: `${critProfile.crit}%`, parts: critParts });

      const powerParts = [`база ×${CRIT_MULTIPLIER}`];
      part(powerParts, `снаряжение +${bonusOf(p, "critPower")}%`, bonusOf(p, "critPower"));
      attack.push({ label: "Сила крита", value: `×${Math.round(p.critMult * 100) / 100}`, parts: powerParts });
      const strengthOver = Math.max(0, statOf(p, "strength") - BASE_STAT);
      const penParts = [`Сила ${statOf(p, "strength")}: очков сверх ${BASE_STAT} — ${strengthOver}`, `×${PENETRATION_PER_STRENGTH} очка за очко`];
      part(penParts, `снаряжение +${bonusOf(p, "penetration")}`, bonusOf(p, "penetration"));
      penParts.push("вычитается из брони зоны цели, только для физических ударов");
      attack.push({ label: "Пробивание брони", value: num(p.penetration), parts: penParts });
      sections.push({ title: "Атака", rows: attack });

      // ----- Защита -----
      const defense = [];
      const hc = classOf(p).health;
      const endurance = statOf(p, "endurance");
      const healthParts = [`база ${hc.base}`, `Выносливость ${endurance} ×${hc.perEndurance} = ${hc.perEndurance * endurance}`, `уровень ${p.level}: +${hc.perLevel * (p.level - 1)}`];
      part(healthParts, `снаряжение +${bonusOf(p, "health")}`, bonusOf(p, "health"));
      defense.push({ label: "Здоровье", value: `${p.maxHealth}`, parts: healthParts });

      const dodgeParts = [`${agilityText}: очков сверх ${BASE_STAT} — ${ab}`];
      part(dodgeParts, `снаряжение +${num(bonusOf(p, "dodge"))} очк.`, bonusOf(p, "dodge"));
      dodgeParts.push(`база ${DODGE_BASE}%, каждые ${DODGE_K} очков перевеса над меткостью врага удваивают шансы`);
      defense.push({ label: "Уклонение", value: `${p.dodge}%`, parts: dodgeParts });

      const critAgainst = Math.round(chanceOf(ENEMY_CRIT, -p.critResist, CRIT_K) * 10) / 10;
      defense.push({ label: "Крит по вам", value: `${critAgainst}%`,
        parts: [`Выносливость ${endurance}: очков сверх ${BASE_STAT} — ${p.critResist}`, `враг с базой ${ENEMY_CRIT}% и без очков крита`, `каждые ${CRIT_K} очков защиты удваивают отношение «не крит к крит»`] });

      const sneakX = agilityBonus(p);
      defense.push({ label: "Пройти врага незамеченным", value: `${sneakChanceOf(p)}%`,
        parts: [`${agilityText}: очков сверх ${BASE_STAT} — ${sneakX}`, `база ${SNEAK.base}%`, `от очков +${num(SNEAK.max * sneakX / (sneakX + SNEAK.k))}% (до ${SNEAK.base + SNEAK.max}%)`, `провал — враг бьёт на ${Math.round((SNEAK.failDmgBonus - 1) * 100)}% сильнее`] });

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

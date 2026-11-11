    // ======================= СЛУЧАЙНЫЕ БОНУСЫ СНАРЯЖЕНИЯ =======================
    // Здесь только данные и бросок. Подключение бонусов к расчёту характеристик — отдельным шагом.
    // Бонус на предмете — запись { stat, value }. Что означает stat, описано в BONUS_TYPES.

    // Для каждого вида бонуса: название, как показывать число и диапазон значения по редкости.
    // Диапазоны примерные, их мы будем подстраивать при балансе.
    const BONUS_TYPES = {
      strength:     { name: "Сила",                 range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } },
      endurance:    { name: "Выносливость",         range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } },
      agility:      { name: "Ловкость",             range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } },
      intelligence: { name: "Интеллект",            range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } },
      damage:       { name: "Урон за удар",         range: { uncommon: [1, 2],  rare: [2, 4],   unique: [4, 6] } },
      critPower:    { name: "Сила крита",          range: { uncommon: [10, 20], rare: [20, 35], unique: [35, 50] }, percent: true },
      crit:         { name: "Шанс крита",           range: { uncommon: [2, 4],  rare: [4, 7],   unique: [7, 10] }, percent: true },
      dodge:        { name: "Уклонение",            range: { uncommon: [2, 3],  rare: [3, 5],   unique: [5, 8] } },
      health:       { name: "Здоровье",             range: { uncommon: [5, 10], rare: [10, 20], unique: [20, 35] } },
      mana:         { name: "Мана",                 range: { uncommon: [2, 4],  rare: [4, 8],   unique: [8, 12] } },
      spellPower:   { name: "Сила заклинаний",      range: { uncommon: [1, 2],  rare: [2, 4],   unique: [4, 6] } },
      magicResist:  { name: "Сопротивление магии",  range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } },
      armor:        { name: "Броня",                range: { uncommon: [1, 2],  rare: [2, 3],   unique: [3, 5] } }
    };

    // Какие бонусы уместны на каком виде предмета. Ключ — группа предмета (см. bonusGroupOf).
    const BONUS_POOLS = {
      weapon1h:    ["damage", "crit", "critPower", "strength", "agility"],
      weapon2h:    ["damage", "strength", "crit", "critPower"],
      staff:       ["intelligence", "spellPower", "mana", "crit", "critPower"],
      shield:      ["endurance", "health", "magicResist"],
      armor_head:  ["endurance", "health", "intelligence", "magicResist"],
      armor_chest: ["endurance", "health", "armor"],
      armor_legs:  ["endurance", "agility", "dodge"],
      armor_boots: ["agility", "dodge"]
    };

    // Сколько бонусов у предмета каждой редкости. Обычный предмет бонусов не имеет.
    const BONUS_COUNT = { common: 0, uncommon: 1, rare: 2, unique: 3 };

    // Группа предмета для выбора пула: броня делится по частям тела, остальное — по типу.
    const bonusGroupOf = item => (item.type === "armor" ? `armor_${item.slot}` : item.type);

    // Качество вещи 0…1: среднее нескольких случайных чисел, поэтому чаще середина, крайности редки (колокол).
    // Количество «кубиков» подбирается по игре: 2 кубика, качество от 95% у 1 вещи из 200.
    const QUALITY_DICE = 2;
    function rollQuality() {
      let sum = 0;
      for (let i = 0; i < QUALITY_DICE; i++) sum += Math.random();
      return sum / QUALITY_DICE;
    }

    // Выбрать случайные бонусы для предмета заданной редкости: разные виды, значение в диапазоне редкости по качеству.
    function rollBonuses(item, rarity, quality = rollQuality()) {
      const pool = BONUS_POOLS[bonusGroupOf(item)] ?? [];
      const count = Math.min(BONUS_COUNT[rarity] ?? 0, pool.length);
      const left = [...pool]; // копия: из неё вынимаем выбранное, а таблицу не портим
      const bonuses = [];
      for (let i = 0; i < count; i++) {
        const stat = left.splice(Math.floor(Math.random() * left.length), 1)[0];
        const [min, max] = BONUS_TYPES[stat].range[rarity];
        bonuses.push({ stat, value: min + Math.round(quality * (max - min)) });
      }
      return bonuses;
    }

    // Новый предмет со случайными бонусами: в добыче используем его вместо makeItem.
    // Качество бросается заранее: от него считаются значения бонусов, и оно же запоминается на вещи.
    const rollItem = (base, rarity) => {
      const quality = rollQuality();
      const bonuses = rollBonuses(ITEMS[base], rarity, quality);
      return makeItem(base, rarity, bonuses, bonuses.length > 0 ? Math.round(quality * 100) : null);
    };

    // ----- Чтение бонусов с надетого -----
    // Сумма бонусов одного вида на одном предмете.
    // Постоянный бонус материала (слой 2): берётся из таблицы MATERIALS по материалу и месту вещи, на экземпляре не хранится.
    const materialBonus = (inst, stat) => {
      const item = itemOf(inst);
      const material = MATERIALS[item.material];
      return material && material.stat === stat ? material.bySlot[item.slot] ?? 0 : 0;
    };
    // Бонусы одного вида на предмете: характер материала плюс случайные бонусы редкости.
    const instBonus = (inst, stat) => materialBonus(inst, stat) + inst.bonuses.reduce((sum, b) => (b.stat === stat ? sum + b.value : sum), 0);

    // Сумма бонусов одного вида со всего надетого. У врагов снаряжения-экземпляров нет, тогда сумма 0.
    function bonusOf(c, stat) {
      let sum = 0;
      for (const slot in (c.equipment ?? {})) {
        if (c.equipment[slot]) sum += instBonus(c.equipment[slot], stat);
      }
      return sum;
    }

    // Итоговая характеристика: очки, вложенные игроком, плюс бонусы снаряжения. Все формулы считаются от неё.
    const statOf = (c, stat) => (c[stat] ?? BASE_STAT) + bonusOf(c, stat);

    // Строки бонусов экземпляра для карточки.
    const bonusLines = inst => inst.bonuses.map(bonusText);

    // Все строки вещи для карточки по слоям: характер материала, случайные бонусы, качество.
    const materialLine = inst => {
      const material = MATERIALS[itemOf(inst).material];
      const value = material ? materialBonus(inst, material.stat) : 0;
      return value > 0 ? `${material.name}: +${value} ${BONUS_TYPES[material.stat].name}` : null;
    };
    const qualityLine = inst => (Number.isFinite(inst.quality) ? `Качество ${inst.quality}%` : null);
    // Класс цвета названия по редкости; у обычной вещи правила в CSS нет, цвет остаётся обычным.
    const rarityClass = inst => `rarity-${inst.rarity}`;
    const gearLines = inst => [materialLine(inst), ...bonusLines(inst), qualityLine(inst)].filter(Boolean);

    // Строка для показа: «+2 Сила», «+5% Шанс крита».
    const bonusText = b => `+${b.value}${BONUS_TYPES[b.stat]?.percent ? "%" : ""} ${BONUS_TYPES[b.stat]?.name ?? b.stat}`;

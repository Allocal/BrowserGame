    // ======================= ДАННЫЕ =======================
    const ZONES = ["Голова", "Корпус", "Пояс", "Ноги"];
    const BASE_STAT = 5;
    const POINTS_PER_LEVEL = 2;
    // Классы. Здоровье у каждого считается по трём числам: база, за очко Выносливости, за уровень.
    // У воина числа те же, что были раньше: 30, 4 и 5.
    const CLASSES = {
      warrior: { name: "Воин", health: { base: 30, perEndurance: 4, perLevel: 5 } },
      mage:    { name: "Маг",  health: { base: 22, perEndurance: 3, perLevel: 4 } }
    };
    const MANA_PER_INTELLIGENCE = 4;
    // Заклинание мага. Урон = вилка заклинания + Интеллект. Цены и вилка примерные, настраиваются симуляцией.
    const SPELL = { name: "Магическая стрела", cost: 4, min: 4, max: 6, crit: 5, intMult: 3 };
    const BALANCE_MANA = { regen: 2 };
    // Книга заклинаний героя хранит ключи; сами заклинания лежат здесь. Пока одно, остальные добавим позже.
    const SPELLS = { arrow: SPELL };
    // Броня: очки брони зоны превращаются в долю срезаемого урона по формуле броня / (броня + K).
    // Формула не даёт 100% при любом числе очков и работает на любых уровнях; когда появятся высокие уровни, растёт K.
    const ARMOR_K = 20;
    const ARMOR_SLOTS = ["head", "chest", "legs", "boots"]; // порядок совпадает с ZONES: голова, корпус, пояс, ноги
    // Каждый следующий уровень требует примерно на 25% больше опыта: 30, 38, 47, 59, 73, 92…
    const xpToNext = level => Math.round(30 * Math.pow(1.25, level - 1));

    // Деньги хранятся одним целым числом в меди. 100 меди = 1 серебро, 100 серебра = 1 золото; показываются пересчётом.
    const COPPER_PER_SILVER = 100;
    const SILVER_PER_GOLD = 100;
    function formatMoney(copper) {
      const total = Math.max(0, Math.round(copper));
      const gold = Math.floor(total / (COPPER_PER_SILVER * SILVER_PER_GOLD));
      const silver = Math.floor(total / COPPER_PER_SILVER) % SILVER_PER_GOLD;
      const cop = total % COPPER_PER_SILVER;
      const parts = [];
      if (gold) parts.push(`${gold} зол.`);
      if (silver) parts.push(`${silver} сер.`);
      if (cop || parts.length === 0) parts.push(`${cop} мед.`);
      return parts.join(" ");
    }
    // Умения: герой хранит только ключи (изученные и выбранное в слоте), здесь цена, условия и описание.
    // scope: кому можно (any, класс mage или направление воина); rank: нужный ранг арены; cost: жетоны арены;
    // auto: "free" — автопилот применяет сам, "tactic" — только если так сказано в выбранной тактике.
    const SKILLS = {
      powerStrike: { name: "Мощный удар", scope: "damager", cooldown: 4, rank: 0, cost: 5, auto: "free",
                     description: "Твои удары в этом ходу наносят двойной урон." },
      arcaneBurst: { name: "Мощный заряд", scope: "mage", cooldown: 4, rank: 0, cost: 5, auto: "free",
                     description: "Заклинание бьёт вдвое сильнее за ту же ману." },
      stance:      { name: "Стойка", scope: "tank", cooldown: 6, rank: 0, cost: 5, auto: "free",
                     description: "Урон по тебе вдвое ниже в этом и двух следующих ходах." },
      evade:       { name: "Уклонение", scope: "evader", cooldown: 6, rank: 0, cost: 5, auto: "tactic",
                     description: "В этом ходу ни один удар врага тебя не задевает." },
      secondWind:  { name: "Второе дыхание", scope: "any", cooldown: 8, rank: 1, cost: 10, auto: "tactic",
                     description: "Лечит 25% максимального здоровья." }
    };
    // Тактики автопилота для защитных умений: healBelow — при какой доле здоровья он их применяет (0 — никогда).
    // "stop" с тем же порогом не применяет защиту сам, а останавливает авто, чтобы игрок решил сам.
    const TACTICS = [
      { key: "careful",    name: "Осторожно", healBelow: 0.4 },
      { key: "aggressive", name: "Агрессивно", healBelow: 0 },
      { key: "stop",       name: "Остановить на защите", healBelow: 0.4 }
    ];
    // Числа эффектов умений (сами умения описаны выше, применяются в playTurn).
    const SKILL_FX = { burstMult: 2, stanceFactor: 0.5, stanceTurns: 3, healShare: 0.25 };
    // Название выбранного пути героя: у мага это класс, у воина направление; null, если ещё не выбран.
    const pathNameOf = c => (c.classKey === "mage" ? CLASSES.mage.name : (c.direction ? DIRECTIONS[c.direction].name : null));
    const classOf = c => CLASSES[c.classKey] ?? CLASSES.warrior;
    const healthPerLevel = c => classOf(c).health.perLevel;
    const healthPerEndurance = c => classOf(c).health.perEndurance;
    const maxHealthOf = c => { const h = classOf(c).health; return h.base + h.perEndurance * statOf(c, "endurance") + h.perLevel * (c.level - 1) + bonusOf(c, "health"); };
    // Мана есть только у мага; Интеллект хранится у всех, но пока ничего не даёт воину.
    // Сопротивление магии: общий эффект Интеллекта для всех классов. Очки считаются линейно (1 за очко сверх стартовых),
    // а в уроне проходят ту же кривую x/(x+ARMOR_K), что и броня (reduceDamage в combat.js).
    const magicResistOf = c => Math.max(0, statOf(c, "intelligence") - BASE_STAT) + bonusOf(c, "magicResist");
    const maxManaOf = c => (c.classKey === "mage" ? MANA_PER_INTELLIGENCE * statOf(c, "intelligence") + bonusOf(c, "mana") : 0);

    // Единая кривая шанса (блок «Характеристики и боевая математика»). baseChance — шанс в процентах при нулевой разнице
    // между характеристикой и «анти-» характеристикой противника; diff — эта разница. Каждые k очков разницы удваивают
    // «шансы в пользу» (10% это 1 к 9). Считаем через логарифм: напрямую 2 ** (diff / k) при огромной разнице даёт
    // бесконечность и NaN. Шанс никогда не равен ровно 0 или 100, потолки не нужны. baseChance строго между 0 и 100.
    const CHANCE_K = 25;
    function chanceOf(baseChance, diff, k = CHANCE_K) {
      const z = Math.log(baseChance / (100 - baseChance)) + (diff / k) * Math.LN2;
      return 100 / (1 + Math.exp(-z));
    }

    // Ловкость: общая характеристика для всех классов. Считаются очки сверх стартовых (BASE_STAT).
    // Уворот и крит описаны ниже как пары: очки атакующего против очков или защиты цели.
    // Направление может давать Ловкость сверх очков (agilityBonus), она влияет и на уклонение, и на крит.
    const directionAgility = c => DIRECTIONS[c.direction]?.agilityBonus ?? 0;
    const agilityBonus = c => Math.max(0, statOf(c, "agility") - BASE_STAT) + directionAgility(c);
    // Уворот как пара «очки уворота защитника против меткости нападающего» (блок «Характеристики и боевая математика»).
    // Очки уворота: Ловкость сверх стартовой (с направлением) плюс бонусы вещей «Уклонение» (теперь очки, не проценты).
    // Шанс каждого удара считается в бою из разницы с меткостью нападающего (dodgeChance в combat.js).
    const DODGE_BASE = 5;
    const DODGE_K = 7;
    const dodgeRatingOf = c => agilityBonus(c) + bonusOf(c, "dodge");
    // Меткость: очки Внимания сверх стартовых; срезают очки уворота цели (см. dodgeChance в combat.js).
    const accuracyOf = c => Math.max(0, statOf(c, "attention") - BASE_STAT);

    // Крит как пара: очки крита атакующего (Ловкость + бонусы вещей) против защиты от крита цели (Выносливость).
    // Базой шанса служит крит оружия; пока только величины, в бой они подключаются отдельным куском.
    const CRIT_K = 8;
    const critRatingOf = c => agilityBonus(c) + bonusOf(c, "crit");
    const critResistOf = c => Math.max(0, statOf(c, "endurance") - BASE_STAT) + bonusOf(c, "critResist");

    // Пробивание брони (Сила): очки вычитаются из брони зоны перед кривой x/(x+ARMOR_K); только для физических ударов.
    const PENETRATION_PER_STRENGTH = 0.5;
    const penetrationOf = c => Math.max(0, statOf(c, "strength") - BASE_STAT) * PENETRATION_PER_STRENGTH + bonusOf(c, "penetration");

    // Очки характеристик врага сверх стартовых: бюджет растёт медленнее героя (ENEMY_GROWTH от его темпа), traits делит его по характерам.
    // Временно 0,5, а не задуманные 0,8: при 0,8 на высоких уровнях рейтинги врага (рост линейный, шансы экспоненциальные) ломают бои, см. GDD v0.98.
    const ENEMY_GROWTH = 0.5;
    function enemyPoints(level, traits) {
      const budget = POINTS_PER_LEVEL * (Math.max(1, level) - 1) * ENEMY_GROWTH;
      const points = {};
      for (const stat in traits) points[stat] = budget * traits[stat];
      return points;
    }

    // Шанс «заметить ещё» (Внимание): база + NOTICE.max × x / (x + k), x — очки сверх стартовых.
    // Очки дают не больше base + max (около 25%): лишняя находка должна быть приятной редкостью.
    // Общий потолок 30% с учётом вещей добавим вместе с первой вещью, которая даёт этот бонус.
    const NOTICE = { base: 5, max: 20, k: 12 };
    const noticeChanceOf = c => {
      const x = Math.max(0, statOf(c, "attention") - BASE_STAT);
      return Math.round(NOTICE.base + NOTICE.max * x / (x + NOTICE.k));
    };
    // Бдительность (Внимание): шанс заметить опасность заранее — признаки у лагеря, врага в переходе.
    // Растёт так же, как «заметить ещё», но выше и до ~60%.
    const WATCH = { base: 20, max: 40, k: 12 };
    const watchChanceOf = c => {
      const x = Math.max(0, statOf(c, "attention") - BASE_STAT);
      return Math.round(WATCH.base + WATCH.max * x / (x + WATCH.k));
    };
    // Лагерь: заметил признаки — шанс ночного нападения умножается на signsFactor; нападение на спящего бьёт сильнее.
    const CAMP = { signsFactor: 0.2, nightDmgBonus: 1.2 };
    // Пройти замеченного врага незамеченным: решает Ловкость (очки сверх стартовых с вещами и направлением).
    // Провал — бой, враг бьёт сильнее на failDmgBonus.
    const SNEAK = { base: 25, max: 45, k: 15, failDmgBonus: 1.2 };
    const sneakChanceOf = c => {
      const x = agilityBonus(c);
      return Math.round(SNEAK.base + SNEAK.max * x / (x + SNEAK.k));
    };

    // Кулаки: удар без оружия.
    const FISTS = { dmg: [0, 1], crit: 5 };
    // Баланс оружия: Сила прибавляется к каждому удару, поэтому два одноручных оружия получают её дважды.
    // Двуручное делает один удар, и чтобы не проигрывать, берёт Силу с множителем.
    const BALANCE = { twoHandStrength: 4 };

    // Предметы. type: food / weapon1h (одноручное) / weapon2h (двуручное) / shield.
    // Критический удар проходит сквозь блок. По незаблокированной зоне он бьёт в CRIT_MULTIPLIER раза сильнее,
    // по заблокированной — как обычный удар (блок гасит усиление, но не сам удар).
    // dmg — вилка прибавки к урону удара этой рукой [от, до], crit — шанс критического удара в процентах,
    // blocks — сколько блоков добавляет щит. Урон удара = Сила + случайное число из вилки; критический удар бьёт вдвое сильнее.
    const CRIT_MULTIPLIER = 2; // базовая сила крита: удар по открытой зоне бьёт вдвое сильнее; бонусы снаряжения «Сила крита» её увеличивают
    const ENEMY_CRIT = 5;
    // price — цена покупки в меди (у трофеев вместо неё value — за сколько их покупает магазин).
    // Все трофеи пока просто трофеи; что из них станет ингредиентом, решим вместе с профессиями.
    // Характер материала брони: постоянный бонус к характеристике, одинаковый у всех вещей материала.
    // stats — характеристики материала, у каждой свой размер бонуса по месту вещи (поле slot у вещи); нагрудник даёт больше остальных. Числа примерные.
    const MATERIALS = {
      cloth:   { name: "Ткань",  stats: { intelligence: { chest: 2, head: 1, legs: 1, boots: 1 } } },
      leather: { name: "Кожа",   stats: { agility:      { chest: 2, head: 1, legs: 1, boots: 1 } } },
      iron:    { name: "Железо", stats: { endurance:    { chest: 2, head: 1, legs: 1, boots: 1 } } },
      steel:   { name: "Сталь",  stats: { endurance:    { chest: 3, head: 2, legs: 2, boots: 2 } } },
      mail:    { name: "Кольчуга", stats: { agility:      { chest: 3, head: 2, legs: 2, boots: 2 } } },
      silk:    { name: "Шёлк",   stats: { intelligence: { chest: 3, head: 2, legs: 2, boots: 2 }, endurance: { chest: 3, head: 2, legs: 2, boots: 2 } } }, // Выносливость нужна, чтобы маг в ткани не проигрывал магу в стали: проверено симуляцией
      meteorite: { name: "Метеоритное железо", stats: { strength: { chest: 4, head: 3, legs: 3, boots: 3 } } },
      crystal: { name: "Кристалл", stats: { endurance: { chest: 4, head: 3, legs: 3, boots: 3 }, magicResist: { chest: 3, head: 2, legs: 2, boots: 2 } } },
      elven:   { name: "Эльфийская работа", stats: { agility: { chest: 4, head: 3, legs: 3, boots: 3 }, attention: { chest: 2, head: 1, legs: 1, boots: 1 } } },
      velvet:  { name: "Бархат", stats: { intelligence: { chest: 4, head: 3, legs: 3, boots: 3 }, endurance: { chest: 4, head: 3, legs: 3, boots: 3 }, mana: { chest: 4, head: 2, legs: 2, boots: 2 } } }
    };
    const ITEMS = {
      gladRation:   { name: "Паёк гладиатора", type: "food",   heal: 40,  price: 20,  description: "Восстанавливает 40 здоровья" },
      bread:        { name: "Хлеб",           type: "food",     heal: 15,  price: 10,  description: "Восстанавливает 15 здоровья" },
      knife:        { name: "Нож",            type: "weapon1h", dmg: [2, 4],   crit: 15, shape: "knife",   price: 60,   description: "Лёгкое оружие: +2…4 к урону, шанс крита 15%" },
      sword:        { name: "Меч",            type: "weapon1h", dmg: [4, 6],   crit: 8,  shape: "sword",   price: 150,  description: "Одноручное оружие: +4…6 к урону, шанс крита 8%" },
      axe:          { name: "Боевой топор",   type: "weapon2h", dmg: [10, 16], crit: 10, shape: "axe",     price: 300,  description: `Двуручное оружие: +10…16 к урону, шанс крита 10%, Сила в ударе ×${BALANCE.twoHandStrength}. Занимает обе руки: блок остаётся один` },
      staff:        { name: "Посох",         type: "staff",    dmg: [3, 5],   crit: 5,  blocks: 1, shape: "staff", price: 150, description: "Посох мага: +1 блок. Без маны им можно слабо ударить" },
      greatStaff:   { name: "Посох мудреца",  type: "staff",    dmg: [5, 7],   crit: 8,  blocks: 1, spellBonus: 3, shape: "staff", price: 700, description: "Посох мага: +1 блок и +3 к урону заклинаний" },
      buckler:      { name: "Баклер",         type: "shield",   blocks: 1, shape: "buckler", price: 80,   description: "Малый щит: +1 блок" },
      woodenShield: { name: "Деревянный щит", type: "shield",   blocks: 2, shape: "shield",  price: 120,  description: "Щит: +2 блока" },
      steelSword:   { name: "Стальной меч",   type: "weapon1h", dmg: [7, 10],  crit: 10, shape: "sword",   price: 700,  description: "Одноручное оружие: +7…10 к урону, шанс крита 10%" },
      steelKnife:   { name: "Стальной кинжал", type: "weapon1h", dmg: [4, 6],  crit: 18, shape: "knife",   price: 350,  description: "Лёгкое оружие: +4…6 к урону, шанс крита 18%" },
      greatAxe:     { name: "Секира",         type: "weapon2h", dmg: [16, 22], crit: 12, shape: "axe",     price: 1000, description: `Двуручное оружие: +16…22 к урону, шанс крита 12%, Сила в ударе ×${BALANCE.twoHandStrength}. Занимает обе руки` },
      flint:        { name: "Огниво",        type: "tool",     shape: "fire", color: "#ff9f5a", price: 40, description: "Нужно, чтобы развести костёр и разбить лагерь. Не расходуется" },
      bedroll:      { name: "Спальник",      type: "tool",     shape: "bed",  color: "#8fb3d9", price: 90, description: "Нужен, чтобы отдохнуть в лагере. Не расходуется" },
      dogFang:      { name: "Собачий клык",   type: "trophy",   value: 6,  description: "Трофей-материал, магазин купит за 6м" },
      boarTusk:     { name: "Клык кабана",    type: "trophy",   value: 30, description: "Трофей-материал, магазин купит за 30м" },
      wolfPelt:     { name: "Волчья шкура",   type: "trophy",   value: 20, description: "Трофей-материал, магазин купит за 20м" },
      leaderFang:   { name: "Клык вожака",    type: "trophy",   value: 150, rarity: "uncommon", shape: "fang", description: "Редкий трофей-материал, магазин купит за 1с 50м" },
      amber:        { name: "Кусок янтаря",   type: "trophy",   value: 120, rarity: "uncommon", shape: "gem", color: "#e8a93a", description: "Редкая находка, магазин купит за 1с 20м" },
      oldRing:      { name: "Старинный перстень", type: "trophy", value: 250, rarity: "rare", shape: "gem", color: "#d9c36a", description: "Очень редкая находка, магазин купит за 2с 50м" },
      goldNugget:   { name: "Золотой самородок", type: "trophy", value: 400, rarity: "rare", shape: "gem", color: "#f0c040", description: "Очень редкая находка, магазин купит за 4с" },
      leatherCap:     { name: "Кожаная шапка",   type: "armor", slot: "head",  material: "leather", armor: 2, color: "#7a5230", price: 50,  description: "Броня головы +2" },
      leatherJerkin:  { name: "Кожаная куртка",  type: "armor", slot: "chest", material: "leather", armor: 4, color: "#7a5230", price: 120, description: "Броня корпуса +4" },
      leatherPants:   { name: "Кожаные штаны",   type: "armor", slot: "legs",  material: "leather", armor: 2, color: "#7a5230", price: 70,  description: "Броня пояса +2" },
      leatherBoots:   { name: "Кожаные сапоги",  type: "armor", slot: "boots", material: "leather", armor: 2, color: "#5a3d1e", price: 70,  description: "Броня ног +2" },
      ironHelm:       { name: "Железный шлем",   type: "armor", slot: "head",  material: "iron", shape: "helm", armor: 4, color: "#8a93a3", price: 350, description: "Броня головы +4" },
      chainmail:      { name: "Железный нагрудник",        type: "armor", slot: "chest", material: "iron", armor: 8, color: "#8a93a3", price: 800, description: "Броня корпуса +8" }, // ключ остался от прежнего названия «Кольчуга»: на него ссылаются сохранения
      ironGreaves:    { name: "Железные поножи", type: "armor", slot: "legs",  material: "iron", armor: 4, color: "#8a93a3", price: 400, description: "Броня пояса +4" },
      ironBoots:      { name: "Железные сапоги", type: "armor", slot: "boots", material: "iron", armor: 4, color: "#6f7889", price: 350, description: "Броня ног +4" }
    };

    // Ассортимент магазина по уровню героя: базовые вещи на уровень. Лучшее снаряжение здесь не продаётся:
    // его будут давать призы арены, подземелья и ремесло.
    const SHOP_STOCK = [
      { minLevel: 1, items: ["bread", "flint", "bedroll", "knife", "sword", "axe", "staff", "buckler", "woodenShield", "leatherCap", "leatherJerkin", "leatherPants", "leatherBoots"] },
      { minLevel: 5, items: ["steelKnife", "steelSword", "greatAxe", "greatStaff", "ironHelm", "chainmail", "ironGreaves", "ironBoots"] }
    ];
    const SELL_RATE = 0.4; // магазин покупает снаряжение за 40% цены

    // Места для снаряжения. Работают руки и броня четырёх зон (шлем — голова, доспех — корпус, штаны — пояс, сапоги — ноги).
    // Амулет и кольца заложены заранее.
    const SLOTS = [
      { key: "mainHand", name: "Основная рука", active: true },
      { key: "offHand",  name: "Вторая рука",   active: true },
      { key: "head",     name: "Шлем (голова)",   active: true },
      { key: "chest",    name: "Доспех (корпус)", active: true },
      { key: "legs",     name: "Штаны (пояс)",    active: true },
      { key: "boots",    name: "Сапоги (ноги)",   active: true },
      { key: "amulet",   name: "Амулет",        active: false },
      { key: "ring1",    name: "Кольцо 1",      active: false },
      { key: "ring2",    name: "Кольцо 2",      active: false }
    ];

    // Готовые наборы: для противников и для тренировочного боя.
    const PRESETS = {
      none:         { label: "Без снаряжения",   equipment: {} },
      weapon:       { label: "Одно оружие",      equipment: { mainHand: "sword" } },
      weaponShield: { label: "Оружие и щит",     equipment: { mainHand: "sword", offHand: "woodenShield" } },
      twoWeapons:   { label: "Два оружия",       equipment: { mainHand: "sword", offHand: "sword" } },
      shield:       { label: "Щит без оружия (допущение)", equipment: { offHand: "woodenShield" } },
      twoHanded:    { label: "Двуручный топор",  equipment: { mainHand: "axe" } },
      armored:      { label: "Меч, щит и кожаная броня", equipment: { mainHand: "sword", offHand: "woodenShield", head: "leatherCap", chest: "leatherJerkin", legs: "leatherPants", boots: "leatherBoots" } }
    };

    // Направления воина. Выбираются у учителя в столице. Бонусы пока простые: позже направления получат свои умения.
    // armorBonus прибавляется к броне каждой зоны, damageBonus — к урону каждого удара.
    const DIRECTIONS = {
      tank:    { name: "Воин-танк",    armorBonus: 3, damageBonus: 0,
                 description: "+3 брони на каждую зону тела. Держит удары: ему подходят щит и тяжёлая броня." },
      damager: { name: "Воин-дамагер", armorBonus: 0, damageBonus: 3,
                 description: "+3 к урону каждого удара. Бьёт сильно: ему подходят два клинка (два удара за ход)." },
      evader:  { name: "Воин-уворот",  armorBonus: 0, damageBonus: 0, agilityBonus: 3,
                 description: "+3 к Ловкости: чаще уклоняется и чаще бьёт критом. Ему подходят лёгкое оружие и подвижный бой." }
    };

    // Здания на площади столицы. ready: false — здание ещё строится, в него нельзя зайти.
    const BUILDINGS = [
      { key: "arena",   name: "Арена",          icon: "arena",   description: "Бои за опыт, деньги и ранг", ready: true },
      { key: "teacher", name: "Учитель воинов", icon: "teacher", description: "Выбор направления воина", ready: true },
      { key: "shop",    name: "Магазин",        icon: "shop",    description: "Снаряжение и трофеи: покупка и продажа", ready: true },
      { key: "tavern",  name: "Таверна",        icon: "tavern",  description: "Мгновенный отдых за деньги", ready: true },
      { key: "gate",    name: "Городские ворота", icon: "gate", description: "Вылазка за стены: лес, добыча, открытия", ready: true }
    ];

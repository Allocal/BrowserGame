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
    const SPELL = { name: "Магическая стрела", cost: 4, min: 4, max: 6, crit: 5, intMult: 1.5 };
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
      if (gold) parts.push(`${gold}з`);
      if (silver) parts.push(`${silver}с`);
      if (cop || parts.length === 0) parts.push(`${cop}м`);
      return parts.join(" ");
    }
    // Название выбранного пути героя: у мага это класс, у воина направление; null, если ещё не выбран.
    const pathNameOf = c => (c.classKey === "mage" ? CLASSES.mage.name : (c.direction ? DIRECTIONS[c.direction].name : null));
    const classOf = c => CLASSES[c.classKey] ?? CLASSES.warrior;
    const healthPerLevel = c => classOf(c).health.perLevel;
    const healthPerEndurance = c => classOf(c).health.perEndurance;
    const maxHealthOf = c => { const h = classOf(c).health; return h.base + h.perEndurance * statOf(c, "endurance") + h.perLevel * (c.level - 1) + bonusOf(c, "health"); };
    // Мана есть только у мага; Интеллект хранится у всех, но пока ничего не даёт воину.
    // Сопротивление магии: общий эффект Интеллекта для всех классов, считается по той же кривой, что и броня.
    const magicResistOf = c => Math.max(0, statOf(c, "intelligence") - BASE_STAT) + bonusOf(c, "magicResist");
    const maxManaOf = c => (c.classKey === "mage" ? MANA_PER_INTELLIGENCE * statOf(c, "intelligence") + bonusOf(c, "mana") : 0);

    // Ловкость: общая характеристика для всех классов. Считаются очки сверх стартовых (BASE_STAT).
    // Уклонение = 100 × x / (x + DODGE_K), как и броня, не доходит до 100%. Крит растёт на CRIT_PER_AGILITY процента за очко.
    const DODGE_K = 35;
    const CRIT_PER_AGILITY = 0.8;
    // Направление может давать Ловкость сверх очков (agilityBonus), она влияет и на уклонение, и на крит.
    const directionAgility = c => DIRECTIONS[c.direction]?.agilityBonus ?? 0;
    const agilityBonus = c => Math.max(0, statOf(c, "agility") - BASE_STAT) + directionAgility(c);
    // Верхняя граница уклонения: формула сама до 100% не доходит, но плоские бонусы снаряжения складываются поверх неё.
    // Без границы можно было бы набрать неуязвимость, поэтому выше этого значения уклонение не растёт.
    const DODGE_CAP = 75;
    const dodgeOf = c => Math.min(DODGE_CAP, Math.round((100 * agilityBonus(c) / (agilityBonus(c) + DODGE_K) + bonusOf(c, "dodge")) * 10) / 10);

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
    const critBonusOf = c => Math.round((agilityBonus(c) * CRIT_PER_AGILITY + bonusOf(c, "crit")) * 10) / 10;

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
    // Верхняя граница шанса крита. Крит пробивает блок, поэтому при очень высоком шансе блоки теряют смысл.
    const CRIT_CAP = 60;
    const ENEMY_CRIT = 5;
    // price — цена покупки в меди (у трофеев вместо неё value — за сколько их покупает магазин).
    // material: true — трофей-ингредиент: позже из таких вещей можно будет делать снаряжение.
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
      dogFang:      { name: "Собачий клык",   type: "trophy",   value: 6,  material: true, description: "Трофей-материал, магазин купит за 6м" },
      boarTusk:     { name: "Клык кабана",    type: "trophy",   value: 30, material: true, description: "Трофей-материал, магазин купит за 30м" },
      wolfPelt:     { name: "Волчья шкура",   type: "trophy",   value: 20, material: true, description: "Трофей-материал, магазин купит за 20м" },
      leaderFang:   { name: "Клык вожака",    type: "trophy",   value: 150, material: true, rarity: "uncommon", shape: "fang", description: "Редкий трофей-материал, магазин купит за 1с 50м" },
      amber:        { name: "Кусок янтаря",   type: "trophy",   value: 120, rarity: "uncommon", shape: "gem", color: "#e8a93a", description: "Редкая находка, магазин купит за 1с 20м" },
      oldRing:      { name: "Старинный перстень", type: "trophy", value: 250, rarity: "rare", shape: "gem", color: "#d9c36a", description: "Очень редкая находка, магазин купит за 2с 50м" },
      goldNugget:   { name: "Золотой самородок", type: "trophy", value: 400, rarity: "rare", shape: "gem", color: "#f0c040", description: "Очень редкая находка, магазин купит за 4с" },
      leatherCap:     { name: "Кожаная шапка",   type: "armor", slot: "head",  armor: 2, color: "#7a5230", price: 50,  description: "Броня головы +2" },
      leatherJerkin:  { name: "Кожаная куртка",  type: "armor", slot: "chest", armor: 4, color: "#7a5230", price: 120, description: "Броня корпуса +4" },
      leatherPants:   { name: "Кожаные штаны",   type: "armor", slot: "legs",  armor: 2, color: "#7a5230", price: 70,  description: "Броня пояса +2" },
      leatherBoots:   { name: "Кожаные сапоги",  type: "armor", slot: "boots", armor: 2, color: "#5a3d1e", price: 70,  description: "Броня ног +2" },
      ironHelm:       { name: "Железный шлем",   type: "armor", slot: "head",  armor: 4, color: "#8a93a3", price: 350, description: "Броня головы +4" },
      chainmail:      { name: "Кольчуга",        type: "armor", slot: "chest", armor: 8, color: "#8a93a3", price: 800, description: "Броня корпуса +8" },
      ironGreaves:    { name: "Железные поножи", type: "armor", slot: "legs",  armor: 4, color: "#8a93a3", price: 400, description: "Броня пояса +4" },
      ironBoots:      { name: "Железные сапоги", type: "armor", slot: "boots", armor: 4, color: "#6f7889", price: 350, description: "Броня ног +4" }
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

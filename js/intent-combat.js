    // ======================= БОЙ ПО НАМЕРЕНИЯМ (прототип, только волк; старый бой в combat.js не затронут) =======================
    // Приёмы врагов. kind — тип, по которому герой выбирает ответ; power — сила одного удара относительно обычного удара врага;
    // hits — сколько ударов за ход (увёртка не бьёт).
    const MOVES = {
      flurry: { name: "Быстрая серия",  kind: "fast",    power: 0.5, hits: 3 },
      pounce: { name: "Тяжёлый прыжок", kind: "heavy",   power: 1.8, hits: 1 },
      feint:  { name: "Увёртка и контрудар", kind: "evasive", power: 0.9, hits: 1 }
    };

    // Какие приёмы есть у вида и с какими весами враг их выбирает (чем больше вес, тем чаще).
    const MONSTER_MOVES = {
      wolf: { flurry: 5, pounce: 3, feint: 2 }
    };

    // Ручки баланса нового боя: множители урона героя и врага. Бой по намерениям должен идти дольше старого, иначе решать нечего.
    const INTENT_TUNING = { heroDamage: 0.4, enemyDamage: 0.4 };

    // Приём врага на этот ход: рулетка по весам. Прошлые ходы не учитываются: серии одинаковых приёмов такая же случайность, как серия уворотов.
    function pickMove(monsterKind) {
      const table = MONSTER_MOVES[monsterKind];
      const keys = Object.keys(table);
      return keys[weightedIndex(keys.map(key => table[key]))];
    }

    // Умения мага как ответы на приём. role — роль слота; delivery — способ доставки (bolt: от него можно увернуться,
    // self: действует на себя, effect: накладывается, проверка сопротивления вместо уворота); cost — мана;
    // vs — что происходит против каждого типа приёма: take — доля входящего урона, deal — доля своего удара.
    const INTENT_SKILLS = {
      frostBolt: { name: "Ледяная стрела", role: "attack",  delivery: "bolt",   cost: 4, cooldown: 0,
        hint: "Бьёт в полную силу. Мимо, если враг уходит от удара.",
        vs: { fast: { take: 1.0, deal: 1 }, heavy: { take: 1.0, deal: 1 }, evasive: { take: 1.0, deal: 0 } } },
      barrier:   { name: "Барьер",         role: "defense", delivery: "self",   cost: 3, cooldown: 0,
        hint: "Почти гасит один тяжёлый удар и контрудар, серию слабо. Бьёт слабо.",
        vs: { fast: { take: 0.8, deal: 0.4 }, heavy: { take: 0.1, deal: 0.4 }, evasive: { take: 0.2, deal: 0 } } },
      timidity:  { name: "Робость",        role: "control", delivery: "effect", cost: 8, cooldown: 4,
        hint: "Враг слабее бьёт 3 хода. Сам ход ты не бьёшь.",
        vs: { fast: { take: 1.0, deal: 0 }, heavy: { take: 1.0, deal: 0 }, evasive: { take: 1.0, deal: 0 } },
        effect: { weaken: 0.7, turns: 3 } },
      // Запасное умение: доступно только когда ни на одно заклинание не хватает маны (иначе бой с пустой маной встал бы).
      staffHit:  { name: "Удар посохом",   role: "fallback", delivery: "bolt",  cost: 0, cooldown: 0,
        hint: "Слабый удар без маны. Доступен, только когда маны не хватает.",
        vs: { fast: { take: 1.0, deal: 0.25 }, heavy: { take: 1.0, deal: 0.25 }, evasive: { take: 1.0, deal: 0 } } }
    };

    // Средняя броня героя по четырём зонам: в бою по намерениям зон нет, поэтому броня считается одной цифрой.
    const meanArmor = c => c.gear.armor.reduce((a, b) => a + b, 0) / c.gear.armor.length;

    // Что враг делает герою за ход: приём game.move, ответ героя answerKey. Возвращает удары и общий урон.
    // Урон по герою считаем сразу, но здоровье меняет вызывающий код: так проще проверять расчёт отдельно от боя.
    function resolveEnemyMove(game, answerKey) {
      const move = MOVES[game.move];
      const answer = INTENT_SKILLS[answerKey].vs[move.kind];
      const weaken = game.weakenTurns > 0 ? game.weakenFactor : 1;
      const profile = game.bot.strikeDamages[0];
      const hits = Array.from({ length: move.hits }, () => {
        const crit = Math.random() * 100 < critChance(profile, game.bot, game.player);
        const dodged = Math.random() * 100 < dodgeChance(game.player, game.bot);
        // Крит пробивает защиту: срез ответа (take) к нему не применяется (решение по умолчанию, см. документ).
        const raw = randInt(profile.min, profile.max) * INTENT_TUNING.enemyDamage * move.power * weaken * (crit ? (profile.critMult ?? CRIT_MULTIPLIER) : answer.take);
        return { crit, dodged, damage: dodged ? 0 : reduceDamage(Math.round(raw), meanArmor(game.player)) };
      });
      return { hits, total: hits.reduce((sum, h) => sum + h.damage, 0) };
    }

    // Шанс, что воздействие (например, «Робость») сработало: база и крутизна кривой, сдвиг даёт разница Интеллекта мага и сопротивления цели.
    // Числа черновые, настраиваются симуляцией.
    const EFFECT_BASE = 70;
    const EFFECT_K = 8;

    // Что делает герой за ход: умение skillKey против приёма game.move. Возвращает свой удар и то, сработало ли воздействие.
    // Здоровье, ману и перезарядку, как и в resolveEnemyMove, меняет вызывающий код.
    function resolveHeroAction(game, skillKey) {
      const skill = INTENT_SKILLS[skillKey];
      const answer = skill.vs[MOVES[game.move].kind];
      const result = { damage: 0, crit: false, dodged: false, effectApplied: false };
      if (answer.deal > 0) {
        const profile = game.player.spellDamage;
        result.crit = Math.random() * 100 < critChance(profile, game.player, game.bot);
        result.dodged = Math.random() * 100 < dodgeChance(game.bot, game.player);
        const raw = randInt(profile.min, profile.max) * INTENT_TUNING.heroDamage * (result.crit ? (profile.critMult ?? CRIT_MULTIPLIER) : 1) * answer.deal;
        result.damage = result.dodged ? 0 : reduceDamage(Math.round(raw), game.bot.magicResist ?? 0);
      }
      if (skill.effect) {
        const power = Math.max(0, game.player.intelligence - BASE_STAT);
        result.effectApplied = Math.random() * 100 < chanceOf(EFFECT_BASE, power - (game.bot.magicResist ?? 0), EFFECT_K);
      }
      return result;
    }

    // Новый бой по намерениям. move — приём врага на текущий ход (его видно игроку, насколько позволяет знание);
    // weakenTurns и weakenFactor — действующая «Робость»; cooldowns — сколько ходов ещё недоступно каждое умение.
    function createIntentGame(player, bot, monsterKind) {
      player.mana = player.startMana ?? player.maxMana ?? 0; // как в старом бое: полная мана, кроме вылазки
      return { player, bot, monsterKind, move: pickMove(monsterKind), weakenTurns: 0, weakenFactor: 1, cooldowns: {}, turn: 0 };
    }

    // Можно ли применить умение: оно не на перезарядке и хватает маны.
    const skillReadyNow = (game, skillKey) =>
      (game.cooldowns[skillKey] ?? 0) === 0 && game.player.mana >= INTENT_SKILLS[skillKey].cost;
    const canUseSkill = (game, skillKey) => INTENT_SKILLS[skillKey].role === "fallback"
      ? !Object.keys(INTENT_SKILLS).some(key => INTENT_SKILLS[key].role !== "fallback" && skillReadyNow(game, key))
      : skillReadyNow(game, skillKey);

    // Один ход: герой применяет умение, враг делает свой приём. Оба результата считаются до применения урона,
    // поэтому упавший за ход враг всё равно успевает ударить (как в старом бое: оба ходят одновременно).
    function playIntentTurn(game, skillKey) {
      const skill = INTENT_SKILLS[skillKey];
      const movePlayed = game.move;
      const hero = resolveHeroAction(game, skillKey);
      const enemy = resolveEnemyMove(game, skillKey);

      game.bot.health = Math.max(0, game.bot.health - hero.damage);
      game.player.health = Math.max(0, game.player.health - enemy.total);

      // Мана: цена умения, затем немного возвращается каждый ход (BALANCE_MANA из data.js).
      game.player.mana = Math.min(game.player.maxMana, game.player.mana - skill.cost + BALANCE_MANA.regen);

      // Перезарядки: применённое умение уходит на перезарядку, остальные приближаются к готовности.
      for (const key of Object.keys(INTENT_SKILLS)) {
        game.cooldowns[key] = key === skillKey ? skill.cooldown : Math.max(0, (game.cooldowns[key] ?? 0) - 1);
      }

      // Ослабление: сначала отсчитываем ход уже действующего, затем накладываем новое (оно начнёт действовать со следующего хода).
      if (game.weakenTurns > 0) game.weakenTurns -= 1;
      if (hero.effectApplied) {
        game.weakenTurns = skill.effect.turns;
        game.weakenFactor = skill.effect.weaken;
      }

      game.turn += 1;
      const outcome = getOutcome(game);
      if (!outcome) game.move = pickMove(game.monsterKind); // приём на следующий ход
      return { movePlayed, hero, enemy, outcome };
    }

    // Знание о врагах: три счётчика очков. species: по виду (волки), family: по семейству (звери), general: общий навык.
    // Каждая победа добавляет по очку во все три; при чтении они складываются с весами: вид действует полностью, семейство слабее, общий навык ещё слабее.
    // ENEMY_INFO: к какому семейству относится вид и насколько он сложен для чтения (чем больше, тем выше ступень нужна, чтобы его читать).
    const ENEMY_INFO = {
      wolf: { family: "beast", difficulty: 1 }
    };
    const KNOWLEDGE_WEIGHTS = { species: 1, family: 0.3, general: 0.1 };
    const KNOWLEDGE_MAX = 10;
    const KIND_HINTS = { fast: "Готовит быстрые удары", heavy: "Готовит тяжёлый удар", evasive: "Готовится увернуться" };

    // Сколько очков нужно для ступени n: растёт квадратично, поэтому от 9-й к 10-й путь намного длиннее, чем от 0-й к 1-й (числа черновые).
    const knowledgeCost = n => Math.round(2 * n * n);

    // Очки знания против врага этого вида: три счётчика с весами.
    function knowledgePoints(knowledge, monsterKind) {
      const family = ENEMY_INFO[monsterKind].family;
      return (knowledge.species[monsterKind] ?? 0) * KNOWLEDGE_WEIGHTS.species
        + (knowledge.family[family] ?? 0) * KNOWLEDGE_WEIGHTS.family
        + knowledge.general * KNOWLEDGE_WEIGHTS.general;
    }

    // Ступень (0–10) и прогресс к следующей в процентах.
    function knowledgeRank(knowledge, monsterKind) {
      const points = knowledgePoints(knowledge, monsterKind);
      let rank = 0;
      while (rank < KNOWLEDGE_MAX && points >= knowledgeCost(rank + 1)) rank += 1;
      if (rank === KNOWLEDGE_MAX) return { rank, percent: 100 };
      const from = knowledgeCost(rank);
      const percent = Math.floor((points - from) / (knowledgeCost(rank + 1) - from) * 100);
      return { rank, percent };
    }

    // Что игрок видит о приёмах: 0 только намёк, 1 тип приёма, 2 сам приём. Зависит от ступени знания и сложности вида.
    function knowledgeStep(knowledge, monsterKind) {
      const { rank } = knowledgeRank(knowledge, monsterKind);
      return Math.max(0, Math.min(2, rank - ENEMY_INFO[monsterKind].difficulty + 1));
    }

    // Что игрок видит о приёме врага на этой ступени: на 0 только намёк, на 1 тип приёма, на 2 сам приём.
    function intentHint(step, moveKey) {
      const move = MOVES[moveKey];
      if (step >= 2) return move.name;
      if (step === 1) return KIND_HINTS[move.kind];
      return "Что-то задумал…";
    }

    // Победа над врагом добавляет очко во все три счётчика.
    function recordKnowledge(knowledge, monsterKind) {
      const family = ENEMY_INFO[monsterKind].family;
      knowledge.species[monsterKind] = (knowledge.species[monsterKind] ?? 0) + 1;
      knowledge.family[family] = (knowledge.family[family] ?? 0) + 1;
      knowledge.general += 1;
    }

    // Знание из сохранения: только известные виды и семейства, целые неотрицательные числа. Старый формат { wolf: 3 } (победы по виду)
    // переносится в вид, семейство и общий навык, как если бы эти победы шли по новым правилам.
    function cleanKnowledge(raw) {
      const num = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
      const out = { species: {}, family: {}, general: num(raw?.general) };
      const families = Object.values(ENEMY_INFO).map(info => info.family);
      for (const kind in ENEMY_INFO) {
        const n = num(raw?.species?.[kind]);
        if (n) out.species[kind] = n;
        const old = raw && !raw.species ? num(raw[kind]) : 0; // старый формат
        if (old) {
          out.species[kind] = old;
          out.family[ENEMY_INFO[kind].family] = (out.family[ENEMY_INFO[kind].family] ?? 0) + old;
          out.general += old;
        }
      }
      for (const family of families) {
        const n = num(raw?.family?.[family]);
        if (n) out.family[family] = n;
      }
      return out;
    }

    // Автопилот боя по намерениям. Знает о враге ровно то, что знает герой (ступень step): вслепую просто бьёт, а при знании типа
    // приёма отвечает на него. noise — доля ошибочных ходов: хороший игрок вручную немного лучше (числа черновые).
    const INTENT_AUTO = { noise: 0.1, lowHealth: 0.3 };
    function autoPickSkill(game, step) {
      const usable = Object.keys(INTENT_SKILLS).filter(key => canUseSkill(game, key));
      if (usable.length === 0) return null;
      if (Math.random() < INTENT_AUTO.noise) return usable[Math.floor(Math.random() * usable.length)];
      const prefer = key => (usable.includes(key) ? key : usable[0]);
      if (game.player.health / game.player.maxHealth < INTENT_AUTO.lowHealth) return prefer("barrier");
      if (step >= 1 && MOVES[game.move].kind !== "fast") return prefer("barrier");
      return prefer("frostBolt");
    }

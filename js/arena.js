    // ----- Арена -----
    // Соперников арены создаёт генератор, поэтому арена работает на любом уровне героя.
    // Вилка урона для уровней 1…10 взята из таблицы, подобранной симуляцией (герой того же уровня со стартовым снаряжением
    // выигрывает примерно в 90% → 65% случаев при случайной игре); выше 10 урон растёт линейно, и это ещё не проверено.
    // Здоровье и броня считаются из уровня по формулам в arenaEnemyDef.
    const ARENA_DMG = [null, [7, 9], [8, 10], [8, 10], [10, 12], [12, 14], [12, 14], [12, 14], [15, 17], [15, 17], [15, 17]];
    const ARENA_NAME_FIRST = ["Грозный", "Хромой", "Седой", "Рыжий", "Мрачный", "Быстрый", "Одноглазый", "Весёлый", "Железный", "Молчаливый"];
    const ARENA_NAME_SECOND = ["Бран", "Горт", "Рольф", "Ксанд", "Мирон", "Торвальд", "Дейн", "Освальд", "Харт", "Вальд"];

    // Характеристики бойца арены заданного уровня (без имени).
    function arenaFighterStats(level) {
      const L = Math.max(1, Math.round(level));
      let dmg;
      if (L <= 10) dmg = ARENA_DMG[L];
      else { const mid = Math.round(16 + 0.9 * (L - 10)); dmg = [mid - 1, mid + 1]; }
      const gear = (L === 5 || L === 8 || (L > 10 && L % 3 === 2)) ? "weaponShield" : "twoWeapons";
      return { level: L, gear, dmg };
    }

    function generateFighter(level) {
      const pick = list => list[Math.floor(Math.random() * list.length)];
      return { name: `${pick(ARENA_NAME_FIRST)} ${pick(ARENA_NAME_SECOND)}`, ...arenaFighterStats(level) };
    }

    // Категории соперников: уровень соперника = уровень героя + случайное число от min до max; cost — билетов за бой за ранг.
    // Верхняя граница выбрана по симуляции: с соперником на +6 уровней герой выигрывает лишь в 10–35% боёв. Нижняя граница
    // категорий не уходит глубоко вниз, потому что слишком слабый соперник почти ничего не даёт. Числа примерные.
    const ARENA_CATEGORIES = [
      { name: "Ровня",     min: 0,  max: 0, cost: 1 },
      { name: "Испытание", min: -2, max: 3, cost: 2 },
      { name: "Вызов",     min: 2,  max: 6, cost: 3 }
    ];
    // Ранги арены. categories — сколько категорий открыто для боёв за ранг (обычные бои открыты во всех категориях);
    // need — очков для боя за повышение; boss — имя стража ранга. Все числа примерные, их нужно балансировать.
    const ARENA_RANKS = [
      { name: "Новичок", categories: 1, need: 20,   boss: "Привратник арены" },
      { name: "Боец",    categories: 2, need: 35,   boss: "Страж среднего круга" },
      { name: "Ветеран", categories: 3, need: 50,   boss: "Страж высшего круга" },
      { name: "Чемпион", categories: 3, need: null, boss: null }
    ];
    const BOSS_LEVELS_ABOVE = 2;      // страж ранга сильнее героя на столько уровней
    const RATED_XP_SHARE = 0.25;      // доля опыта в бою за ранг по сравнению с обычным боем
    const PROMOTION_TOKENS = 5;       // жетоны за новый ранг
    // Билеты арены: бой за ранг тратит билеты, они сами возвращаются по одному раз в TICKET_MINUTES минут реального времени
    // (по отметке времени, поэтому и пока игра закрыта).
    const TICKET_MAX = 10;
    const TICKET_MINUTES = 6;
    const TICKET_MS = TICKET_MINUTES * 60 * 1000;
    // Награда в бою за ранг по разнице уровней (боец минус герой), на один билет; для категории умножается на её цену.
    const RATED_POINTS = [[-3, 1], [0, 3], [2, 5], [4, 7], [6, 9]];
    const RATED_TOKENS = [[-3, 0], [-2, 1], [0, 2], [2, 3], [4, 4], [6, 5]];
    // Звания для лавки жетонов: rank — минимальный ранг, нужный для покупки.
    const ARENA_TITLES = [
      { key: "gladiator", name: "Гладиатор",       rank: 1, cost: 10 },
      { key: "veteran",   name: "Ветеран арены",   rank: 2, cost: 25 },
      { key: "champion",  name: "Чемпион арены",   rank: 3, cost: 50 }
    ];
    // Название носимого звания для шапки; если звание в сохранении неизвестно, ничего не показываем.
    const titleName = a => ARENA_TITLES.find(t => t.key === a.title)?.name ?? "";
    const ARENA_GOODS = [ { item: "gladRation", cost: 3 } ];

    const newArenaState = () => ({ rank: 0, points: 0, tokens: 0, tickets: TICKET_MAX, ticketAt: Date.now(), offers: [null, null, null], titles: [], title: null });

    // Линейная интерполяция по таблице точек [x, y]; за краями таблицы значение не растёт.
    function interp(table, x) {
      if (x <= table[0][0]) return table[0][1];
      const last = table[table.length - 1];
      if (x >= last[0]) return last[1];
      for (let i = 1; i < table.length; i++) {
        if (x <= table[i][0]) {
          const lo = table[i - 1], hi = table[i];
          return lo[1] + (hi[1] - lo[1]) * (x - lo[0]) / (hi[0] - lo[0]);
        }
      }
    }

    function ratedRewards(heroLevel, enemyLevel, cat) {
      const diff = enemyLevel - heroLevel;
      return { points: Math.round(interp(RATED_POINTS, diff) * cat.cost), tokens: Math.round(interp(RATED_TOKENS, diff) * cat.cost) };
    }

    // Возврат билетов: считаем, сколько целых периодов прошло, остаток времени не теряем.
    function syncTickets(a) {
      const now = Date.now();
      if (a.tickets >= TICKET_MAX) { a.tickets = TICKET_MAX; a.ticketAt = now; return; }
      if (!Number.isFinite(a.ticketAt) || a.ticketAt > now) { a.ticketAt = now; return; }
      const gain = Math.floor((now - a.ticketAt) / TICKET_MS);
      if (gain <= 0) return;
      a.tickets = Math.min(TICKET_MAX, a.tickets + gain);
      a.ticketAt = a.tickets >= TICKET_MAX ? now : a.ticketAt + gain * TICKET_MS;
    }

    function ticketText(a) {
      if (a.tickets >= TICKET_MAX) return `Билеты: ${a.tickets} / ${TICKET_MAX}.`;
      const minutes = Math.max(1, Math.ceil((TICKET_MS - (Date.now() - a.ticketAt)) / 60000));
      return `Билеты: ${a.tickets} / ${TICKET_MAX}, следующий примерно через ${minutes} мин.`;
    }

    // Соперники в предложении создаются под уровень героя; при росте уровня или после боя предложение обновляется.
    function ensureOffers(p) {
      ARENA_CATEGORIES.forEach((cat, i) => {
        const o = p.arena.offers[i];
        if (!o || o.baseLevel !== p.level) {
          p.arena.offers[i] = { ...generateFighter(p.level + randInt(cat.min, cat.max)), baseLevel: p.level };
        }
      });
    }

    // Награда зависит от разницы уровней (соперник минус герой). Точки таблицы: [разница, множитель опыта, множитель денег];
    // между точками значения считаются линейно. Все числа примерные, их нужно балансировать.
    const REWARD_POINTS = [
      [-8, 0, 0], [-6, 0.15, 0.1], [-4, 0.4, 0.3], [-2, 0.7, 0.6], [0, 1, 1], [2, 1.2, 1.2], [5, 2, 1.5], [8, 2.6, 1.8]
    ];
    // Опыт за бой с равным врагом: уровень, делённый на число таких боёв на уровень (fightsPerLevel, data.js).
    const arenaBaseXp = level => Math.max(1, Math.round(xpToNext(level) / fightsPerLevel(level)));
    const arenaBaseMoney = level => 30 + 10 * level; // в меди

    function rewardMultipliers(diff) {
      const first = REWARD_POINTS[0];
      const last = REWARD_POINTS[REWARD_POINTS.length - 1];
      if (diff <= first[0]) return { xp: first[1], money: first[2] };
      if (diff >= last[0]) return { xp: last[1], money: last[2] };
      for (let i = 1; i < REWARD_POINTS.length; i++) {
        const a = REWARD_POINTS[i - 1];
        const b = REWARD_POINTS[i];
        if (diff <= b[0]) {
          const t = (diff - a[0]) / (b[0] - a[0]);
          return { xp: a[1] + (b[1] - a[1]) * t, money: a[2] + (b[2] - a[2]) * t };
        }
      }
    }

    // Базовая награда считается от уровня героя: при равных уровнях награда ровно базовая.
    function arenaRewards(heroLevel, enemyLevel) {
      const m = rewardMultipliers(enemyLevel - heroLevel);
      return { xp: Math.round(arenaBaseXp(heroLevel) * m.xp), copper: Math.round(arenaBaseMoney(heroLevel) * m.money) };
    }

    function arenaEnemyDef(f) {
      const L = f.level;
      return {
        name: f.name, health: 25 + 9 * L, dmg: f.dmg, gear: f.gear, magicResist: Math.floor(ENEMY_MAGIC_RESIST_PER_LEVEL * L),
        armor: [Math.floor(0.4 * L), Math.floor(0.6 * L), Math.floor(0.4 * L), Math.floor(0.3 * L)]
      };
    }

    // Дорога из деревни в столицу. Типы этапов: story (текст и эффект), fight (бой), end (конец).

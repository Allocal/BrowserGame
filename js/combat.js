    // ======================= ЛОГИКА БОЯ (не знает про экран) =======================
    const freshSeen = () => ({ strikes: ZONES.map(() => 0), blocks: ZONES.map(() => 0) });

    function createGame(player, bot, reserve = []) {
      player.mana = player.startMana ?? player.maxMana ?? 0; // мана в бою полная, кроме вылазки: там остаток от прошлых боёв
      // last — что игрок делал в прошлом ходу (враг на это реагирует); seen — сколько раз враг бил и блокировал каждую зону (для автопилота).
      // skill — умение в слоте и его перезарядка (cd — сколько ходов ещё недоступно); у ботов и диких врагов его нет.
      // reserve — очередь врагов, которые выходят по одному, когда упал предыдущий (стая, шайка).
      return { player, bot, reserve, turn: 0, over: false, last: null, seen: freshSeen(),
               skill: player.skills?.equipped ? { key: player.skills.equipped, cd: 0 } : null };
    }

    // Следующий враг выходит вместо упавшего: автопилот изучает его привычки заново, а здоровье героя, мана и перезарядка умения остаются.
    function nextBot(game) {
      game.bot = game.reserve.shift();
      game.seen = freshSeen();
      return game.bot;
    }

    function skillReady(game) {
      return Boolean(game.skill) && game.skill.cd === 0 && (game.skill.key !== "arcaneBurst" || canCast(game.player));
    }

    // Заклинание можно произнести, если оно есть у бойца и хватает маны; иначе маг бьёт обычным ударом.
    const canCast = c => Boolean(c.spellDamage) && (c.mana ?? 0) >= SPELL.cost;

    // Рулетка: индекс по весам. Шарик падает на случайную точку колеса, зона с большим весом перехватывает его чаще.
    function weightedIndex(weights) {
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1; // страховка от погрешности дробных чисел
    }

    // Зоны для блоков: без повторов, выбранной зоне вес обнуляется.
    function pickWeightedZones(count, weights) {
      const w = [...weights];
      const out = [];
      for (let n = 0; n < count; n++) {
        const i = weightedIndex(w);
        out.push(i);
        w[i] = 0;
      }
      return out;
    }

    // Враг выбирает зоны с весами: привычки (style.strike / style.block) и реакция на прошлый ход игрока (style.react).
    // Открытая в прошлом ходу зона привлекательнее для удара, зона, куда бил игрок, — для блока. react должен быть меньше 1.
    const DEFAULT_STYLE = { react: 0.3 };
    const reactFactor = (react, hit) => 1 + (hit ? react : -react);

    function botZoneWeights(game) {
      const style = { ...DEFAULT_STYLE, ...game.bot.style };
      const last = game.last;
      const strike = ZONES.map((_, z) => (style.strike?.[z] ?? 1) * (last ? reactFactor(style.react, !last.blocks.includes(z)) : 1));
      const block = ZONES.map((_, z) => (style.block?.[z] ?? 1) * (last ? reactFactor(style.react, last.strikes.includes(z)) : 1));
      return { strike, block };
    }

    // Хочет ли автопилот применить умение в этом ходу: простые (auto "free") сразу, защитные только если здоровье ниже порога тактики.
    function autoWantsSkill(game, tactic) {
      if (!skillReady(game)) return false;
      if (SKILLS[game.skill.key].auto === "free") return true;
      const t = TACTICS.find(x => x.key === tactic);
      return Boolean(t) && game.player.health / game.player.maxHealth < t.healBelow;
    }

    // Автопилот игрока: запоминает, куда враг бил и что закрывал, бьёт туда, где он реже закрывается, и закрывает то, куда он бьёт чаще.
    // Не повторяет свой прошлый удар (враг на это реагирует) и закрывает зону, которая была открыта. noise — доля случайных слотов:
    // автопилот играет прилично, но внимательный игрок вручную лучше.
    const AUTO = { noise: 0.25 };
    function autoPick(game) {
      const last = game.last;
      const seen = game.seen;
      const jitter = () => Math.random() * 0.9; // ломает ничьи, иначе в начале боя автопилот всегда выбирал бы одно и то же
      const strikeCost = ZONES.map((_, z) => seen.blocks[z] + (last && last.strikes.includes(z) ? 3 : 0) + jitter());
      const blockGain = ZONES.map((_, z) => seen.strikes[z] + (last && !last.blocks.includes(z) ? 3 : 0) + jitter());
      const byStrike = ZONES.map((_, z) => z).sort((a, b) => strikeCost[a] - strikeCost[b]);
      const byBlock = ZONES.map((_, z) => z).sort((a, b) => blockGain[b] - blockGain[a]);
      const strikes = Array.from({ length: game.player.gear.strikes }, (_, i) =>
        (Math.random() < AUTO.noise ? Math.floor(Math.random() * ZONES.length) : byStrike[i % ZONES.length]));
      const blocks = byBlock.slice(0, game.player.gear.blocks);
      blocks.forEach((_, i) => {
        if (Math.random() >= AUTO.noise) return;
        const free = ZONES.map((_, z) => z).filter(z => !blocks.includes(z));
        if (free.length) blocks[i] = free[Math.floor(Math.random() * free.length)];
      });
      return { strikes, blocks };
    }

    // Урон i-го удара зависит от руки, которой он сделан, поэтому каждый результат хранит свой урон.
    function randInt(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    // Прошедший удар ослабляется бронёй той зоны, куда он попал; минимум всегда 1.
    function reduceDamage(raw, armor) {
      const cut = armor / (armor + ARMOR_K);
      return Math.max(1, Math.round(raw * (1 - cut)));
    }

    function resolveStrikes(attacker, defender, strikeZones, blockZones, magic = false, dmgMult = 1) {
      return strikeZones.map((zone, i) => {
        const profile = magic ? attacker.spellDamage : attacker.strikeDamages[Math.min(i, attacker.strikeDamages.length - 1)];
        // Блок держит оружие, но не магию: заклинание всегда проходит в выбранную зону.
        const blocked = !magic && blockZones.includes(zone);
        // Крит и вилка считаются для каждого удара отдельно, в том числе для заблокированных: крит пробивает блок.
        const crit = Math.random() * 100 < profile.crit;
        const passes = !blocked || crit;
        // Уклониться можно от любого удара, который прошёл бы, в том числе от крита сквозь блок.
        const dodged = passes && Math.random() * 100 < (defender.dodge ?? 0);
        const hit = passes && !dodged;
        const throughBlock = crit && blocked;
        const raw = Math.round(randInt(profile.min, profile.max) * (crit && !blocked ? (profile.critMult ?? CRIT_MULTIPLIER) : 1) * dmgMult);
        return { zone, hit, dodged, raw, crit, throughBlock, magic, damage: hit ? reduceDamage(raw, magic ? (defender.magicResist ?? 0) : defender.gear.armor[zone]) : 0 };
      });
    }

    function totalDamage(results) {
      return results.filter(r => r.hit).reduce((sum, r) => sum + r.damage, 0);
    }

    // Оба бойца ходят одновременно: сначала считаем оба результата, потом применяем урон.
    function playTurn(game, playerStrikes, playerBlocks, useSkill = false) {
      const usingSkill = useSkill && skillReady(game);
      // Застигнутый врасплох враг пропускает ход: ни бьёт, ни блокирует (game.bot.surprised — сколько ходов осталось пропустить).
      const surprised = (game.bot.surprised ?? 0) > 0;
      if (surprised) game.bot.surprised -= 1;
      const weights = botZoneWeights(game);
      const botStrikes = surprised ? [] : Array.from({ length: game.bot.gear.strikes }, () => weightedIndex(weights.strike));
      const botBlocks = surprised ? [] : pickWeightedZones(game.bot.gear.blocks, weights.block);

      const casting = canCast(game.player);
      const skillKey = usingSkill ? game.skill.key : null;
      const guarding = (game.guardTurns ?? 0) > 0 || skillKey === "stance";
      if (skillKey === "stance") game.guardTurns = SKILL_FX.stanceTurns;
      const playerResults = resolveStrikes(game.player, game.bot, playerStrikes, botBlocks, casting,
        skillKey === "powerStrike" || skillKey === "arcaneBurst" ? SKILL_FX.burstMult : 1);
      const botResults = resolveStrikes(game.bot, game.player, botStrikes, playerBlocks, false, guarding ? SKILL_FX.stanceFactor : 1);
      if (skillKey === "evade") botResults.forEach(r => { r.hit = false; r.dodged = true; r.damage = 0; });

      // Лечение идёт до урона этого хода: вовремя применённое умение может спасти героя, а упавшего оно не воскрешает.
      if (skillKey === "secondWind") game.player.health = Math.min(game.player.maxHealth, game.player.health + Math.round(game.player.maxHealth * SKILL_FX.healShare));
      game.bot.health = Math.max(0, game.bot.health - totalDamage(playerResults));
      game.player.health = Math.max(0, game.player.health - totalDamage(botResults));
      if (game.guardTurns > 0) game.guardTurns -= 1;
      game.turn += 1;
      if (game.skill) game.skill.cd = usingSkill ? SKILLS[game.skill.key].cooldown : Math.max(0, game.skill.cd - 1);
      game.last = { strikes: playerStrikes, blocks: playerBlocks };
      botResults.forEach(r => { game.seen.strikes[r.zone] += 1; });
      botBlocks.forEach(z => { game.seen.blocks[z] += 1; });
      // Мана: заклинание тратит её, затем немного возвращается каждый ход.
      if (game.player.maxMana > 0) {
        if (casting) game.player.mana -= SPELL.cost * playerStrikes.length;
        game.player.mana = Math.min(game.player.maxMana, game.player.mana + BALANCE_MANA.regen);
      }

      return { playerResults, botResults, botBlocks, playerBlocks, casting, surprised, skillUsed: usingSkill ? game.skill.key : null };
    }

    function getOutcome(game) {
      const playerDead = game.player.health === 0;
      const botDead = game.bot.health === 0;
      if (playerDead && botDead) return "draw";
      if (botDead) return "win";
      if (playerDead) return "lose";
      return null;
    }

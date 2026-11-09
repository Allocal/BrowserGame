    // ======================= ЛОГИКА БОЯ (не знает про экран) =======================
    function createGame(player, bot) {
      player.mana = player.startMana ?? player.maxMana ?? 0; // мана в бою полная, кроме вылазки: там остаток от прошлых боёв
      return { player, bot, turn: 0, over: false, last: null }; // last — что игрок делал в прошлом ходу (враг на это реагирует)
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

    // Урон i-го удара зависит от руки, которой он сделан, поэтому каждый результат хранит свой урон.
    function randInt(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    // Прошедший удар ослабляется бронёй той зоны, куда он попал; минимум всегда 1.
    function reduceDamage(raw, armor) {
      const cut = armor / (armor + ARMOR_K);
      return Math.max(1, Math.round(raw * (1 - cut)));
    }

    function resolveStrikes(attacker, defender, strikeZones, blockZones, magic = false) {
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
        const raw = Math.round(randInt(profile.min, profile.max) * (crit && !blocked ? (profile.critMult ?? CRIT_MULTIPLIER) : 1));
        return { zone, hit, dodged, raw, crit, throughBlock, magic, damage: hit ? reduceDamage(raw, magic ? (defender.magicResist ?? 0) : defender.gear.armor[zone]) : 0 };
      });
    }

    function totalDamage(results) {
      return results.filter(r => r.hit).reduce((sum, r) => sum + r.damage, 0);
    }

    // Оба бойца ходят одновременно: сначала считаем оба результата, потом применяем урон.
    function playTurn(game, playerStrikes, playerBlocks) {
      // Застигнутый врасплох враг пропускает ход: ни бьёт, ни блокирует (game.bot.surprised — сколько ходов осталось пропустить).
      const surprised = (game.bot.surprised ?? 0) > 0;
      if (surprised) game.bot.surprised -= 1;
      const weights = botZoneWeights(game);
      const botStrikes = surprised ? [] : Array.from({ length: game.bot.gear.strikes }, () => weightedIndex(weights.strike));
      const botBlocks = surprised ? [] : pickWeightedZones(game.bot.gear.blocks, weights.block);

      const casting = canCast(game.player);
      const playerResults = resolveStrikes(game.player, game.bot, playerStrikes, botBlocks, casting);
      const botResults = resolveStrikes(game.bot, game.player, botStrikes, playerBlocks);

      game.bot.health = Math.max(0, game.bot.health - totalDamage(playerResults));
      game.player.health = Math.max(0, game.player.health - totalDamage(botResults));
      game.turn += 1;
      game.last = { strikes: playerStrikes, blocks: playerBlocks };
      // Мана: заклинание тратит её, затем немного возвращается каждый ход.
      if (game.player.maxMana > 0) {
        if (casting) game.player.mana -= SPELL.cost * playerStrikes.length;
        game.player.mana = Math.min(game.player.maxMana, game.player.mana + BALANCE_MANA.regen);
      }

      return { playerResults, botResults, botBlocks, playerBlocks, casting, surprised };
    }

    function getOutcome(game) {
      const playerDead = game.player.health === 0;
      const botDead = game.bot.health === 0;
      if (playerDead && botDead) return "draw";
      if (botDead) return "win";
      if (playerDead) return "lose";
      return null;
    }

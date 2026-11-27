    // ======================= ЭКРАН: бой по намерениям (прототип, только маг против волка) =======================
    // Использует общий экран боя (фигуры, полоски здоровья и маны, журнал, итог); заменяет только панель управления.
    const INTENT_ENEMIES = ["wolf"];                        // виды врагов, для которых включён новый бой
    const MAGE_SLOTS = ["frostBolt", "barrier", "timidity"]; // три слота-роли мага: атака, защита, контроль
    let intentAutoOn = false;
    let intentAutoTimer = null;
    const INTENT_AUTO_DELAY = 700; // пауза между ходами автопилота, мс
    // Элементы старой панели управления (зоны, ход, авто), которые в новом бою не нужны.
    const ZONE_CONTROLS = ["strike-title", "strike-zones", "strike-reset", "block-title", "block-zones", "turn-btn", "auto-btn"];

    const useIntentBattle = (player, kind) => player.classKey === "mage" && INTENT_ENEMIES.includes(kind);

    function setIntentMode(on) {
      el("intent-controls").hidden = !on;
      ZONE_CONTROLS.forEach(id => { el(id).hidden = on; });
      if (on) ["skill-btn", "speed-btn", "tactic-btn"].forEach(id => { el(id).hidden = true; });
    }

    function startIntentBattle(player, bot, kind, introText, progressText, finishHandler) {
      journey.player.knowledge ??= cleanKnowledge(); // знание хранится у настоящего героя, а не у копии на время боя
      journey.player.skillPoints ??= cleanSkillPoints(); // очки умений тоже
      const pts = journey.player.skillPoints;
      game = createIntentGame(player, bot, kind, Object.fromEntries(RANKED_SKILLS.map(key => [key, skillRank(pts[key]).rank])));
      game.reserve = []; // общий showBot спрашивает очередь врагов; в новом бою она пока пустая
      skillArmed = false;
      setAuto(false);
      setIntentMode(true);
      setIntentAuto(false);
      onBattleFinish = finishHandler;
      el("log").replaceChildren();
      el("result").textContent = "";
      el("after-btn").hidden = true;
      el("after-hero-btn").hidden = true;
      el("player-xp").textContent = "";
      el("battle-intro").textContent = introText;
      el("battle-progress").textContent = progressText;
      el("player-name").textContent = player.name;
      el("player-max").textContent = player.maxHealth;
      el("player-gear-name").textContent = `${player.gear.name} · заклинание: урон ${rangeText(player.spellDamage)}${armorLine(player.gear)}${dodgeLine(player)}`;
      el("player-figure").innerHTML = figureSvg(player.gear, false);
      showBot(bot);
      showScreen("battle");
      refreshHealth();
      renderIntentControls();
    }

    // Намёк врага и кнопки умений. Недоступное умение (перезарядка, мало маны) серое, но видно, чего ему не хватает.
    function renderIntentControls() {
      const step = knowledgeStep(journey.player.knowledge, game.monsterKind);
      el("intent-hint").textContent = `${game.bot.name}: ${intentHint(step, game.move)}`;
      const box = el("intent-buttons");
      box.replaceChildren();
      const keys = canUseSkill(game, "staffHit") ? [...MAGE_SLOTS, "staffHit"] : MAGE_SLOTS; // запасной удар появляется, когда нет маны
      keys.forEach(key => {
        const skill = INTENT_SKILLS[key];
        const cd = game.cooldowns[key] ?? 0;
        const note = cd > 0 ? `через ${cd} ход.` : (game.player.mana < skill.cost ? "не хватает маны" : `мана −${skill.cost}`);
        const btn = document.createElement("button");
        btn.className = "intent-skill";
        const rank = game.skillRanks[key] ? ` · ранг ${game.skillRanks[key]}` : "";
        btn.innerHTML = `<span class="skill-name">${skill.name}${rank}</span><small>${note}</small><small class="skill-hint">${skill.hint}</small>`;
        btn.title = skill.hint;
        btn.disabled = game.over || intentAutoOn || !canUseSkill(game, key);
        btn.addEventListener("click", () => onIntentTurn(key));
        box.appendChild(btn);
      });
      const auto = document.createElement("button");
      auto.textContent = intentAutoOn ? "Взять управление" : "Авто";
      auto.disabled = game.over;
      auto.addEventListener("click", () => setIntentAuto(!intentAutoOn));
      box.appendChild(auto);
      const weak = game.weakenTurns > 0 ? ` · ${game.bot.name} ослаблен ещё на ${game.weakenTurns} ход.` : "";
      const { rank, percent } = knowledgeRank(journey.player.knowledge, game.monsterKind);
      el("intent-info").textContent = `Знание врагов: ступень ${rank} (${percent}%)${weak}`;
    }

    // Автопилот: раз в паузу выбирает умение по знанию героя о враге и делает ход. Любое окончание боя его выключает.
    function setIntentAuto(on) {
      intentAutoOn = on;
      clearTimeout(intentAutoTimer);
      intentAutoTimer = null;
      if (on && game && !game.over) intentAutoStep();
      if (game) renderIntentControls();
    }

    function intentAutoStep() {
      intentAutoTimer = setTimeout(() => {
        if (!intentAutoOn || !game || game.over) return;
        const step = knowledgeStep(journey.player.knowledge, game.monsterKind);
        const key = autoPickSkill(game, step);
        if (!key) { setIntentAuto(false); return; }
        onIntentTurn(key);
        if (intentAutoOn && !game.over) intentAutoStep();
      }, INTENT_AUTO_DELAY);
    }

    function onIntentTurn(skillKey) {
      const result = playIntentTurn(game, skillKey);
      result.rankUp = awardSkillPoints(skillKey, result.movePlayed);
      logIntentTurn(skillKey, result);
      refreshHealth();
      if (result.outcome) {
        game.over = true;
        intentAutoOn = false;
        clearTimeout(intentAutoTimer);
        if (result.outcome === "win") recordKnowledge(journey.player.knowledge, game.monsterKind);
        el("result").textContent = { win: "Победа!", lose: "Поражение.", draw: "Ничья: оба упали." }[result.outcome];
        onBattleFinish(result.outcome);
      }
      renderIntentControls();
    }

    // Очки умению за применение (больше за хороший ответ на приём). Записываются настоящему герою, ранг растёт прямо в бою.
    // Возвращает новый ранг, если он вырос, иначе null.
    function awardSkillPoints(skillKey, movePlayed) {
      if (!RANKED_SKILLS.includes(skillKey)) return null;
      const pts = journey.player.skillPoints;
      const before = skillRank(pts[skillKey]).rank;
      pts[skillKey] += skillPointsFor(skillKey, MOVES[movePlayed].kind);
      const after = skillRank(pts[skillKey]).rank;
      if (after === before) return null;
      game.skillRanks[skillKey] = after;
      return after;
    }

    function logIntentTurn(skillKey, result) {
      const skill = INTENT_SKILLS[skillKey];
      const { hero, enemy, movePlayed } = result;
      const bot = game.bot.name;
      const lines = [{ text: `Ход ${game.turn}`, cls: "turn-title" }];
      // Своё действие.
      if (skill.delivery === "bolt") {
        if (hero.dodged) lines.push({ text: `«${skill.name}» не попала: ${bot} уклонился`, cls: "miss" });
        else if (hero.damage > 0) lines.push({ text: `«${skill.name}»: ${hero.crit ? "★ КРИТИЧЕСКОЕ ЗАКЛИНАНИЕ! " : ""}попал (-${hero.damage})`, cls: hero.crit ? "crit" : "good" });
        else lines.push({ text: `«${skill.name}» пролетела мимо: ${bot} ушёл с линии удара`, cls: "miss" });
      } else if (skill.effect) {
        lines.push({ text: hero.effectApplied
          ? `«${skill.name}»: ${bot} дрогнул и бьёт слабее ещё ${skill.effect.turns} хода`
          : `«${skill.name}»: ${bot} не поддался`, cls: hero.effectApplied ? "good" : "miss" });
      } else {
        lines.push({ text: hero.damage > 0 ? `«${skill.name}»: ты прикрываешься и бьёшь слабо (-${hero.damage})` : `Ты применяешь «${skill.name}»`, cls: hero.damage > 0 ? "good" : "info" });
      }
      // Что сделал враг.
      lines.push({ text: `${bot}: ${MOVES[movePlayed].name}`, cls: "info" });
      if (enemy.hits.length === 0) lines.push({ text: "Он не нападает", cls: "miss" });
      enemy.hits.forEach(h => {
        lines.push(h.dodged
          ? { text: "★ ТЫ УКЛОНИЛСЯ!", cls: "dodge" }
          : { text: `${h.crit ? "★ КРИТИЧЕСКИЙ УДАР! " : ""}-${h.damage} тебе`, cls: h.crit ? "crit" : "hit" });
      });
      if (result.rankUp) lines.push({ text: `★ «${skill.name}» растёт: ранг ${result.rankUp}${result.rankUp === SKILL_WALL ? " (дальше нужен учитель)" : ""}`, cls: "crit" });
      // prepend ставит строки сверху, поэтому пишем в обратном порядке: ход окажется наверху целиком.
      lines.reverse().forEach(l => addLogLine(l.text, l.cls));
    }

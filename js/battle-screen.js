    // ======================= ЭКРАН: бой =======================
    let game = null;
    const selectedStrikes = [];
    const selectedBlocks = new Set();

    // Автопилот боя: паузы между ходами для ×1, ×2, ×4 (мс), включён ли он, текущая скорость и запланированный ход.
    const AUTO_SPEEDS = [1200, 600, 250];
    let autoOn = false;
    let autoSpeedIndex = 0;
    let autoTacticIndex = 0;
    let autoTimer = null;
    let skillArmed = false; // игрок нажал кнопку умения: оно применится в этом ходу

    const el = id => document.getElementById(id);

    function refreshSkillButton() {
      const btn = el("skill-btn");
      btn.hidden = !game.skill;
      if (!game.skill) return;
      const s = SKILLS[game.skill.key];
      btn.textContent = game.skill.cd > 0 ? `${s.name} (через ${game.skill.cd})` : s.name;
      btn.title = s.description;
      btn.disabled = game.over || autoOn || !skillReady(game);
      btn.className = skillArmed ? "on" : "";
    }

    function setAuto(on) {
      autoOn = on;
      el("auto-btn").textContent = on ? "Взять управление" : "Авто";
      el("speed-btn").hidden = !on;
      el("speed-btn").textContent = "Скорость ×" + [1, 2, 4][autoSpeedIndex];
      el("tactic-btn").hidden = !(on && game?.skill);
      el("tactic-btn").textContent = "Тактика: " + TACTICS[autoTacticIndex].name;
      if (!on) {
        skillArmed = false;
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (game) refreshSelection();
    }

    function autoStep() {
      if (!autoOn || !game || game.over) return;
      const tactic = TACTICS[autoTacticIndex].key;
      if (tactic === "stop" && game.skill && SKILLS[game.skill.key].auto === "tactic" && autoWantsSkill(game, tactic)) {
        setAuto(false);
        addLogLine(`Авто остановлено: время применить «${SKILLS[game.skill.key].name}».`, "info");
        return;
      }
      const pick = autoPick(game);
      selectedStrikes.length = 0;
      selectedStrikes.push(...pick.strikes);
      selectedBlocks.clear();
      pick.blocks.forEach(z => selectedBlocks.add(z));
      skillArmed = autoWantsSkill(game, tactic);
      refreshSelection();
      autoTimer = setTimeout(() => {
        skillArmed = autoWantsSkill(game, TACTICS[autoTacticIndex].key); // тактику могли сменить за время паузы
        onTurn();
        autoStep();
      }, AUTO_SPEEDS[autoSpeedIndex]);
    }

    function showScreen(id) {
      ["menu", "training-setup", "story", "capital", "arena", "arenashop", "tavern", "shop", "teacher", "hero", "levelup", "battle", "dungeon", "gates", "shopscene"].forEach(s => { el(s).hidden = (s !== id); });
      currentScreen = id;
      if (id === "menu") refreshMenu();
      updateHud();
    }

    // Постоянная панель здоровья: видна на всех экранах города, кроме героя (у него свои шкалы).
    let currentScreen = "menu";
    const HUD_SCREENS = ["capital", "arena", "arenashop", "tavern", "shop", "teacher", "levelup", "dungeon", "gates", "shopscene"];

    // Мана в панели: во время вылазки или подземелья это остаток, иначе полная.
    const hudMana = p => journey.dungeon ? journey.dungeon.mana : p.maxMana;

    function regenClock(p) {
      if (p.health >= p.maxHealth) return "";
      if (!journey || journey.phase !== "capital" || journey.dungeon) return "";
      const perHpMs = REGEN_SECONDS_FULL * 1000 / p.maxHealth;
      const doneMs = Number.isFinite(p.regenAt) ? Math.max(0, Math.min(perHpMs, Date.now() - p.regenAt)) : 0; // уже накопленная часть текущего очка здоровья
      const sec = Math.max(1, Math.ceil(((p.maxHealth - p.health) * perHpMs - doneMs) / 1000));
      return `полное через ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    }

    function updateHud() {
      const hud = el("hud");
      const p = journey?.player;
      if (!p || !HUD_SCREENS.includes(currentScreen)) { hud.hidden = true; return; }
      hud.hidden = false;
      hud.replaceChildren();
      const hp = document.createElement("div");
      hp.className = "hud-hp";
      const top = document.createElement("div");
      top.className = "hud-hp-top";
      top.append(icon("heart", 16), document.createTextNode(`${p.health} / ${p.maxHealth}`));
      const clock = regenClock(p);
      if (clock) { const r = document.createElement("span"); r.className = "hud-regen"; r.textContent = clock; top.appendChild(r); }
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.innerHTML = `<div class="fill" style="width:${barPercent(p.health, p.maxHealth)}"></div>`;
      hp.append(top, bar);
      if (p.maxMana > 0) {
        const mtop = document.createElement("div");
        mtop.className = "hud-hp-top hud-mana-top";
        mtop.append(icon("flask", 16), document.createTextNode(`${hudMana(p)} / ${p.maxMana}`));
        const mbar = document.createElement("div");
        mbar.className = "bar";
        mbar.innerHTML = `<div class="fill manafill" style="width:${barPercent(hudMana(p), p.maxMana)}"></div>`;
        hp.append(mtop, mbar);
      }
      hud.append(hp, chip(`ур. ${p.level}`, "gold", "level"), chip(formatMoney(p.copper), "gold", "coin"));
      const path = pathNameOf(p);
      if (path) hud.append(chip(path, "dim", p.classKey === "mage" ? "flask" : "shield"));
    }

    // Раз в секунду: здоровье подрастает само, панель и экран героя показывают это без перехода между экранами.
    setInterval(() => {
      const p = journey?.player;
      if (!p || journey.phase !== "capital" || !(HUD_SCREENS.includes(currentScreen) || currentScreen === "hero")) return; // в бою здоровье не восстанавливается
      const before = p.health;
      syncRegen(p);
      if (p.health !== before) saveGame("capital");
      if (currentScreen === "hero") {
        el("hero-hp").textContent = `${p.health} / ${p.maxHealth}${regenClock(p) ? " · " + regenClock(p) : ""}`;
        el("hero-hp-bar").style.width = barPercent(p.health, p.maxHealth);
      } else updateHud();
    }, 1000);

    function fillPresetSelect(select, defaultKey) {
      for (const key in PRESETS) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = PRESETS[key].label;
        select.appendChild(option);
      }
      select.value = defaultKey;
    }

    function renderZoneButtons(container, selected, limit) {
      container.replaceChildren();
      ZONES.forEach((name, i) => {
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.className = "zone" + (selected.has(i) ? " on" : "");
        btn.disabled = game.over || autoOn;
        btn.addEventListener("click", () => {
          if (selected.has(i)) selected.delete(i);
          else if (selected.size < limit) selected.add(i);
          refreshSelection();
        });
        container.appendChild(btn);
      });
    }

    function renderStrikeButtons(limit) {
      const container = el("strike-zones");
      container.replaceChildren();
      ZONES.forEach((name, i) => {
        const count = selectedStrikes.filter(z => z === i).length;
        const btn = document.createElement("button");
        btn.textContent = count > 0 ? `${name} ×${count}` : name;
        btn.className = "zone" + (count > 0 ? " on" : "");
        btn.disabled = game.over || autoOn;
        btn.addEventListener("click", () => {
          if (selectedStrikes.length < limit) selectedStrikes.push(i);
          refreshSelection();
        });
        container.appendChild(btn);
      });
    }

    // Фигуры строятся один раз за бой, а тут меняются только классы: так не пропадает мигание после хода.
    function updateFigureMarks() {
      document.querySelectorAll("#bot-figure .z").forEach(s =>
        s.classList.toggle("target", selectedStrikes.includes(+s.dataset.zone)));
      document.querySelectorAll("#player-figure .z").forEach(s =>
        s.classList.toggle("guard", selectedBlocks.has(+s.dataset.zone)));
      document.querySelectorAll("#bot-figure .lbl").forEach(t => {
        const n = selectedStrikes.filter(z => z === +t.dataset.zone).length;
        t.textContent = n ? `×${n}` : "";
      });
    }

    function flashZones(figureId, zones, cssClass) {
      const shapes = [...document.querySelectorAll(`#${figureId} .z`)]
        .filter(s => zones.includes(+s.dataset.zone));
      shapes.forEach(s => s.classList.add(cssClass));
      setTimeout(() => shapes.forEach(s => s.classList.remove(cssClass)), 800);
    }

    function refreshSelection() {
      const strikeLimit = game.player.gear.strikes;
      const blockLimit = game.player.gear.blocks;
      const damages = game.player.strikeDamages;
      const damageInfo = damages.length > 1
        ? `урон: 1-й удар ${rangeText(damages[0])}, 2-й удар ${rangeText(damages[1])}`
        : `урон ${rangeText(damages[0])}`;

      if (game.player.spellDamage) {
        // Маг: вместо удара заклинание, пока хватает маны; потом слабый удар.
        el("strike-title").textContent = canCast(game.player)
          ? `Заклинание «${SPELL.name}»: выбери зону (урон ${rangeText(game.player.spellDamage)}, мана −${SPELL.cost}; блок его не держит)`
          : `Мана кончилась: удар без заклинания, выбери зону (урон ${damageInfo.replace("урон ", "")})`;
      } else {
        el("strike-title").textContent = `Удары: выбрано ${selectedStrikes.length} из ${strikeLimit} (${damageInfo}; можно несколько в одну зону)`;
      }
      el("block-title").textContent = `Блоки: выбрано ${selectedBlocks.size} из ${blockLimit}`;

      renderStrikeButtons(strikeLimit);
      renderZoneButtons(el("block-zones"), selectedBlocks, blockLimit);
      el("strike-reset").disabled = game.over;
      updateFigureMarks();

      el("turn-btn").disabled = game.over || autoOn
        || selectedStrikes.length !== strikeLimit
        || selectedBlocks.size !== blockLimit;
      refreshSkillButton();
    }

    function refreshHealth() {
      el("player-health").textContent = game.player.health;
      el("bot-health").textContent = game.bot.health;
      el("player-bar").style.width = (game.player.health / game.player.maxHealth * 100) + "%";
      el("bot-bar").style.width = (game.bot.health / game.bot.maxHealth * 100) + "%";
      const hasMana = game.player.maxMana > 0;
      el("player-mana-row").hidden = !hasMana;
      if (hasMana) {
        el("player-mana").textContent = game.player.mana;
        el("player-mana-max").textContent = game.player.maxMana;
        el("player-mana-bar").style.width = (game.player.mana / game.player.maxMana * 100) + "%";
      }
      el("player-figure").classList.toggle("dead", game.player.health === 0);
      el("bot-figure").classList.toggle("dead", game.bot.health === 0);
    }

    function addLogLine(text, cssClass) {
      const line = document.createElement("div");
      line.textContent = text;
      if (cssClass) line.className = cssClass;
      el("log").prepend(line);
    }

    function zoneNames(zones) {
      return zones.map(z => ZONES[z]).join(", ");
    }

    function logTurn(turnResult) {
      // prepend ставит строки сверху, поэтому пишем в обратном порядке: новый ход окажется наверху целиком.
      const lines = [];
      lines.push({ text: `Ход ${game.turn}`, cls: "turn-title" });
      if (turnResult.skillUsed) lines.push({ text: `Умение «${SKILLS[turnResult.skillUsed].name}»: ${SKILLS[turnResult.skillUsed].description}`, cls: "info" });
      lines.push({ text: turnResult.surprised
        ? `Твои блоки: ${zoneNames(turnResult.playerBlocks)}. ${game.bot.name} не успел среагировать: он не бьёт и не блокирует.`
        : `Твои блоки: ${zoneNames(turnResult.playerBlocks)}. Блоки противника: ${zoneNames(turnResult.botBlocks)}.` });
      for (const r of turnResult.playerResults) {
        if (r.magic) {
          lines.push(r.hit
            ? { text: `Ты бросаешь «${SPELL.name}» в зону «${ZONES[r.zone]}» — ${r.crit ? "★ КРИТИЧЕСКОЕ ЗАКЛИНАНИЕ! " : ""}попал (-${r.damage}${r.raw !== r.damage ? `, сопротивление погасило ${r.raw - r.damage}` : ""})`, cls: r.crit ? "crit" : "good" }
            : { text: `Ты бросаешь «${SPELL.name}» в зону «${ZONES[r.zone]}» — ${game.bot.name} уклонился`, cls: "miss" });
          continue;
        }
        lines.push(r.hit
          ? { text: `Ты бьёшь в зону «${ZONES[r.zone]}» — ${r.crit ? (r.throughBlock ? "★ КРИТ ПРОБИЛ БЛОК (урон обычный)! " : "★ КРИТИЧЕСКИЙ УДАР! ") : ""}попал (-${r.damage}${r.raw !== r.damage ? `, броня погасила ${r.raw - r.damage}` : ""})`, cls: r.crit ? "crit" : "good" }
          : (r.dodged
            ? { text: `Ты бьёшь в зону «${ZONES[r.zone]}» — ${game.bot.name} уклонился`, cls: "miss" }
            : { text: `Ты бьёшь в зону «${ZONES[r.zone]}» — заблокировано`, cls: "miss" }));
      }
      for (const r of turnResult.botResults) {
        lines.push(r.hit
          ? { text: `${game.bot.name} бьёт в зону «${ZONES[r.zone]}» — ${r.crit ? (r.throughBlock ? "★ КРИТ ПРОБИЛ БЛОК (урон обычный)! " : "★ КРИТИЧЕСКИЙ УДАР! ") : ""}попал (-${r.damage} тебе${r.raw !== r.damage ? `, броня погасила ${r.raw - r.damage}` : ""})`, cls: r.crit ? "crit" : "hit" }
          : (r.dodged
            ? { text: `${game.bot.name} бьёт в зону «${ZONES[r.zone]}» — ★ ТЫ УКЛОНИЛСЯ!`, cls: "dodge" }
            : { text: `${game.bot.name} бьёт в зону «${ZONES[r.zone]}» — ты заблокировал`, cls: "miss" }));
      }
      lines.reverse().forEach(l => addLogLine(l.text, l.cls));
    }

    function flashTurn(turnResult) {
      const zonesWhere = (results, wasHit) => results.filter(r => r.hit === wasHit && !r.dodged).map(r => r.zone);
      const dodgedZones = results => results.filter(r => r.dodged).map(r => r.zone);
      flashZones("bot-figure", zonesWhere(turnResult.playerResults, true), "flash-hit");
      flashZones("bot-figure", zonesWhere(turnResult.playerResults, false), "flash-block");
      flashZones("bot-figure", dodgedZones(turnResult.playerResults), "flash-dodge");
      flashZones("player-figure", zonesWhere(turnResult.botResults, true), "flash-hit");
      flashZones("player-figure", zonesWhere(turnResult.botResults, false), "flash-block");
      flashZones("player-figure", dodgedZones(turnResult.botResults), "flash-dodge");
      // Критические попадания подсвечиваются золотым поверх обычной красной вспышки.
      const critZones = results => results.filter(r => r.hit && r.crit).map(r => r.zone);
      flashZones("bot-figure", critZones(turnResult.playerResults), "flash-crit");
      flashZones("player-figure", critZones(turnResult.botResults), "flash-crit");
    }

    // onFinish(outcome) решает, что показать после боя: в тренировке и в путешествии это разные кнопки.
    let onBattleFinish = null;

    const armorLine = g => (g.armor.some(a => a > 0) ? ` · броня: ${g.armor.join("/")}` : "");
    const dodgeLine = c => (c.dodge > 0 ? ` · уклонение: ${c.dodge}%` : "");
    // Шансы врага против этого героя: те же функции, что считает бой, поэтому число на экране не расходится с боем.
    const foeLine = (bot, player) => {
      const dodge = Math.round(dodgeChance(bot, player) * 10) / 10;
      const crit = Math.round(critChance(bot.strikeDamages[0], bot, player) * 10) / 10;
      const pen = bot.penetration ? ` · пробивание: ${Math.round(bot.penetration * 10) / 10}` : "";
      return ` · уворот: ${dodge}% · крит: ${crit}%${pen}`;
    };

    // Рисует врага целиком; вызывается в начале боя и когда на смену упавшему выходит следующий.
    function showBot(bot) {
      el("bot-name").textContent = bot.name;
      el("bot-max").textContent = bot.maxHealth;
      el("bot-gear-name").textContent = `${bot.gear.name} · урон за удар: ${damageText(bot)}${armorLine(bot.gear)}${foeLine(bot, game.player)}`;
      el("bot-figure").innerHTML = CREATURES[bot.art] ? creatureSvg(bot.art, true) : figureSvg(bot.gear, true);
      el("bot-queue").textContent = game.reserve.length ? `ещё врагов в очереди: ${game.reserve.length}` : "";
    }

    function startBattle(player, bot, introText, progressText, finishHandler, reserve = []) {
      game = createGame(player, bot, reserve);
      skillArmed = false;
      setAuto(false);
      onBattleFinish = finishHandler;
      selectedStrikes.length = 0;
      selectedBlocks.clear();
      el("log").replaceChildren();
      el("result").textContent = "";
      el("after-btn").hidden = true;
      el("after-hero-btn").hidden = true;
      el("player-xp").textContent = "";
      el("battle-intro").textContent = introText;
      el("battle-progress").textContent = progressText;
      el("player-name").textContent = player.name;
      el("player-max").textContent = player.maxHealth;
      el("player-gear-name").textContent = `${player.gear.name} · ` + (player.spellDamage ? `заклинание: урон ${rangeText(player.spellDamage)}, мана −${SPELL.cost}; без маны удар ${damageText(player)}` : `урон за удар: ${damageText(player)}`) + `${armorLine(player.gear)}${dodgeLine(player)}`;
      el("player-figure").innerHTML = figureSvg(player.gear, false);
      showBot(bot);
      showScreen("battle");
      refreshHealth();
      refreshSelection();
    }

    function onTurn() {
      const turnResult = playTurn(game, [...selectedStrikes], [...selectedBlocks], skillArmed);
      skillArmed = false;
      selectedStrikes.length = 0;
      selectedBlocks.clear();
      logTurn(turnResult);
      refreshHealth();
      flashTurn(turnResult);

      const outcome = getOutcome(game);
      if (outcome === "win" && game.reserve.length > 0) {
        const fallen = game.bot.name;
        const next = nextBot(game);
        addLogLine(`${fallen} падает. На его место выходит ${next.name}.`, "info");
        showBot(next);
        refreshHealth();
      } else if (outcome) {
        game.over = true;
        setAuto(false);
        el("result").textContent = {
          win: "Победа!",
          lose: "Поражение.",
          draw: "Ничья: оба упали."
        }[outcome];
        onBattleFinish(outcome);
      }
      refreshSelection();
    }

    function showAfterButton(label, handler) {
      const btn = el("after-btn");
      btn.textContent = label;
      btn.onclick = handler;
      btn.hidden = false;
    }

    // ======================= ТРЕНИРОВОЧНЫЙ БОЙ =======================
    function startTraining() {
      // Ловкость задаётся полями на экране тренировки; пустое или неверное значение сводим к стартовому диапазону.
      const agilityFrom = id => Math.min(60, Math.max(BASE_STAT, Math.floor(Number(el(id).value)) || BASE_STAT));
      const make = (name, presetKey, agility) => presetKey === "mage"
        ? createHero(name, { level: 1, strength: BASE_STAT, endurance: BASE_STAT, agility, classKey: "mage" }, {}, "Маг")
        : createHero(name, { level: 1, strength: BASE_STAT, endurance: BASE_STAT, agility }, PRESETS[presetKey].equipment, PRESETS[presetKey].label);
      const player = make("Ты", el("player-gear").value, agilityFrom("player-agility"));
      const bot = make("Бот", el("bot-gear").value, agilityFrom("bot-agility"));
      startBattle(player, bot, "", "Тренировка", () => {
        showAfterButton("В меню", () => showScreen("menu"));
      });
    }

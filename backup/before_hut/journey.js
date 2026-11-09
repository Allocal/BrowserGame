    // ======================= ПУТЕШЕСТВИЕ =======================
    let journey = null;

    // ----- Сохранение -----
    // Игра сохраняется сама в памяти браузера: на каждой остановке, перед боем, после победы и при смене снаряжения.
    // Сохраняется только состояние героя и номер этапа, а не экран, поэтому после загрузки этап показывается заново.
    // applied нужен, чтобы находки этапа не выдавались второй раз: если они уже выданы, при загрузке их пропускаем.
    // ----- Восстановление здоровья -----
    // Здоровье в столице растёт само: полное восстановление с нуля занимает REGEN_SECONDS_FULL секунд реального времени.
    // Считается по отметке времени p.regenAt, поэтому оно идёт и пока игра закрыта.
    const REGEN_SECONDS_FULL = 600;
    const TAVERN_BASE = 20, TAVERN_PER_LEVEL = 10; // цена полного отдыха в меди: база + за каждый уровень героя; при неполной потере — пропорционально

    function syncRegen(p) {
      const now = Date.now();
      if (!journey || journey.phase !== "capital" || journey.expedition || p.health >= p.maxHealth) { p.regenAt = now; return; }
      if (!Number.isFinite(p.regenAt) || p.regenAt > now) { p.regenAt = now; return; } // часы перевели назад — просто начинаем отсчёт заново
      const perHpMs = REGEN_SECONDS_FULL * 1000 / p.maxHealth;
      const gain = Math.floor((now - p.regenAt) / perHpMs);
      if (gain <= 0) return;
      p.health = Math.min(p.maxHealth, p.health + gain);
      p.regenAt = p.health >= p.maxHealth ? now : p.regenAt + gain * perHpMs; // остаток времени не теряем
    }

    function regenText(p) {
      if (p.health >= p.maxHealth) return "";
      const minutes = Math.ceil((p.maxHealth - p.health) / p.maxHealth * REGEN_SECONDS_FULL / 60);
      return ` Само восстановится примерно за ${minutes} мин.`;
    }

    const tavernPrice = p => Math.ceil((p.maxHealth - p.health) / p.maxHealth * (TAVERN_BASE + TAVERN_PER_LEVEL * p.level));

    const SAVE_KEY = "myGameSave_v1";
    let saveStatus = "unknown";

    function storageWorks() {
      try {
        localStorage.setItem("myGameTest", "1");
        localStorage.removeItem("myGameTest");
        return true;
      } catch (e) {
        return false;
      }
    }

    function saveGame(mode) {
      if (!journey) return;
      const p = journey.player;
      // В столице экран один, поэтому режим сохранения всегда «capital».
      const data = {
        version: 4, mode: journey.phase === "capital" ? "capital" : mode, phase: journey.phase,
        index: journey.index, applied: journey.applied, levelsGained: journey.levelsGained,
        expedition: journey.expedition ?? null, world: journey.world ?? null,
        player: {
          direction: p.direction, copper: p.copper, name: p.name, level: p.level, xp: p.xp, strength: p.strength, endurance: p.endurance, agility: p.agility, intelligence: p.intelligence, classKey: p.classKey, classChosen: p.classChosen, spells: p.spells, pendingPoints: p.pendingPoints, arena: p.arena, regenAt: p.regenAt,
          equipment: p.equipment, inventory: p.inventory, items: p.items, health: p.health
        }
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        saveStatus = "ok";
      } catch (e) {
        saveStatus = "failed";
      }
    }

    // Старые сохранения без арены и повреждённые данные превращаем в корректное состояние, а не падаем.
    function cleanArena(a) {
      const base = newArenaState();
      if (!a || typeof a !== "object") return base;
      const num = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
      base.rank = Math.min(num(a.rank), ARENA_RANKS.length - 1);
      base.points = num(a.points);
      base.tokens = num(a.tokens);
      base.tickets = Number.isFinite(a.tickets) ? Math.min(TICKET_MAX, num(a.tickets)) : TICKET_MAX;
      base.ticketAt = Number.isFinite(a.ticketAt) ? a.ticketAt : Date.now();
      if (Array.isArray(a.offers)) {
        base.offers = ARENA_CATEGORIES.map((_, i) => {
          const o = a.offers[i];
          const ok = o && typeof o.name === "string" && Number.isFinite(o.level) && PRESETS[o.gear] && Array.isArray(o.dmg) && o.dmg.length === 2 && o.dmg.every(Number.isFinite) && Number.isFinite(o.baseLevel);
          return ok ? { name: o.name, level: o.level, gear: o.gear, dmg: [o.dmg[0], o.dmg[1]], baseLevel: o.baseLevel } : null;
        });
      }
      base.titles = Array.isArray(a.titles) ? a.titles.filter(t => ARENA_TITLES.some(x => x.key === t)) : [];
      base.title = base.titles.includes(a.title) ? a.title : null;
      return base;
    }

    function readSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if ((data.version !== 2 && data.version !== 3 && data.version !== 4) || !JOURNEY[data.index] || !data.player) return null;
        return data;
      } catch (e) {
        return null;
      }
    }

    function clearSave() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* без хранилища очищать нечего */ }
    }

    // Данные вылазки из сохранения проверяем: неизвестное место или точка не должны ломать игру.
    function cleanExpedition(e) {
      const loc = e && LOCATIONS[e.loc];
      if (!loc || !loc.points[e.at]) return null;
      const known = ids => (Array.isArray(ids) ? ids.filter(id => loc.points[id]) : []);
      const items = {};
      for (const k in (e.loot?.items ?? {})) if (ITEMS[k] && e.loot.items[k] > 0) items[k] = e.loot.items[k];
      const start = Object.keys(loc.points).filter(k => loc.points[k].visible);
      return {
        loc: e.loc, at: e.at, mana: Number.isFinite(e.mana) ? e.mana : 0, log: typeof e.log === "string" ? e.log : "",
        visible: [...new Set([...start, ...known(e.visible), e.at])], visited: [...new Set([loc.start, ...known(e.visited)])],
        loot: { copper: Number.isFinite(e.loot?.copper) ? Math.max(0, e.loot.copper) : 0, items }
      };
    }

    function cleanWorld(w) {
      const out = { trips: Number.isFinite(w?.trips) ? Math.max(0, Math.floor(w.trips)) : 0, opened: {} };
      for (const k in (w?.opened ?? {})) if (Number.isFinite(w.opened[k])) out.opened[k] = w.opened[k];
      return out;
    }

    // Предмет из сохранения: в версии 4 это экземпляр-объект, в версиях 2–3 — просто ключ шаблона.
    // Неизвестные или негодные предметы превращаем в null, чтобы игра не сломалась.
    function loadItem(v) {
      if (typeof v === "string") return ITEMS[v] && !isStackable(v) ? makeItem(v) : null;
      return cleanItem(v);
    }

    function loadGame() {
      const s = readSave();
      if (!s) { refreshMenu(); return; }
      try {
        const sp = s.player;
        const p = createHero(cleanName(sp.name), { level: sp.level, strength: sp.strength, endurance: sp.endurance, agility: Number.isFinite(sp.agility) ? sp.agility : BASE_STAT,
          intelligence: Number.isFinite(sp.intelligence) ? sp.intelligence : BASE_STAT, classKey: sp.classKey }, {}, null);
        SLOTS.forEach(slot => { p.equipment[slot.key] = loadItem(sp.equipment?.[slot.key]); });
        p.xp = sp.xp;
        p.pendingPoints = sp.pendingPoints;
        p.inventory = {};
        p.items = Array.isArray(sp.items) ? sp.items.map(cleanItem).filter(Boolean) : [];
        // Рюкзак версий 2–3 хранил и снаряжение стопками «ключ → количество»: addToInventory само разложит его на экземпляры.
        for (const key in sp.inventory) {
          const count = Math.floor(sp.inventory[key]);
          if (ITEMS[key] && count > 0) addToInventory(p, key, count);
        }
        p.health = Math.min(sp.health, p.maxHealth);
        p.copper = sp.copper ?? sp.gold ?? 0; // gold — поле старых сохранений
        p.direction = DIRECTIONS[sp.direction] ? sp.direction : null;
        p.classChosen = sp.classChosen ?? Boolean(sp.direction); // старые сохранения: выбравший направление уже выбрал и класс
        enforceClassGear(p);
        p.spells = Array.isArray(sp.spells) ? sp.spells.filter(k => SPELLS[k]) : (p.classKey === "mage" ? ["arrow"] : []);
        p.arena = cleanArena(sp.arena);
        p.regenAt = Number.isFinite(sp.regenAt) ? sp.regenAt : Date.now();
        refreshDerived(p);
        p.health = Math.min(sp.health, p.maxHealth);
        journey = { index: s.index, player: p, levelsGained: s.levelsGained ?? 0, applied: Boolean(s.applied),
                    phase: s.phase === "capital" ? "capital" : "road" };

        journey.expedition = cleanExpedition(s.expedition);
        journey.world = cleanWorld(s.world);
        if (journey.phase === "capital" && journey.expedition) {
          showExpedition();
        } else if (journey.phase === "capital") {
          showCapital();
        } else if (s.mode === "levelup") {
          showLevelUp();
        } else {
          const stop = JOURNEY[journey.index];
          if (stop.type === "fight") runFight(stop);
          else runStory(stop, journey.applied);
        }
      } catch (e) {
        // Перед удалением оставляем копию: если ошибка в нашем коде, а не в данных, сохранение можно будет спасти.
        try { localStorage.setItem(`${SAVE_KEY}_broken`, localStorage.getItem(SAVE_KEY) ?? ""); } catch (err) { /* копию не сохранить — ничего не поделать */ }
        clearSave();
        journey = null;
        showScreen("menu");
        el("save-info").textContent = "Сохранение не удалось прочитать. Его копия оставлена в браузере под именем _broken.";
      }
    }

    let newGameArmed = false;

    function onNewGameClick() {
      if (readSave() && !newGameArmed) {
        newGameArmed = true;
        el("journey-btn").textContent = "Точно начать заново? Сохранение будет стёрто";
        return;
      }
      newGameArmed = false;
      clearSave();
      startJourney();
    }

    function refreshMenu() {
      newGameArmed = false;
      const save = readSave();
      el("continue-btn").hidden = !save;
      el("journey-btn").textContent = save ? "Начать заново" : "Начать путешествие";
      if (!storageWorks()) {
        el("save-info").textContent = "В этом браузере сохранение недоступно: прогресс не запомнится.";
      } else if (save) {
        el("save-info").textContent = save.phase === "capital"
          ? `Есть сохранение: ${save.player.name}, столица, уровень ${save.player.level}.`
          : `Есть сохранение: этап ${save.index + 1} из ${JOURNEY.length}, уровень ${save.player.level}.`;
      } else {
        el("save-info").textContent = "Игра сохраняется сама.";
      }
    }

    // Имя не пустое и не слишком длинное; пробелы по краям убираем. Выводится только через textContent, поэтому разметка в имени безопасна.
    const DEFAULT_NAME = "Путник";
    function cleanName(raw) {
      const name = String(raw ?? "").trim().slice(0, 20);
      return name || DEFAULT_NAME;
    }

    function startJourney() {
      const player = createHero(cleanName(el("hero-name-input").value), { level: 1, strength: BASE_STAT, endurance: BASE_STAT, agility: BASE_STAT }, {}, null);
      journey = { index: 0, player, levelsGained: 0, applied: false, phase: "road" };
      runStop();
    }

    function progressText() {
      return `Дорога в столицу: этап ${journey.index + 1} из ${JOURNEY.length}`;
    }

    function nextStop() {
      journey.index += 1;
      runStop();
    }

    function runStop() {
      const stop = JOURNEY[journey.index];
      if (stop.type === "fight") runFight(stop);
      else runStory(stop);
    }

    function applyEffect(effect) {
      const p = journey.player;
      const messages = [];
      if (effect?.items) {
        for (const key in effect.items) {
          addToInventory(p, key, effect.items[key]);
          messages.push(`Получено: ${ITEMS[key].name} ×${effect.items[key]}`);
        }
      }
      if (effect?.equip) {
        for (const e of effect.equip) {
          const before = damageText(p);
          addToInventory(p, e.item, 1);
          equipItem(p, e.item, e.slot);
          if (ITEMS[e.item].type === "armor") {
            const z = ARMOR_SLOTS.indexOf(ITEMS[e.item].slot);
            messages.push(`Надето: ${ITEMS[e.item].name}. Броня зоны «${ZONES[z]}»: ${p.gear.armor[z]} (−${armorCutPercent(p.gear.armor[z])}% урона)`);
          } else {
            messages.push(`Надето: ${ITEMS[e.item].name}. Ударов: ${p.gear.strikes}, блоков: ${p.gear.blocks}. Урон за удар: ${before} → ${damageText(p)}`);
          }
        }
      }
      if (effect?.heal) {
        const before = p.health;
        p.health = Math.min(p.maxHealth, p.health + effect.heal);
        messages.push(`Здоровье +${p.health - before}`);
      }
      return messages.join(". ");
    }

    function heroStatusText() {
      const p = journey.player;
      return `${p.name}: уровень ${p.level} (опыт ${p.xp} / ${xpToNext(p.level)}). Здоровье: ${p.health} / ${p.maxHealth}. Деньги: ${formatMoney(p.copper)}. `
           + `Сила ${p.strength}, выносливость ${p.endurance}, ловкость ${p.agility}. Урон за удар: ${damageText(p)}. Надето: ${p.gear.name}.`;
    }

    function runStory(stop, skipEffect) {
      const effectText = skipEffect ? "" : applyEffect(stop.effect);
      journey.applied = true;
      el("story-progress").textContent = progressText();
      el("story-title").textContent = stop.title;
      el("story-text").textContent = stop.text;
      el("story-effect").textContent = effectText;
      el("story-status").textContent = stop.type === "end" ? "" : heroStatusText();
      el("story-btn").textContent = stop.button;
      el("story-btn").onclick = stop.type === "end" ? enterCapital : nextStop;
      saveGame("stop");
      el("story-save-note").textContent = saveStatus === "ok"
        ? "Игра сохранена автоматически."
        : "Сохранение недоступно в этом браузере: прогресс не запомнится.";
      showScreen("story");
    }

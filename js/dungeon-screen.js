    // ======================= ЭКРАН ПОДЗЕМЕЛЬЯ (новый; старый лес живёт отдельно до шага 6) =======================
    // Состояние захода хранится в journey.dungeon:
    // { key, at, visible[], visited[], passed[], bossDown[], looked[], groups{узел: {alive[], keyAt}}, keys[], loot, mana, campLock, deaths, log }.
    // passed — узлы, чьего стража уже победили (путь в них открыт); keys — узлы, чей ключ уже добыт; bossDown — узлы, чей босс убит; looked — узлы, где осмотр за этот заход уже был (один бросок Внимания на узел).
    const DUNGEON_RULES = {
      campEveryFights: 4,      // сколько побед нужно между стоянками (подобрано замером, см. GDD)
      defeatHealthShare: 0.3,  // с каким здоровьем герой очнётся на входе после поражения
      guardXpFactor: 2         // опыт за стража относительно обычного монстра того же вида
    };

    const dungeonNeighbors = (dungeon, id) => dungeon.links.filter(l => l.includes(id)).map(l => (l[0] === id ? l[1] : l[0]));
    // Ворота стоят на узле, в который ведёт переход. Они открываются победой над стражем; ключ нужен, чтобы вызвать стража на бой.
    const dungeonLocked = (state, dungeon, id) => Boolean(dungeon.nodes[id].gate) && !state.passed.includes(id);

    function startDungeon(key) {
      if (!journey.dungeon) {
        const dungeon = DUNGEONS[key];
        const p = journey.player;
        syncRegen(p);
        journey.dungeon = {
          key, at: dungeon.start, visible: Object.keys(dungeon.nodes).filter(id => dungeon.nodes[id].visible), visited: [dungeon.start], passed: [], bossDown: [], looked: [],
          groups: {}, keys: [], loot: { copper: 0, items: {}, gear: [] }, mana: p.maxMana, campLock: 0, deaths: 0, log: dungeon.intro
        };
      }
      showDungeon();
    }

    // Группа монстров узла создаётся при первом входе и запоминается: кто жив и у кого (по номеру) ключ. Носитель выбирается один раз за заход.
    function groupOf(state, dungeon, id) {
      const node = dungeon.nodes[id];
      if (!node.monsters) return null;
      return (state.groups[id] ??= { alive: Array(node.monsters.count).fill(true), keyAt: Math.floor(Math.random() * node.monsters.count) });
    }
    // Денежные суммы заканчиваются точкой («2 мед.»): лишнюю точку в конце предложения не ставим.
    const sentence = text => (text.endsWith(".") ? text : text + ".");
    const aliveCount = group => group.alive.filter(Boolean).length;

    // Рисунок карты: видимые узлы и тропы между ними; текущий залит, посещённые закрашены.
    function dungeonMapSvg(state, dungeon) {
      const xs = state.visible.map(id => dungeon.nodes[id].x), ys = state.visible.map(id => dungeon.nodes[id].y);
      const [vx, vy] = [Math.min(...xs) - 14, Math.min(...ys) - 10];
      const [vw, vh] = [Math.max(...xs) + 14 - vx, Math.max(...ys) + 14 - vy];
      let svg = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" class="map-svg" aria-label="Карта подземелья">`;
      dungeon.links.forEach(([a, b]) => {
        if (state.visible.includes(a) && state.visible.includes(b)) {
          const A = dungeon.nodes[a], B = dungeon.nodes[b];
          svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="map-path"/>`;
        }
      });
      state.visible.forEach(id => {
        const node = dungeon.nodes[id];
        const cls = id === state.at ? "here" : (state.visited.includes(id) ? "seen" : "new");
        svg += `<circle cx="${node.x}" cy="${node.y}" r="${id === state.at ? 4.2 : 3.2}" class="map-node ${cls}"/>`
             + `<text x="${node.x}" y="${node.y + 8.5}" class="map-label">${node.name}</text>`;
      });
      return svg + "</svg>";
    }

    function travelInDungeon(id) {
      const state = journey.dungeon;
      const dungeon = DUNGEONS[state.key];
      if (dungeonLocked(state, dungeon, id)) {
        const gate = dungeon.nodes[id].gate;
        if (state.keys.includes(gate.requires)) { startGuardFight(id); return; }
        state.log = `Путь закрыт. Нужен ключ «${dungeon.nodes[gate.requires].key}»: он есть у одного из монстров места «${dungeon.nodes[gate.requires].name}».`;
        showDungeon();
        return;
      }
      state.at = id;
      if (!state.visited.includes(id)) state.visited.push(id);
      state.log = lookAroundNode(id);
      showDungeon();
    }

    // Что игрок знает о месте: кто здесь обитает и что охраняет путь дальше. Только показ, ничего не меняет.
    function dungeonInfoLines(state, dungeon) {
      const here = dungeon.nodes[state.at];
      const lines = [];
      const group = groupOf(state, dungeon, state.at);
      if (group) {
        const name = WILD_ENEMIES[here.monsters.kind].name;
        lines.push(aliveCount(group) ? `Здесь обитают: ${name} ×${aliveCount(group)}.` : "Здесь больше никого не осталось.");
        lines.push(state.keys.includes(state.at) ? `Ключ «${here.key}» у тебя.` : `Ключ «${here.key}» есть у одного из них, у кого именно, неизвестно.`);
      }
      if (here.boss) lines.push(state.bossDown.includes(state.at) ? "Здесь больше никого нет. Подземелье пройдено." : `Здесь обитает: ${WILD_ENEMIES[here.boss.kind].name}.`);
      dungeonNeighbors(dungeon, state.at).filter(id => state.visible.includes(id)).forEach(id => {
        const node = dungeon.nodes[id];
        if (!dungeonLocked(state, dungeon, id)) return;
        const keyName = dungeon.nodes[node.gate.requires].key;
        lines.push(state.keys.includes(node.gate.requires)
          ? `Путь к месту «${node.name}» охраняет ${node.gate.guard.title}. Ключ «${keyName}» у тебя: можно вызвать стража на бой.`
          : `Путь к месту «${node.name}» охраняет ${node.gate.guard.title}. Чтобы пройти, нужен ключ «${keyName}».`);
      });
      return lines;
    }

    function showDungeon() {
      const p = journey.player;
      const state = journey.dungeon;
      const dungeon = DUNGEONS[state.key];
      const here = dungeon.nodes[state.at];
      const group = groupOf(state, dungeon, state.at);
      el("dun-title").textContent = `${dungeon.name}: ${here.name}`;
      el("dun-text").textContent = here.text;
      el("dun-scene").src = here.image;
      const info = el("dun-info");
      info.replaceChildren();
      dungeonInfoLines(state, dungeon).forEach(line => { const row = document.createElement("p"); row.textContent = line; info.appendChild(row); });
      el("dun-log").textContent = state.log ?? "";
      const extra = [chip(`Добыча: ${lootText(state.loot)}`, "gold", "bag")];
      if (p.maxMana > 0) extra.push(chip(`Мана ${Math.min(state.mana, p.maxMana)} / ${p.maxMana}`, "blue", "flask"));
      setStatus("dun-status", p, extra);
      el("dun-map").innerHTML = dungeonMapSvg(state, dungeon);

      const monsters = el("dun-monsters");
      monsters.replaceChildren();
      if (group) {
        const name = WILD_ENEMIES[here.monsters.kind].name;
        group.alive.forEach((alive, i) => {
          if (!alive) return;
          const card = makeButton(`Напасть: ${name}`, () => startDungeonFight(state.at, i));
          card.className = "monster-card";
          monsters.appendChild(card);
        });
      }

      const bossAlive = Boolean(here.boss) && !state.bossDown.includes(state.at);
      if (bossAlive) {
        const card = makeButton(`Напасть: ${WILD_ENEMIES[here.boss.kind].name}`, () => startBossFight(state.at));
        card.className = "monster-card";
        monsters.appendChild(card);
      }

      const arrows = el("dun-arrows");
      arrows.replaceChildren();
      dungeonNeighbors(dungeon, state.at).filter(id => state.visible.includes(id)).forEach(id => {
        const node = dungeon.nodes[id];
        const dx = node.x - here.x, dy = node.y - here.y;
        const len = Math.hypot(dx, dy);
        const locked = dungeonLocked(state, dungeon, id);
        const guardReady = locked && state.keys.includes(node.gate.requires);
        const btn = makeButton(`${node.name}${guardReady ? " · страж" : locked ? " · закрыто" : ""}`, () => travelInDungeon(id));
        btn.className = `arrow${state.visited.includes(id) ? " seen" : ""}${locked && !guardReady ? " locked" : ""}${guardReady ? " danger" : ""}`;
        btn.style.left = `${Math.min(72, 50 + dx / len * 38)}%`; // не заходим на мини-карту справа
        btn.style.top = `${50 + dy / len * 26}%`;
        arrows.appendChild(btn);
      });

      const campBtn = el("dun-camp-btn");
      const guarded = (Boolean(group) && aliveCount(group) > 0) || bossAlive;
      const kit = hasKit(p);
      const rested = p.health >= p.maxHealth && state.mana >= p.maxMana;
      campBtn.textContent = guarded ? "Лагерь: здесь обитают враги"
        : !kit ? "Лагерь: нужны огниво и спальник"
        : state.campLock > 0 ? `Лагерь: ещё побед — ${state.campLock}`
        : rested ? "Лагерь: ты полон сил"
        : "Разбить лагерь";
      campBtn.disabled = guarded || !kit || state.campLock > 0 || rested;

      const atEntrance = here.kind === "entrance";
      el("dun-home-btn").hidden = !atEntrance;
      el("dun-hint").textContent = atEntrance ? "Если выйдешь к воротам, добыча достанется тебе, а подземелье начнётся заново." : "Выход из подземелья только через опушку: вернись по тропам.";
      saveGame("capital");
      showScreen("dungeon");
    }

    // Осмотр узла: происходит сам при первом входе за заход, один бросок Внимания на узел. Возвращает текст для журнала.
    // Успех: находка узла (тексты, добыча) и открытие скрытых соседей, если они заданы. Неудача: «ничего интересного».
    function lookAroundNode(id) {
      const p = journey.player;
      const state = journey.dungeon;
      const look = DUNGEONS[state.key].nodes[id].look;
      if (!look || state.looked.includes(id)) return "";
      state.looked.push(id); // сначала отмечаем, потом бросаем кубик: перезагрузка не даст бросить дважды
      if (!look.sure && Math.random() * 100 >= watchChanceOf(p)) return pickRandom(look.nothing);
      const parts = [pickRandom(look.found)];
      if (look.loot) {
        const found = rollFindLoot(state, look.loot);
        if (found.copper || Object.keys(found.items).length || found.gear) {
          const gearNote = found.gear && found.gear.bonuses.length ? ` (${bonusLines(found.gear).join(", ")})` : "";
          parts.push(`Ты нашёл: ${lootText({ copper: found.copper, items: found.items, gear: found.gear ? [found.gear] : [] })}${gearNote}`);
        }
      }
      if (look.reveal) {
        const hidden = look.reveal.nodes.filter(n => !state.visible.includes(n));
        if (hidden.length) { state.visible.push(...hidden); parts.push(look.reveal.text); }
      }
      return parts.map(sentence).join(" ");
    }

    // Стоянка. Условия проверяем и здесь, а не только на кнопке. Ночных нападений нет: случайных встреч в подземелье не бывает.
    function makeDungeonCamp() {
      const p = journey.player;
      const state = journey.dungeon;
      const group = state.groups[state.at];
      const boss = DUNGEONS[state.key].nodes[state.at].boss;
      if (!hasKit(p) || state.campLock > 0 || (group && aliveCount(group) > 0) || (boss && !state.bossDown.includes(state.at))) return;
      p.health = p.maxHealth;
      state.mana = p.maxMana;
      state.campLock = DUNGEON_RULES.campEveryFights;
      state.log = "Ты развёл костёр и отдохнул. Здоровье и мана восстановились.";
      showDungeon();
    }

    // Общая часть боя захода (обычный монстр и страж): враг по виду и силе, экран боя, награда и добыча, поражение.
    // onWin вызывается при победе, меняет состояние (кто убит, что открыто) и возвращает текст для журнала.
    // Готовые части (враг, награда, экран боя) общие со старым лесом, правила захода свои.
    function dungeonBattle({ kind, scale, title, intro, xpFactor = 1, onWin }) {
      const p = journey.player;
      const state = journey.dungeon;
      const t = WILD_ENEMIES[kind];
      const foe = createEnemy({ ...makeWildEnemy(kind, p.level, 1, scale), name: title });
      const xp = Math.max(1, Math.round(arenaBaseXp(p.level) * t.xp * xpFactor));
      const fighter = { ...p, name: `${p.name} (ур. ${p.level})`, startMana: Math.min(state.mana, p.maxMana) }; // мана между боями захода не возвращается
      saveGame("capital");
      startBattle(fighter, foe, intro, `Подземелье: ${title}`, outcome => {
        recordFight("wild", outcome);
        state.mana = fighter.mana ?? state.mana;
        if (outcome !== "win") {
          // Ничья: враг остаётся жив. Иначе, если упал носитель ключа, а ключ не выдан, заход стал бы непроходимым.
          showAfterButton("Очнуться на опушке", dungeonDefeat);
          return;
        }
        p.health = fighter.health;
        const note = onWin();
        grantRewards(xp, 0);
        const drops = rollDrops(kind, p.level);
        addLoot(state, drops.copper, drops.items);
        state.campLock = Math.max(0, state.campLock - 1);
        const dropText = (drops.copper > 0 || Object.keys(drops.items).length) ? `, добыча: ${lootText(drops)}` : ", добычи нет";
        state.log = `Победа над врагом «${title}»: опыт +${xp}${sentence(dropText)}${note}`;
        saveGame("capital");
        el("result").textContent = `Победа! опыт +${xp}${sentence(dropText)}${note}` + (journey.levelsGained > 0 ? " Новый уровень!" : "");
        el("player-xp").textContent = `Опыт: ${xpLine(p)}`;
        showAfterButton("Продолжить", () => {
          if (journey.levelsGained > 0) { afterLevelUp = showDungeon; showLevelUp(); } else showDungeon();
        });
      }, []);
      el("player-xp").textContent = `Опыт: ${xpLine(p)}`;
    }

    // Бой с выбранным монстром группы.
    function startDungeonFight(nodeId, index) {
      const state = journey.dungeon;
      const node = DUNGEONS[state.key].nodes[nodeId];
      const group = state.groups[nodeId];
      if (!group || !group.alive[index]) return;
      const t = WILD_ENEMIES[node.monsters.kind];
      dungeonBattle({
        kind: node.monsters.kind, scale: node.monsters.scale, title: t.name, intro: `Из зарослей выходит: ${t.name}.`,
        onWin: () => {
          group.alive[index] = false;
          if (index !== group.keyAt) return "";
          state.keys.push(nodeId);
          return ` Ты нашёл ключ «${node.key}».`;
        }
      });
    }

    // Бой с боссом узла. Добыча босса берётся из его таблицы в WILD_ENEMIES (шкуры, клык вожака, редкие находки с повышенным шансом).
    function startBossFight(nodeId) {
      const state = journey.dungeon;
      const node = DUNGEONS[state.key].nodes[nodeId];
      if (!node.boss || state.bossDown.includes(nodeId)) return;
      const name = WILD_ENEMIES[node.boss.kind].name;
      dungeonBattle({
        kind: node.boss.kind, scale: node.boss.scale, title: name, intro: `Из логова выходит: ${name}.`,
        onWin: () => { state.bossDown.push(nodeId); return " Подземелье пройдено! Можно возвращаться к воротам."; }
      });
    }

    // Бой со стражем на переходе в закрытый узел: победа открывает путь и переносит героя в узел. Ключ при этом остаётся.
    function startGuardFight(nodeId) {
      const state = journey.dungeon;
      const gate = DUNGEONS[state.key].nodes[nodeId].gate;
      if (!state.keys.includes(gate.requires) || state.passed.includes(nodeId)) return;
      dungeonBattle({
        kind: gate.guard.kind, scale: gate.guard.scale, title: gate.guard.title, intro: `Путь преграждает: ${gate.guard.title}.`, xpFactor: DUNGEON_RULES.guardXpFactor,
        onWin: () => {
          state.passed.push(nodeId);
          state.at = nodeId;
          if (!state.visited.includes(nodeId)) state.visited.push(nodeId);
          return ` Путь открыт. ${lookAroundNode(nodeId)}`.trimEnd();
        }
      });
    }

    // Поражение: герой приходит в себя на входе, добыча захода потеряна, убитые монстры и найденные ключи остаются.
    function dungeonDefeat() {
      const p = journey.player;
      const state = journey.dungeon;
      p.health = Math.max(1, Math.floor(p.maxHealth * DUNGEON_RULES.defeatHealthShare));
      state.deaths += 1;
      state.at = DUNGEONS[state.key].start;
      state.loot = { copper: 0, items: {}, gear: [] };
      state.campLock = 0;
      state.log = "Тебя нашли и вынесли на опушку. Всё найденное в походе потеряно, а убитые монстры так и остались убитыми.";
      showDungeon();
    }

    // Выход к воротам: добыча захода переходит к герою, подземелье закрывается (новый заход начнётся с нуля, без ожидания).
    function leaveDungeon() {
      const p = journey.player;
      const loot = journey.dungeon.loot;
      p.copper += loot.copper;
      for (const key in loot.items) addToInventory(p, key, loot.items[key]);
      loot.gear.forEach(inst => p.items.push(inst));
      capitalNote = `Ты вернулся из подземелья. Принёс: ${lootText(loot)}.`;
      p.regenAt = Date.now();
      journey.dungeon = null;
      saveGame("capital");
      showGates();
    }

    // Проверка сохранённого захода при загрузке: что не сходится с данными (подземелье изменилось), отбрасываем, а не ломаем игру.
    function cleanDungeon(raw) {
      const dungeon = raw && DUNGEONS[raw.key];
      if (!dungeon || !dungeon.nodes[raw.at]) return null;
      const list = a => (Array.isArray(a) ? a.filter(id => Boolean(dungeon.nodes[id])) : []);
      const groups = {};
      Object.entries(raw.groups ?? {}).forEach(([id, g]) => {
        const spec = dungeon.nodes[id]?.monsters;
        if (spec && Array.isArray(g?.alive) && g.alive.length === spec.count && Number.isInteger(g.keyAt) && g.keyAt >= 0 && g.keyAt < spec.count) {
          groups[id] = { alive: g.alive.map(Boolean), keyAt: g.keyAt };
        }
      });
      const loot = { copper: Number.isFinite(raw.loot?.copper) ? raw.loot.copper : 0, items: {}, gear: Array.isArray(raw.loot?.gear) ? raw.loot.gear : [] };
      Object.entries(raw.loot?.items ?? {}).forEach(([key, n]) => { if (ITEMS[key] && Number.isFinite(n) && n > 0) loot.items[key] = n; });
      const visible = [...new Set([dungeon.start, raw.at, ...list(raw.visible)])];
      return {
        key: raw.key, at: raw.at, visible, visited: [...new Set([dungeon.start, ...list(raw.visited)])], passed: list(raw.passed).filter(id => Boolean(dungeon.nodes[id].gate)), bossDown: list(raw.bossDown).filter(id => Boolean(dungeon.nodes[id].boss)), looked: list(raw.looked).filter(id => Boolean(dungeon.nodes[id].look)), groups, keys: list(raw.keys), loot,
        mana: Number.isFinite(raw.mana) ? raw.mana : 0, campLock: Number.isInteger(raw.campLock) && raw.campLock >= 0 ? raw.campLock : 0,
        deaths: Number.isInteger(raw.deaths) ? raw.deaths : 0, log: typeof raw.log === "string" ? raw.log : ""
      };
    }

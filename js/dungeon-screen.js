    // ======================= ЭКРАН ПОДЗЕМЕЛЬЯ (новый; старый лес живёт отдельно до шага 6) =======================
    // Состояние захода хранится в journey.dungeon:
    // { key, at, visible[], visited[], passed[], bossDown[], looked[], groups{узел: {alive[], keyAt}}, keys[], gateKeys{ворота: [нужные узлы с ключами]}, gateKnown[ворота, чью загадку игрок уже разгадал], loot, mana, manaAt, camp, deaths, log }.
    // camp: узел, где разбит лагерь (null — лагеря нет); пока герой в этом узле, восстановление идёт быстрее. Любой переход лагерь сворачивает..
    // passed — узлы, чьего стража уже победили (путь в них открыт); keys — узлы, чей ключ уже добыт; bossDown — узлы, чей босс убит; looked — узлы, где осмотр за этот заход уже был (один бросок Внимания на узел).
    const DUNGEON_RULES = {
      campRegenFactor: 3,      // во сколько раз быстрее восстановление, пока разбит лагерь
      defeatHealthShare: 0.3,  // с каким здоровьем герой очнётся на входе после поражения
      guardXpFactor: 2,        // опыт за стража относительно обычного монстра того же вида
      safeRegenSeconds: 180    // сколько секунд реального времени занимает полное восстановление здоровья с нуля в безопасной точке (в городе 600)
    };

    const dungeonNeighbors = (dungeon, id) => dungeon.links.filter(l => l.includes(id)).map(l => (l[0] === id ? l[1] : l[0]));
    // Ворота стоят на узле, в который ведёт переход. Они открываются победой над стражем; ключ нужен, чтобы вызвать стража на бой.
    const dungeonLocked = (state, dungeon, id) => Boolean(dungeon.nodes[id].gate) && !state.passed.includes(id);
    // Какие ключи нужны для ворот: requires — один узел или список узлов, чьи ключи годятся. Если для захода уже выбраны нужные
    // (state.gateKeys[id]), берём их, иначе нужны все из requires. Страж вызывается, когда у героя есть все нужные ключи.
    const gateRequired = (state, node, id) => state.gateKeys?.[id] ?? [].concat(node.gate.requires);
    const gateMissing = (state, node, id) => gateRequired(state, node, id).filter(k => !state.keys.includes(k));
    // Знает ли игрок, какие ключи нужны для ворот. Ворота без загадки (pick) известны сразу; с загадкой узнаются по подсказке (state.gateKnown).
    const gateKnown = (state, node, id) => !node.gate.pick || state.gateKnown.includes(id);
    const keysWord = n => (n === 1 ? "одного ключа" : `ключей: ${n}`);
    // Фраза-подсказка про загадку: какие ключи нужны. Вызывается, когда подсказка найдена.
    function clueLine(state, dungeon, id) {
      const node = dungeon.nodes[id];
      const names = gateRequired(state, node, id).map(k => `«${dungeon.nodes[k].key}»`);
      return names.length === 1 ? `Чтобы пройти к месту «${node.name}», нужен один ключ: ${names[0]}.` : `Чтобы пройти к месту «${node.name}», нужны ключи: ${names.join(", ")}.`;
    }
    const keyPhrase = (dungeon, k) => `«${dungeon.nodes[k].key}» (у одного из монстров места «${dungeon.nodes[k].name}»)`;

    // Загадка ворот: для ворот с pick в начале каждого захода случайно решается, сколько ключей нужно (по весам pick.counts, не больше, чем
    // в requires) и какие именно. Игрок этого заранее не знает. Список хранится в state.gateKeys и переживает перезагрузку.
    const shuffled = list => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    };
    function rollGateFor(node) {
      const pool = [].concat(node.gate.requires);
      const counts = Object.fromEntries(Object.entries(node.gate.pick.counts).filter(([n]) => Number(n) <= pool.length));
      return shuffled(pool).slice(0, Number(pickWeighted(counts)));
    }
    function rollGateKeys(dungeon) {
      const out = {};
      Object.entries(dungeon.nodes).forEach(([id, node]) => { if (node.gate?.pick) out[id] = rollGateFor(node); });
      return out;
    }

    function startDungeon(key) {
      if (!journey.dungeon) {
        const dungeon = DUNGEONS[key];
        const p = journey.player;
        syncRegen(p);
        journey.dungeon = {
          key, at: dungeon.start, visible: Object.keys(dungeon.nodes).filter(id => dungeon.nodes[id].visible), visited: [dungeon.start], passed: [], bossDown: [], looked: [],
          groups: {}, keys: [], gateKeys: rollGateKeys(dungeon), gateKnown: [], loot: { copper: 0, items: {}, gear: [] }, mana: p.maxMana, camp: null, deaths: 0, log: dungeon.intro
        };
        // Осмотр входа происходит сразу: на опушке можно найти записку (первый вход за заход, как в любом другом узле).
        const first = lookAroundNode(dungeon.start);
        if (first) journey.dungeon.log = `${dungeon.intro} ${first}`;
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
    // Безопасная точка: никто не обитает (монстры перебиты, босс убит или его там не было). Считается на лету из того, что уже хранится.
    function nodeIsSafe(state, dungeon, id) {
      const node = dungeon.nodes[id];
      const group = groupOf(state, dungeon, id);
      const monstersLeft = Boolean(group) && aliveCount(group) > 0;
      const bossLeft = Boolean(node.boss) && !state.bossDown.includes(id);
      return !monstersLeft && !bossLeft;
    }
    // Подземелье пройдено, когда побеждены все его боссы (и хотя бы один босс в нём есть). Тогда выйти к воротам можно с любого места.
    const dungeonCleared = (state, dungeon) => {
      const bosses = Object.keys(dungeon.nodes).filter(id => dungeon.nodes[id].boss);
      return bosses.length > 0 && bosses.every(id => state.bossDown.includes(id));
    };

    // Рисунок карты: видимые узлы и тропы между ними; текущий залит, посещённые закрашены.
    function dungeonMapSvg(state, dungeon) {
      const xs = state.visible.map(id => dungeon.nodes[id].x), ys = state.visible.map(id => dungeon.nodes[id].y);
      const [vx, vy] = [Math.min(...xs) - 26, Math.min(...ys) - 10]; // по бокам запас шире: подписи мест длиннее, чем кружки
      const [vw, vh] = [Math.max(...xs) + 26 - vx, Math.max(...ys) + 14 - vy];
      let svg = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" class="map-svg" aria-label="Карта подземелья">`;
      dungeon.links.forEach(([a, b]) => {
        if (state.visible.includes(a) && state.visible.includes(b)) {
          const A = dungeon.nodes[a], B = dungeon.nodes[b];
          svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="map-path"/>`;
        }
      });
      // Места, куда ведёт тропа из текущего, кликабельны (тот же переход, что в панели «Куда идти»); остальные только показаны.
      const goable = new Set(dungeonNeighbors(dungeon, state.at));
      state.visible.forEach(id => {
        const node = dungeon.nodes[id];
        const cls = id === state.at ? "here" : (state.visited.includes(id) ? "seen" : "new");
        const body = `<circle cx="${node.x}" cy="${node.y}" r="7" class="map-hit"/>`
                   + `<circle cx="${node.x}" cy="${node.y}" r="${id === state.at ? 4.2 : 3.2}" class="map-node ${cls}"/>`
                   + `<text x="${node.x}" y="${node.y + 8.5}" class="map-label">${node.name}</text>`;
        svg += goable.has(id) ? `<g class="map-go" data-go="${id}">${body}</g>` : `<g>${body}</g>`;
      });
      return svg + "</svg>";
    }

    function travelInDungeon(id) {
      const state = journey.dungeon;
      const dungeon = DUNGEONS[state.key];
      if (dungeonLocked(state, dungeon, id)) {
        const node = dungeon.nodes[id];
        const missing = gateMissing(state, node, id);
        if (!missing.length) { startGuardFight(id); return; }
        if (gateKnown(state, node, id)) {
          state.log = `Путь закрыт. Не хватает ${missing.length > 1 ? "ключей" : "ключа"}: ${missing.map(k => keyPhrase(dungeon, k)).join(", ")}.`;
        } else {
          // Загадка не разгадана: ворота не называют нужные ключи, но говорят, какие из имеющихся не подходят и сколько ещё не хватает.
          const needed = gateRequired(state, node, id);
          const wrong = [].concat(node.gate.requires).filter(k => state.keys.includes(k) && !needed.includes(k));
          const parts = ["Ворота не открываются."];
          if (wrong.length) parts.push(`Ключ ${wrong.map(k => `«${dungeon.nodes[k].key}»`).join(", ")} не подходит.`);
          parts.push(`Не хватает ещё ${keysWord(missing.length)}.`);
          state.log = parts.join(" ");
        }
        showDungeon();
        return;
      }
      state.at = id;
      state.camp = null;
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
        const missing = gateMissing(state, node, id);
        if (!gateKnown(state, node, id)) { lines.push(`Путь к месту «${node.name}» охраняет ${node.gate.guard.title}. Какие ключи нужны, ты пока не знаешь: ищи подсказку.`); return; }
        lines.push(!missing.length
          ? `Путь к месту «${node.name}» охраняет ${node.gate.guard.title}. Нужные ключи у тебя: можно вызвать стража на бой.`
          : `Путь к месту «${node.name}» охраняет ${node.gate.guard.title}. Чтобы пройти, не хватает ${missing.length > 1 ? "ключей" : "ключа"}: ${missing.map(k => `«${dungeon.nodes[k].key}»`).join(", ")}.`);
      });
      return lines;
    }

    // Что игрок знает о месте, куда ведёт тропа: пометка и стиль кнопки. Про места, где ещё не был, враги неизвестны (группа создаётся при первом входе).
    function exitTag(state, dungeon, id) {
      const node = dungeon.nodes[id];
      if (dungeonLocked(state, dungeon, id)) return gateMissing(state, node, id).length ? { text: "закрыто: нужны ключи", kind: "locked" } : { text: "ключи есть: вызвать стража", kind: "danger" };
      if (!state.visited.includes(id)) return { text: "ещё не был", kind: "" };
      const group = state.groups[id];
      if (group && aliveCount(group) > 0) return { text: `были враги ×${aliveCount(group)}`, kind: "seen danger" };
      if (node.boss && !state.bossDown.includes(id)) return { text: "логово", kind: "seen danger" };
      return { text: "безопасно", kind: "seen safe" };
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

      // Панель «Куда идти»: все тропы из этого места списком, с пометкой, что там известно.
      const exits = el("dun-exits");
      exits.replaceChildren();
      const exitIds = dungeonNeighbors(dungeon, state.at).filter(id => state.visible.includes(id));
      if (exitIds.length) {
        const title = document.createElement("h3");
        title.textContent = "Куда идти";
        exits.appendChild(title);
      }
      exitIds.forEach(id => {
        const { text, kind } = exitTag(state, dungeon, id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `exit-btn ${kind}`;
        const name = document.createElement("span");
        name.className = "exit-name";
        name.textContent = dungeon.nodes[id].name;
        const tag = document.createElement("span");
        tag.className = "exit-tag";
        tag.textContent = text;
        btn.append(name, tag);
        btn.addEventListener("click", () => travelInDungeon(id));
        exits.appendChild(btn);
      });

      const campBtn = el("dun-camp-btn");
      const guarded = (Boolean(group) && aliveCount(group) > 0) || bossAlive;
      const kit = hasKit(p);
      const rested = p.health >= p.maxHealth && state.mana >= p.maxMana;
      const camped = state.camp === state.at;
      campBtn.textContent = guarded ? "Лагерь: здесь обитают враги"
        : !kit ? "Лагерь: нужны огниво и спальник"
        : camped ? "Лагерь разбит: отдых идёт быстрее"
        : rested ? "Лагерь: ты полон сил"
        : "Разбить лагерь";
      campBtn.disabled = guarded || !kit || camped || rested;

      const atEntrance = here.kind === "entrance";
      const cleared = dungeonCleared(state, dungeon);
      el("dun-home-btn").hidden = !(atEntrance || cleared);
      el("dun-hint").textContent = (atEntrance || cleared) ? "Если выйдешь к воротам, добыча достанется тебе, а подземелье начнётся заново." : "Выход из подземелья только через опушку: вернись по тропам.";
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
      if (look.clue && !state.gateKnown.includes(look.clue)) {
        state.gateKnown.push(look.clue);
        parts.push(clueLine(state, DUNGEONS[state.key], look.clue));
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
      if (!hasKit(p) || state.camp === state.at || !nodeIsSafe(state, DUNGEONS[state.key], state.at)) return;
      syncRegen(p); // сначала засчитываем отдых до лагеря по прежней скорости, потом скорость меняется
      state.camp = state.at;
      state.log = "Ты развёл костёр и устроился на отдых. Здоровье и мана восстанавливаются быстрее, пока ты здесь. Любой переход сворачивает лагерь.";
      showDungeon();
    }

    // Общая часть боя захода (обычный монстр и страж): враг по виду и силе, экран боя, награда и добыча, поражение.
    // onWin вызывается при победе, меняет состояние (кто убит, что открыто) и возвращает текст для журнала.
    // Готовые части (враг, награда, экран боя) общие со старым лесом, правила захода свои.
    function dungeonBattle({ kind, scale, title, intro, xpFactor = 1, onWin }) {
      const p = journey.player;
      const state = journey.dungeon;
      const t = WILD_ENEMIES[kind];
      const foeLevel = Math.min(p.level, DUNGEONS[state.key].maxEnemyLevel ?? Infinity); // потолок уровня врагов подземелья
      // ВРЕМЕННО для проверки боя по намерениям: такой волк силён по уровню героя, иначе потолок леса делает бой пустым.
      // Награда и добыча по-прежнему считаются от foeLevel, поэтому лишнего опыта это не даёт.
      const fightLevel = useIntentBattle(p, kind) ? p.level : foeLevel;
      const foe = createEnemy({ ...makeWildEnemy(kind, fightLevel, 1, scale), name: title });
      const xp = Math.max(1, Math.round(arenaBaseXp(foeLevel) * t.xp * xpFactor));
      const fighter = { ...p, name: `${p.name} (ур. ${p.level})`, startMana: Math.min(state.mana, p.maxMana) }; // мана между боями захода не возвращается
      saveGame("capital");
      const finish = outcome => {
        recordFight("wild", outcome);
        p.regenAt = Date.now(); // время боя не засчитывается как отдых
        state.manaAt = Date.now();
        state.mana = fighter.mana ?? state.mana;
        if (outcome !== "win") {
          // Ничья: враг остаётся жив. Иначе, если упал носитель ключа, а ключ не выдан, заход стал бы непроходимым.
          showAfterButton("Очнуться на опушке", dungeonDefeat);
          return;
        }
        p.health = fighter.health;
        const note = onWin();
        grantRewards(xp, 0);
        const drops = rollDrops(kind, foeLevel);
        addLoot(state, drops.copper, drops.items);
        const dropText = (drops.copper > 0 || Object.keys(drops.items).length) ? `, добыча: ${lootText(drops)}` : ", добычи нет";
        state.log = `Победа над врагом «${title}»: опыт +${xp}${sentence(dropText)}${note}`;
        saveGame("capital");
        el("result").textContent = `Победа! опыт +${xp}${sentence(dropText)}${note}` + (journey.levelsGained > 0 ? " Новый уровень!" : "");
        el("player-xp").textContent = `Опыт: ${xpLine(p)}`;
        showAfterButton("Продолжить", () => {
          if (journey.levelsGained > 0) { afterLevelUp = showDungeon; showLevelUp(); } else showDungeon();
        });
      };
      // Волк и маг идут по новому бою по намерениям (прототип), остальные по старому с зонами.
      if (useIntentBattle(fighter, kind)) startIntentBattle(fighter, foe, kind, intro, `Подземелье: ${title}`, finish);
      else startBattle(fighter, foe, intro, `Подземелье: ${title}`, finish, []);
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
      const node = DUNGEONS[state.key].nodes[nodeId];
      const gate = node.gate;
      if (gateMissing(state, node, nodeId).length || state.passed.includes(nodeId)) return;
      dungeonBattle({
        kind: gate.guard.kind, scale: gate.guard.scale, title: gate.guard.title, intro: `Путь преграждает: ${gate.guard.title}.`, xpFactor: DUNGEON_RULES.guardXpFactor,
        onWin: () => {
          state.passed.push(nodeId);
          state.at = nodeId;
          state.camp = null;
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
      p.regenAt = Date.now();
      state.manaAt = Date.now();
      state.loot = { copper: 0, items: {}, gear: [] };
      state.camp = null;
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
      // Выбранные ключи ворот: берём сохранённые, если они согласуются с данными (подземелье могло измениться), иначе бросаем заново.
      const gateKeys = {};
      Object.entries(dungeon.nodes).forEach(([id, node]) => {
        if (!node.gate?.pick) return;
        const pool = [].concat(node.gate.requires);
        const saved = raw.gateKeys?.[id];
        const fine = Array.isArray(saved) && saved.length >= 1 && new Set(saved).size === saved.length && saved.every(k => pool.includes(k));
        gateKeys[id] = fine ? saved : rollGateFor(node);
      });
      const gateKnown = list(raw.gateKnown).filter(id => Boolean(dungeon.nodes[id].gate?.pick));
      return {
        key: raw.key, at: raw.at, gateKeys, gateKnown, visible, visited: [...new Set([dungeon.start, ...list(raw.visited)])], passed: list(raw.passed).filter(id => Boolean(dungeon.nodes[id].gate)), bossDown: list(raw.bossDown).filter(id => Boolean(dungeon.nodes[id].boss)), looked: list(raw.looked).filter(id => Boolean(dungeon.nodes[id].look)), groups, keys: list(raw.keys), loot,
        mana: Number.isFinite(raw.mana) ? raw.mana : 0, camp: raw.camp === raw.at ? raw.camp : null,
        deaths: Number.isInteger(raw.deaths) ? raw.deaths : 0, log: typeof raw.log === "string" ? raw.log : ""
      };
    }

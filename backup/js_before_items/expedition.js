    // ======================= ВЫЛАЗКИ ЗА ГОРОД =======================
    // Место — это карта из точек, соединённых тропами. Часть точек видна сразу, остальные скрыты, пока их не найдёшь.
    // В пути между точками возможна случайная встреча. Всё найденное лежит в «добыче похода» и становится твоим,
    // только если вернуться в город через выход; поражение в вылазке добычу отнимает.
    const EXPEDITION = {
      encounterChance: 0.45,   // шанс встречи в пути между точками
      lookEncounterChance: 0.2, // шанс встречи, пока осматриваешься
      revealChance: 0.6,       // шанс найти скрытую точку по соседству
      defeatHealthShare: 0.3   // с каким здоровьем герой очнётся в городе после поражения
    };

    // Враги вылазок. hp и dmg — множители к бойцу арены того же уровня (у зверя один удар, поэтому dmg выше).
    // drops: шанс (0…1) и количество; copper — множитель к базовой денежной награде уровня.
    const WILD_ENEMIES = {
      wolf:   { name: "Волк", gear: "none", hp: 0.8, dmg: 1.4, xp: 0.8, drops: [{ item: "wolfPelt", chance: 0.45, min: 1, max: 1 }] },
      boar:   { name: "Кабан", gear: "none", hp: 1.0, dmg: 1.2, xp: 0.9, drops: [{ item: "boarTusk", chance: 0.4, min: 1, max: 2 }] },
      bandit: { name: "Лесной разбойник", gear: "weapon", hp: 1.0, dmg: 1.3, xp: 1.0, armored: true, drops: [{ copper: true, chance: 0.55, min: 0.1, max: 1.5 }, { copper: true, chance: 0.06, min: 3, max: 6 }] },
      leader: { name: "Вожак стаи", gear: "none", hp: 1.6, dmg: 1.8, xp: 2.0, rareBoost: 3, armored: true, drops: [{ item: "wolfPelt", chance: 1, min: 1, max: 2 }, { item: "leaderFang", chance: 0.6, min: 1, max: 1 }] }
    };

    // Точки места. links — тропы (в обе стороны); visible — видна с начала; kind: exit — выход в город.
    // first — событие при первом приходе в вылазке: fight (бой).
    // find — находка, которую игрок открывает кнопкой; copper — множитель к базовой награде;
    // respawn — через сколько вылазок после открытия здесь снова появится добыча.
    const LOCATIONS = {
      forest: {
        name: "Тёмный лес",
        intro: "За городскими воротами начинается лес. Тропы расходятся в разные стороны, и не все их видно сразу.",
        encounters: ["wolf", "wolf", "boar", "bandit"],
        start: "edge",
        points: {
          edge:     { name: "Опушка",             x: 50, y: 90, visible: true,  kind: "exit",  text: "Здесь кончается дорога от городских ворот. Отсюда можно вернуться в город." },
          clearing: { name: "Поляна",             x: 24, y: 64, visible: true,  kind: "place", text: "Солнечная поляна с высокой травой.", find: { label: "Осмотреть траву", title: "Высокая трава", respawn: 1, copper: [0.2, 0.8], items: { bread: 1 }, itemChance: 0.4 } },
          brook:    { name: "Ручей",              x: 76, y: 64, visible: true,  kind: "place", text: "Быстрый ручей. На влажной земле видны следы зверей.", find: { label: "Поискать у воды", title: "Берег ручья", respawn: 1, copper: [0, 0.4] } },
          oak:      { name: "Старый дуб",         x: 10, y: 40, visible: false, kind: "place", text: "Огромный дуб, в дупле которого кто-то оставил сундучок.", find: { label: "Открыть сундучок", title: "Сундучок в дупле", respawn: 4, copper: [1.0, 2.5], rareBoost: 4 } },
          hut:      { name: "Заброшенная сторожка", x: 44, y: 30, visible: false, kind: "place", text: "Покосившаяся сторожка лесника. Давно никто не заходил.", find: { label: "Обыскать сторожку", title: "Сторожка", respawn: 2, copper: [0.3, 1.2], items: { bread: 2 }, itemChance: 0.7 } },
          wolfpath: { name: "Волчья тропа",       x: 76, y: 20, visible: false, kind: "place", text: "Тропа, вытоптанная лапами. Здесь живёт вожак стаи.", first: { type: "fight", enemy: "leader" } }
        },
        links: [["edge", "clearing"], ["edge", "brook"], ["clearing", "oak"], ["clearing", "hut"], ["brook", "wolfpath"], ["hut", "wolfpath"]]
      }
    };

    // Данные вылазки хранятся в journey.expedition: { loc, at, visible[], visited[], loot{copper, items}, mana, log }.
    const neighborsOf = (loc, id) => loc.links.filter(l => l.includes(id)).map(l => (l[0] === id ? l[1] : l[0]));
    const rand = (a, b) => a + Math.random() * (b - a);
    let capitalNote = "";
    let afterLevelUp = null;

    function startExpedition(locKey) {
      const p = journey.player;
      if (!journey.expedition) {
        const loc = LOCATIONS[locKey];
        syncRegen(p);
        worldState().trips += 1;
        journey.expedition = {
          loc: locKey, at: loc.start, mana: p.maxMana, log: loc.intro,
          visible: Object.keys(loc.points).filter(k => loc.points[k].visible),
          visited: [loc.start], loot: { copper: 0, items: {} }
        };
        saveGame("capital");
      }
      showExpedition();
    }

    // Редкость: ★ — необычное, ★★ — редкое. Это только пометка и цена, силы предметам не добавляет.
    const RARITY_STARS = { uncommon: "★", rare: "★★" };
    function rarityMark(key) { return RARITY_STARS[ITEMS[key].rarity] ?? ""; }

    function lootText(loot) {
      const parts = [];
      if (loot.copper > 0) parts.push(formatMoney(loot.copper));
      for (const key in loot.items) if (loot.items[key] > 0) parts.push(`${rarityMark(key)}${ITEMS[key].name} ×${loot.items[key]}`.trim());
      return parts.length ? parts.join(", ") : "пока ничего";
    }

    function addLoot(exp, copper, items) {
      exp.loot.copper += copper;
      for (const key in (items ?? {})) exp.loot.items[key] = (exp.loot.items[key] ?? 0) + items[key];
    }

    // Рисунок карты: видимые точки и тропы между ними; текущая точка залита, посещённые обведены.
    function mapSvg(exp, loc) {
      // Рамка карты подгоняется под видимые точки, чтобы не оставалось пустого места.
      const xs = exp.visible.map(id => loc.points[id].x), ys = exp.visible.map(id => loc.points[id].y);
      // Не уже 70×55 условных единиц, иначе при двух-трёх точках подписи становятся огромными.
      const fit = (lo, hi, min) => { let a = lo, b = hi; if (b - a < min) { const mid = (a + b) / 2; a = mid - min / 2; b = mid + min / 2; } return [a, b - a]; };
      const [vx, vw] = fit(Math.min(...xs) - 14, Math.max(...xs) + 14, 70);
      const [vy, vh] = fit(Math.min(...ys) - 10, Math.max(...ys) + 14, 55);
      let svg = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" class="map-svg" aria-label="Карта места">`;
      loc.links.forEach(([a, b]) => {
        if (exp.visible.includes(a) && exp.visible.includes(b)) {
          const A = loc.points[a], B = loc.points[b];
          svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="map-path"/>`;
        }
      });
      exp.visible.forEach(id => {
        const pt = loc.points[id];
        const cls = id === exp.at ? "here" : (exp.visited.includes(id) ? "seen" : "new");
        svg += `<circle cx="${pt.x}" cy="${pt.y}" r="${id === exp.at ? 4.2 : 3.2}" class="map-node ${cls}"/>`
             + `<text x="${pt.x}" y="${pt.y + 8.5}" class="map-label">${pt.name}</text>`;
      });
      return svg + "</svg>";
    }

    function showExpedition() {
      const p = journey.player;
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      const here = loc.points[exp.at];
      exp.returning = false;
      el("exp-title").textContent = `${loc.name}: ${here.name}`;
      el("exp-text").textContent = here.text;
      const extra = [chip(`Добыча: ${lootText(exp.loot)}`, "gold", "bag")];
      if (p.maxMana > 0) extra.push(chip(`Мана ${exp.mana} / ${p.maxMana}`, "blue", "flask"));
      setStatus("exp-status", p, extra);
      el("exp-map").innerHTML = mapSvg(exp, loc);
      el("exp-log").textContent = exp.log ?? "";

      const findBox = el("exp-find");
      findBox.replaceChildren();
      if (here.find) {
        const ready = findReady(exp, exp.at);
        findBox.appendChild(infoCard({ icon: "bag", title: here.find.title,
          sub: ready ? "Здесь есть что осмотреть." : "Пусто. Ты уже забрал отсюда всё, что было.",
          cls: ready ? "promo-card" : "", buttons: ready ? [makeButton(here.find.label, () => openFind(exp.at))] : [] }));
      }

      const moves = el("exp-moves");
      moves.replaceChildren();
      neighborsOf(loc, exp.at).filter(id => exp.visible.includes(id)).forEach(id => {
        const pt = loc.points[id];
        const seen = exp.visited.includes(id);
        moves.appendChild(infoCard({ icon: "tree", title: pt.name, sub: seen ? "Ты здесь уже бывал." : "Не исследовано.", cls: seen ? "" : "promo-card",
          buttons: [makeButton("Идти", () => travelTo(id))] }));
      });
      const hasHidden = neighborsOf(loc, exp.at).some(id => !exp.visible.includes(id));
      el("exp-look-btn").disabled = !hasHidden;
      el("exp-look-btn").textContent = hasHidden ? "Осмотреться" : "Осмотреться (здесь всё видно)";
      const way = pathHome(exp, loc);
      el("exp-home-btn").hidden = false;
      el("exp-home-btn").textContent = way.length ? `Вернуться в город (переходов: ${way.length})` : "Вернуться в город";
      el("exp-home-hint").textContent = way.length ? "Дорога домой идёт через Опушку, по пути возможны встречи." : "";
      saveGame("capital");
      showScreen("expedition");
    }

    // Показываем, что нашли, и сохраняем это в журнале вылазки.
    function setExpLog(text) { journey.expedition.log = text; }

    // Состояние мира живёт между вылазками: счётчик вылазок и когда какая находка была открыта.
    function worldState() { return (journey.world ??= { trips: 0, opened: {} }); }
    function findReady(exp, id) {
      const spec = LOCATIONS[exp.loc].points[id].find;
      const openedAt = worldState().opened[`${exp.loc}:${id}`];
      return openedAt === undefined || worldState().trips - openedAt >= spec.respawn;
    }

    function openFind(id) {
      const exp = journey.expedition;
      const pt = LOCATIONS[exp.loc].points[id];
      if (!pt.find || !findReady(exp, id)) return;
      worldState().opened[`${exp.loc}:${id}`] = worldState().trips; // сначала отмечаем, потом бросаем кубик: перезагрузка не даст открыть дважды
      const found = rollFindLoot(exp, pt.find);
      const nothing = !found.copper && !Object.keys(found.items).length;
      exp.log = nothing ? `${pt.find.title}: пусто.` : `${pt.find.title}: ты нашёл ${lootText(found)}.`;
      showExpedition();
    }

    function rollFindLoot(exp, spec) {
      const unit = arenaBaseMoney(journey.player.level);
      const copper = spec.copper ? Math.round(unit * rand(spec.copper[0], spec.copper[1])) : 0;
      const items = (spec.items && Math.random() < (spec.itemChance ?? 1)) ? { ...spec.items } : {};
      const rare = rollRare(spec.rareBoost ?? 0.5);
      for (const k in rare) items[k] = (items[k] ?? 0) + rare[k];
      addLoot(exp, copper, items);
      return { copper, items };
    }

    function travelTo(id) {
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      const name = loc.points[id].name;
      setExpLog("");
      if (Math.random() < EXPEDITION.encounterChance) {
        const roll = Math.random();
        if (roll < 0.6) { // встреча с врагом
          const kind = loc.encounters[Math.floor(Math.random() * loc.encounters.length)];
          startWildFight(kind, `По пути к месту «${name}» на тебя нападают.`, () => arriveAt(id));
          return;
        }
        if (roll < 0.85) { // находка в пути
          const found = rollFindLoot(exp, { copper: [0.1, 0.6], items: { bread: 1 }, itemChance: 0.3 });
          setExpLog(`По пути ты нашёл: ${lootText({ copper: found.copper, items: found.items }) }.`);
        } else {
          setExpLog("Дорога спокойная: ты слышишь только птиц.");
        }
      }
      arriveAt(id);
    }

    function arriveAt(id) {
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      const pt = loc.points[id];
      exp.at = id;
      if (exp.returning && id === loc.start) { exp.returning = false; expeditionHome(); return; }
      const firstTime = !exp.visited.includes(id);
      if (firstTime) exp.visited.push(id);
      // Придя в точку, можно заметить скрытые тропы рядом.
      const newly = revealAround(exp, loc, id);
      const notes = [];
      if (exp.log) notes.push(exp.log);
      if (newly.length) notes.push(`Ты заметил новые места: ${newly.join(", ")}.`);
      exp.log = notes.join(" ");
      if (firstTime && pt.first) {
        if (pt.first.type === "fight") {
          startWildFight(pt.first.enemy, `${pt.name}: ты не один.`, () => { showExpedition(); });
          return;
        }
      }
      if (exp.returning) { // продолжаем путь домой
        const next = pathHome(exp, loc)[0];
        if (next) { travelTo(next); return; }
        exp.returning = false;
      }
      showExpedition();
    }

    function revealAround(exp, loc, id) {
      const names = [];
      neighborsOf(loc, id).filter(n => !exp.visible.includes(n)).forEach(n => {
        if (Math.random() < EXPEDITION.revealChance) { exp.visible.push(n); names.push(loc.points[n].name); }
      });
      return names;
    }

    function lookAround() {
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      setExpLog("");
      if (Math.random() < EXPEDITION.lookEncounterChance) {
        const kind = loc.encounters[Math.floor(Math.random() * loc.encounters.length)];
        startWildFight(kind, "Пока ты осматривался, кто-то подкрался.", () => showExpedition());
        return;
      }
      const newly = revealAround(exp, loc, exp.at);
      setExpLog(newly.length ? `Ты заметил новые места: ${newly.join(", ")}.` : "Ты внимательно осмотрелся, но ничего нового не нашёл. Можно попробовать ещё раз.");
      showExpedition();
    }

    function makeWildEnemy(kind, level) {
      const t = WILD_ENEMIES[kind];
      const L = Math.max(1, level);
      const base = arenaFighterStats(L).dmg;
      return {
        name: t.name, gear: t.gear, health: Math.round((25 + 9 * L) * t.hp), magicResist: Math.floor(0.4 * L),
        dmg: [Math.round(base[0] * t.dmg), Math.round(base[1] * t.dmg)],
        armor: t.armored ? [Math.floor(0.4 * L), Math.floor(0.6 * L), Math.floor(0.4 * L), Math.floor(0.3 * L)] : null
      };
    }

    // Редкие находки: шанс срабатывает на каждую победу и на каждую находку в точке.
    // boost умножает шансы (вожак, сундуки).
    const RARE_POOL = { uncommon: { chance: 0.08, items: ["amber"] }, rare: { chance: 0.03, items: ["oldRing", "goldNugget"] } };
    function rollRare(boost = 1) {
      const out = {};
      for (const tier of ["rare", "uncommon"]) {
        const t = RARE_POOL[tier];
        if (Math.random() < t.chance * boost) { out[t.items[Math.floor(Math.random() * t.items.length)]] = 1; break; }
      }
      return out;
    }

    function rollDrops(kind, level) {
      const t = WILD_ENEMIES[kind];
      const unit = arenaBaseMoney(level);
      const out = { copper: 0, items: {} };
      t.drops.forEach(d => {
        if (Math.random() >= d.chance) return;
        if (d.copper) out.copper += Math.round(unit * rand(d.min, d.max));
        else out.items[d.item] = (out.items[d.item] ?? 0) + Math.floor(rand(d.min, d.max + 0.999));
      });
      const rare = rollRare(WILD_ENEMIES[kind].rareBoost ?? 1);
      for (const k in rare) out.items[k] = (out.items[k] ?? 0) + rare[k];
      return out;
    }

    function startWildFight(kind, introText, onWin) {
      const p = journey.player;
      const exp = journey.expedition;
      const def = makeWildEnemy(kind, p.level);
      const t = WILD_ENEMIES[kind];
      const xp = Math.max(1, Math.round(arenaBaseXp(p.level) * t.xp));
      const fighter = { ...p, name: `${p.name} (ур. ${p.level})`, startMana: exp.mana }; // мана между боями вылазки не возвращается
      const bot = createEnemy(def);
      saveGame("capital");
      startBattle(fighter, bot, introText, `Вылазка: ${t.name}`, outcome => {
        exp.mana = fighter.mana ?? exp.mana;
        if (outcome === "win") {
          p.health = fighter.health;
          grantRewards(xp, 0);
          const drops = rollDrops(kind, p.level);
          addLoot(exp, drops.copper, drops.items);
          const dropText = (drops.copper > 0 || Object.keys(drops.items).length) ? `, добыча: ${lootText(drops)}` : ", добычи нет";
          exp.log = `Победа над врагом «${t.name}»: опыт +${xp}${dropText}.`;
          saveGame("capital");
          el("result").textContent = `Победа! опыт +${xp}${dropText}` + (journey.levelsGained > 0 ? ". Новый уровень!" : "");
          el("player-xp").textContent = `Опыт: ${p.xp} / ${xpToNext(p.level)}`;
          showAfterButton("Продолжить", () => {
            if (journey.levelsGained > 0) { afterLevelUp = onWin; showLevelUp(); } else onWin();
          });
        } else {
          showAfterButton("Очнуться в городе", expeditionDefeat);
        }
      });
      el("player-xp").textContent = `Опыт: ${p.xp} / ${xpToNext(p.level)}`;
    }

    function expeditionDefeat() {
      const p = journey.player;
      p.health = Math.max(1, Math.floor(p.maxHealth * EXPEDITION.defeatHealthShare));
      p.regenAt = Date.now();
      journey.expedition = null;
      capitalNote = "Тебя нашли в лесу и принесли в город. Всё найденное в походе потеряно.";
      saveGame("capital");
      showCapital();
    }

    // Кратчайший путь от текущей точки до выхода по уже известным тропам (поиск в ширину); пустой, если ты уже на выходе.
    function pathHome(exp, loc) {
      if (exp.at === loc.start) return [];
      const prev = { [exp.at]: null };
      const queue = [exp.at];
      while (queue.length) {
        const cur = queue.shift();
        if (cur === loc.start) break;
        neighborsOf(loc, cur).filter(n => exp.visible.includes(n) && !(n in prev)).forEach(n => { prev[n] = cur; queue.push(n); });
      }
      const path = [];
      for (let at = loc.start; at !== exp.at && at in prev; at = prev[at]) path.unshift(at);
      return path;
    }

    // Нажатие «Вернуться в город»: на выходе сразу домой, иначе идём к выходу шаг за шагом (на каждом шаге возможна встреча).
    function goHome() {
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      const way = pathHome(exp, loc);
      if (way.length === 0) { expeditionHome(); return; }
      exp.returning = true;
      travelTo(way[0]);
    }

    function expeditionHome() {
      const p = journey.player;
      const loot = journey.expedition.loot;
      p.copper += loot.copper;
      for (const key in loot.items) addToInventory(p, key, loot.items[key]);
      capitalNote = `Ты вернулся из вылазки. Принёс: ${lootText(loot)}.`;
      p.regenAt = Date.now();
      journey.expedition = null;
      saveGame("capital");
      showCapital();
    }

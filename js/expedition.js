    // ======================= ВЫЛАЗКИ ЗА ГОРОД =======================
    // Место — это карта из точек, соединённых тропами. Часть точек видна сразу, остальные скрыты, пока их не найдёшь.
    // В пути между точками возможна случайная встреча. Всё найденное лежит в «добыче похода» и становится твоим,
    // только если выйти к воротам через вход; поражение добычу отнимает, но из места не выбрасывает.
    const EXPEDITION = {
      encounterChance: 0.45,   // шанс встречи в пути между точками
      lookEncounterChance: 0.2, // шанс встречи, пока осматриваешься
      revealChance: 0.6,       // шанс найти скрытую точку по соседству
      defeatHealthShare: 0.3,  // с каким здоровьем герой очнётся на входе после поражения
      campCooldown: 2,         // сколько переходов между точками нужно после стоянки, чтобы встать снова
      campAmbush: 0.30,        // шанс ночного нападения, если у точки нет своего числа (camp.ambush)
      walkedFactor: 0.4,       // во сколько раз реже встречи в пути, когда идёшь на уже посещённое место
      stashShares: [0.5, 0.25, 0.1], // какая доля добычи остаётся схроном при 1-й, 2-й и следующих смертях за вылазку
      respawnMs: 10 * 60 * 1000 // через сколько после выхода к воротам место обновляется: враги возвращаются, находки появляются снова
    };

    // Враги вылазок. hp и dmg — множители к бойцу арены того же уровня (у зверя один удар, поэтому dmg выше).
    // style — привычки врага: strike/block — веса зон (Голова, Корпус, Пояс, Ноги; 1 — обычно), react — как сильно он реагирует на твой прошлый ход.
    // xp — множитель к опыту равного боя на арене: в лесу опыта больше, потому что нет лечения между боями и поражение отнимает добычу.
    // drops: шанс (0…1) и количество; copper — множитель к базовой денежной награде уровня.
    // Общий множитель урона диких врагов: ручка сложности, подобрана замерами (при ×1 бои с обычными врагами были почти непроигрываемыми).
    const WILD_DMG_FACTOR = 1.5;
    // Участник пачки слабее одиночного врага: бой идёт по очереди, и без этого пачка из N была бы в N раз тяжелее одиночки.
    const PACK_MEMBER = 0.75;
    const WILD_ENEMIES = {
      wolf:   { name: "Волк", gear: "none", traits: { agility: 0.6, attention: 0.25, strength: 0.15 }, hp: 0.8, dmg: 1.4, xp: 1.2, style: { strike: [0.6, 1, 1.2, 1.6], react: 0.4 }, drops: [{ item: "wolfPelt", chance: 0.45, min: 1, max: 1 }] },
      boar:   { name: "Кабан", gear: "none", traits: { strength: 0.45, endurance: 0.4, attention: 0.15 }, hp: 1.0, dmg: 1.2, xp: 1.3, style: { strike: [0.7, 1.8, 1, 0.8], react: 0.3 }, drops: [{ item: "boarTusk", chance: 0.4, min: 1, max: 2 }] },
      bandit: { name: "Лесной разбойник", gear: "weapon", traits: { attention: 0.5, agility: 0.25, endurance: 0.25 }, hp: 1.0, dmg: 1.3, xp: 1.5, style: { strike: [1.5, 1.3, 0.8, 0.6], block: [1.8, 1, 0.8, 0.6], react: 0.6 }, armored: true, drops: [{ copper: true, chance: 0.55, min: 0.1, max: 1.5 }, { copper: true, chance: 0.06, min: 3, max: 6 }] },
      leader: { name: "Вожак стаи", gear: "none", traits: { agility: 0.3, strength: 0.25, endurance: 0.25, attention: 0.2 }, hp: 1.6, dmg: 1.8, xp: 3.0, style: { react: 0.8 }, rareBoost: 3, armored: true, drops: [{ item: "wolfPelt", chance: 1, min: 1, max: 2 }, { item: "leaderFang", chance: 0.6, min: 1, max: 1 }] }
    };

    // Точки места. links — тропы (в обе стороны); visible — видна с начала; kind: exit — выход к городским воротам.
    // resident — ключ врага из WILD_ENEMIES, который живёт в точке, пока его не убьют (список убитых — exp.defeated).
    // find — находка, которую игрок открывает кнопкой; copper — множитель к базовой награде;
    const LOCATIONS = {
      forest: {
        name: "Тёмный лес",
        intro: "За городскими воротами начинается лес. Тропы расходятся в разные стороны, и не все их видно сразу.",
        // Бродячие звери встречаются где угодно; посыльные приходят ночью к лагерю, только пока живы в своём логове (враг: точка).
        wanderers: ["wolf", "wolf", "boar"],
        raiders: { bandit: "hut" },
        start: "edge",
        backLabel: "К опушке", // подпись кнопки пути к стартовой точке с других точек (слово склоняется, поэтому в данных)
        points: {
          edge:     { name: "Опушка",             x: 50, y: 90, image: "img/forest/path1.jpg", camp: { ambush: 0.15 }, visible: true,  kind: "exit",  text: "Здесь кончается дорога от городских ворот. Отсюда можно вернуться к воротам." },
          clearing: { name: "Поляна",             x: 24, y: 64, image: "img/forest/path2.jpg", resident: "wolf", pack: [2, 3], visible: true,  kind: "place", text: "Солнечная поляна с высокой травой.", find: { label: "Осмотреть траву", title: "Высокая трава", copper: [0.2, 0.8], items: { bread: 1 }, itemChance: 0.4 } },
          brook:    { name: "Ручей",              x: 76, y: 64, image: "img/forest/path2.jpg", resident: "boar", visible: true,  kind: "place", text: "Быстрый ручей. На влажной земле видны следы зверей.", find: { label: "Поискать у воды", title: "Берег ручья", copper: [0, 0.4] } },
          oak:      { name: "Старый дуб",         x: 10, y: 40, image: "img/forest/oak.jpg", visible: false, kind: "place", text: "Огромный дуб, в дупле которого кто-то оставил сундучок.", find: { label: "Открыть сундучок", title: "Сундучок в дупле", copper: [1.0, 2.5], rareBoost: 4 } },
          hut:      { name: "Заброшенная сторожка", x: 44, y: 30, image: "img/forest/tower.jpg", resident: "bandit", visible: false, kind: "place", camp: { ambush: 0.45 }, text: "Покосившаяся сторожка лесника. Давно никто не заходил.", find: { label: "Обыскать сторожку", title: "Сторожка", copper: [0.3, 1.2], items: { bread: 2 }, itemChance: 0.7,
            gear: { chance: 0.35, rarity: { common: 70, uncommon: 25, rare: 5 } } } },
          wolfpath: { name: "Волчья тропа",       x: 76, y: 20, image: "img/forest/path1.jpg", resident: "leader", visible: false, kind: "place", text: "Тропа, вытоптанная лапами. Здесь живёт вожак стаи." }
        },
        links: [["edge", "clearing"], ["edge", "brook"], ["clearing", "oak"], ["clearing", "hut"], ["brook", "wolfpath"], ["hut", "wolfpath"]]
      }
    };

    // Данные вылазки хранятся в journey.expedition: { loc, at, visible[], visited[], loot{copper, items}, mana, log }.
    const campSpecOf = pt => pt.camp ?? { ambush: EXPEDITION.campAmbush };
    // Ключ врага, если он ещё живёт в точке; иначе null.
    const residentAlive = (exp, id) => {
      const key = LOCATIONS[exp.loc].points[id].resident;
      return key && !exp.defeated.includes(id) ? key : null;
    };
    const foeLabel = enc => WILD_ENEMIES[enc.kind].name + (enc.count > 1 ? ` ×${enc.count}` : "");
    const pickRandom = list => list[Math.floor(Math.random() * list.length)];
    const nightAttackerOf = (exp, loc) => {
      const pool = [...loc.wanderers];
      for (const kind in loc.raiders) if (residentAlive(exp, loc.raiders[kind]) === kind) pool.push(kind);
      return pickRandom(pool);
    };
    const neighborsOf = (loc, id) => loc.links.filter(l => l.includes(id)).map(l => (l[0] === id ? l[1] : l[0]));
    const rand = (a, b) => a + Math.random() * (b - a);
    let capitalNote = "";
    let afterLevelUp = null;

    // Вылазка засчитывается, только если в ней был бой или находка: выйти и сразу вернуться откаты не двигает.
    // Подземелье не меняется: после первой настоящей вылазки (даже закончившейся поражением) карта известна целиком.
    function finishTrip(exp) {
      if (!exp.acted) return;
      const world = worldState();
      world.trips += 1;
      (world.known ??= {})[exp.loc] = true;
      // Выход закрывает инстанс: с этой отметки идут respawnMs до обновления места. Время считаем по отметке, поэтому это работает и пока игра закрыта.
      (world.instances ??= {})[exp.loc] = { closedAt: Date.now(), defeated: [...exp.defeated], opened: [...exp.opened] };
    }

    // Состояние места, оставленное прошлой вылазкой, если оно ещё не обновилось; иначе null (место свежее).
    // age >= 0 защищает от часов, переведённых назад: иначе место держалось бы закрытым вечно.
    function instanceOf(locKey) {
      const inst = worldState().instances?.[locKey];
      const age = inst ? Date.now() - inst.closedAt : Infinity;
      return age >= 0 && age < EXPEDITION.respawnMs ? inst : null;
    }

    function startExpedition(locKey) {
      const p = journey.player;
      if (!journey.expedition) {
        const loc = LOCATIONS[locKey];
        syncRegen(p);
        const kept = instanceOf(locKey);
        journey.expedition = {
          loc: locKey, at: loc.start, mana: p.maxMana, log: loc.intro,
          visible: worldState().known?.[locKey] ? Object.keys(loc.points) : Object.keys(loc.points).filter(k => loc.points[k].visible),
          visited: [loc.start], defeated: [...(kept?.defeated ?? [])], opened: [...(kept?.opened ?? [])], acted: false, campLock: 0, deaths: 0, stashes: {}, encounter: null, loot: { copper: 0, items: {}, gear: [] }
        };
        saveGame("capital");
      }
      showExpedition();
    }

    // Редкость: ★ — необычное, ★★ — редкое. Это только пометка и цена, силы предметам не добавляет.
    const RARITY_STARS = { uncommon: "★", rare: "★★", unique: "★★★" };
    function rarityMark(key) { return RARITY_STARS[ITEMS[key].rarity] ?? ""; }

    function lootText(loot) {
      const parts = [];
      if (loot.copper > 0) parts.push(formatMoney(loot.copper));
      for (const key in loot.items) if (loot.items[key] > 0) parts.push(`${rarityMark(key)}${ITEMS[key].name} ×${loot.items[key]}`.trim());
      (loot.gear ?? []).forEach(inst => parts.push(instName(inst)));
      return parts.length ? parts.join(", ") : "пока ничего";
    }

    function addLoot(exp, copper, items, gear) {
      exp.loot.copper += copper;
      if (gear) (exp.loot.gear ??= []).push(gear);
      for (const key in (items ?? {})) exp.loot.items[key] = (exp.loot.items[key] ?? 0) + items[key];
    }

    // Доля добычи для схрона. Снаряжение не делится пополам: каждая вещь остаётся с вероятностью, равной доле.
    // Стопки предметов округляем случайно (floor(n*доля + случайное 0…1)), чтобы в среднем возвращалась ровно доля, даже у мелких стопок.
    function shareOfLoot(loot, share) {
      const part = { copper: Math.floor(loot.copper * share), items: {}, gear: loot.gear.filter(() => Math.random() < share) };
      for (const key in loot.items) {
        const n = Math.floor(loot.items[key] * share + Math.random());
        if (n > 0) part.items[key] = n;
      }
      return part;
    }

    // Подбор схрона: сначала убираем его из списка, потом переносим добычу, чтобы перезагрузка не дала взять дважды.
    function takeStash() {
      const exp = journey.expedition;
      const stash = exp.stashes[exp.at];
      if (!stash) return;
      delete exp.stashes[exp.at];
      addLoot(exp, stash.copper, stash.items);
      exp.loot.gear.push(...stash.gear);
      exp.log = `Ты подобрал оставшееся: ${lootText(stash)}.`;
      saveGame("capital");
      showExpedition();
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
        if (exp.stashes[id]) svg += `<circle cx="${pt.x}" cy="${pt.y}" r="6.4" class="map-stash"/>`;
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
      const scene = el("exp-scene");
      scene.hidden = !here.image;
      if (here.image) scene.src = here.image;
      const extra = [chip(`Добыча: ${lootText(exp.loot)}`, "gold", "bag")];
      if (p.maxMana > 0) extra.push(chip(`Мана ${Math.min(exp.mana, p.maxMana)} / ${p.maxMana}`, "blue", "flask"));
      setStatus("exp-status", p, extra);
      el("exp-map").innerHTML = mapSvg(exp, loc);
      el("exp-log").textContent = exp.log ?? "";

      const stashBtn = el("exp-stash-btn");
      const stash = exp.stashes[exp.at];
      stashBtn.hidden = !stash;
      if (stash) {
        stashBtn.textContent = `Подобрать оставшееся: ${lootText(stash)}`;
        stashBtn.onclick = takeStash;
      }

      const findBtn = el("exp-find-btn");
      findBtn.hidden = !here.find;
      if (here.find) {
        const ready = findReady(exp, exp.at);
        findBtn.textContent = ready ? here.find.label : `${here.find.title}: пусто`;
        findBtn.disabled = !ready;
        findBtn.onclick = () => openFind(exp.at);
      }

      const campBtn = el("exp-camp-btn");
      campBtn.hidden = false;
      const guarded = residentAlive(exp, exp.at);
      const kit = hasKit(p);
      const locked = exp.campLock > 0;
      const rested = p.health >= p.maxHealth && exp.mana >= p.maxMana;
      campBtn.textContent = guarded ? "Лагерь: здесь обитает враг"
        : !kit ? "Лагерь: нужны огниво и спальник"
        : locked ? `Лагерь: ещё переходов — ${exp.campLock}`
        : rested ? "Лагерь: ты полон сил"
        : "Разбить лагерь";
      campBtn.disabled = Boolean(guarded) || !kit || locked || rested;
      campBtn.onclick = makeCamp;

      const arrows = el("exp-arrows");
      arrows.replaceChildren();
      neighborsOf(loc, exp.at).filter(id => exp.visible.includes(id)).forEach(id => {
        const pt = loc.points[id];
        const dx = pt.x - here.x, dy = pt.y - here.y;
        const len = Math.hypot(dx, dy);
        const foe = residentAlive(exp, id) ? WILD_ENEMIES[pt.resident].name : "";
        const btn = makeButton(`${pt.name}${foe ? " · " + foe : ""}${exp.stashes[id] ? " · схрон" : ""}`, () => travelTo(id));
        btn.className = `arrow${exp.visited.includes(id) ? " seen" : ""}${foe ? " danger" : ""}`;
        btn.style.left = `${50 + dx / len * 38}%`;
        btn.style.top = `${50 + dy / len * 26}%`;
        arrows.appendChild(btn);
      });
      const hasHidden = neighborsOf(loc, exp.at).some(id => !exp.visible.includes(id));
      el("exp-look-btn").disabled = !hasHidden;
      el("exp-look-btn").textContent = hasHidden ? "Осмотреться" : "Осмотреться (здесь всё видно)";
      const way = pathHome(exp, loc);
      el("exp-home-btn").hidden = false;
      el("exp-home-btn").textContent = way.length ? `${loc.backLabel} (переходов: ${way.length})` : "К воротам";
      el("exp-look-btn").hidden = false;
      el("exp-home-hint").textContent = way.length ? "Дорога к Опушке идёт по тропам, по пути возможны встречи." : `Если выйдешь к воротам, лес закроется и через ${EXPEDITION.respawnMs / 60000} мин обновится.` + (Object.keys(exp.stashes).length ? " Невзятые схроны пропадут." : "");
      // Замеченный враг: вместо обычных действий — выбор, пока он не сделан, ничего другого нельзя.
      const encBox = el("exp-encounter");
      encBox.replaceChildren();
      encBox.hidden = !exp.encounter;
      if (exp.encounter) {
        const resident = exp.encounter.resident;
        const foeName = foeLabel(exp.encounter);
        encBox.appendChild(infoCard({ icon: "sword", title: resident ? `${loc.points[exp.encounter.to].name}: ${foeName}` : `Впереди: ${foeName}`, sub: resident ? "Он здесь обитает и тебя пока не заметил. Что делаешь?" : "Он тебя не заметил. Что делаешь?", cls: "promo-card",
          buttons: [makeButton("Напасть первым", () => resolveEncounter("strike")),
            makeButton(`Пройти незамеченным (${sneakChanceOf(p)}%)`, () => resolveEncounter("sneak")),
            makeButton(resident ? "Передумать" : "Переждать", () => resolveEncounter("wait"))] }));
        arrows.replaceChildren();
        findBtn.hidden = true;
        campBtn.hidden = true;
        el("exp-look-btn").hidden = true;
        el("exp-home-btn").hidden = true;
        el("exp-home-hint").textContent = "";
      }
      saveGame("capital");
      showScreen("expedition");
    }

    // Для лагеря нужны оба предмета набора путешественника.
    const hasKit = p => (p.inventory.flint ?? 0) > 0 && (p.inventory.bedroll ?? 0) > 0;

    // Ночь в лагере: заметил ли герой признаки опасности (Внимание) и нападут ли на него.
    // Если признаки замечены, шанс нападения падает в CAMP.signsFactor раз. Только считает, ничего не меняет в игре.
    function rollCampNight(p, spec) {
      const signs = Math.random() * 100 < watchChanceOf(p);
      const chance = spec.ambush * (signs ? CAMP.signsFactor : 1);
      return { signs, ambush: Math.random() < chance };
    }

    // Восстановление после ночи: здоровье, мана вылазки, пауза до следующей стоянки.
    function restAtCamp(p, exp, note) {
      p.health = p.maxHealth;
      exp.mana = p.maxMana;
      exp.campLock = EXPEDITION.campCooldown;
      setExpLog(note);
    }

    // Стоянка. Условия проверяем и здесь, а не только на кнопке. Ночью могут напасть: бой идёт с текущим здоровьем,
    // враг бьёт сильнее (CAMP.nightDmgBonus). Победа даёт полный отдых, поражение — как обычное поражение в вылазке.
    function makeCamp() {
      const p = journey.player;
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      if (residentAlive(exp, exp.at) || exp.campLock > 0 || !hasKit(p)) return;
      const spec = campSpecOf(loc.points[exp.at]);
      const night = rollCampNight(p, spec);
      const signsNote = night.signs ? "Ты заметил свежие следы и устроился осторожно. " : "";
      if (!night.ambush) {
        restAtCamp(p, exp, `${signsNote}Ты развёл костёр и спокойно переночевал. Здоровье и мана восстановились.`);
        showExpedition();
        return;
      }
      const kind = nightAttackerOf(exp, loc);
      startWildFight(kind, `${signsNote}Среди ночи на лагерь нападают, враг бьёт сильнее: ты не успел собраться.`, () => {
        restAtCamp(p, exp, `${exp.log} Остаток ночи прошёл спокойно: ты полностью отдохнул.`);
        showExpedition();
      }, { dmgBonus: CAMP.nightDmgBonus });
    }

    // Показываем, что нашли, и сохраняем это в журнале вылазки.
    function setExpLog(text) { journey.expedition.log = text; }

    // Состояние мира живёт между вылазками: счётчик вылазок, какие места известны и состояние закрытых инстансов (instances).
    function worldState() { return (journey.world ??= { trips: 0 }); }
    function findReady(exp, id) { return !exp.opened.includes(id); }

    function openFind(id) {
      const exp = journey.expedition;
      const pt = LOCATIONS[exp.loc].points[id];
      if (!pt.find || !findReady(exp, id)) return;
      exp.acted = true; // находка делает вылазку «настоящей»: она засчитается при возвращении
      exp.opened.push(id); // сначала отмечаем, потом бросаем кубик: перезагрузка не даст открыть дважды
      const found = rollFindLoot(exp, pt.find);
      // Внимание: с шансом noticeChanceOf рядом находится ещё немного денег или обычной добычи точки (без редкого и снаряжения).
      const extra = Math.random() * 100 < noticeChanceOf(journey.player) ? rollBasicLoot(pt.find) : null;
      if (extra) addLoot(exp, extra.copper, extra.items);
      const hasExtra = extra && (extra.copper > 0 || Object.keys(extra.items).length > 0);
      const extraNote = hasExtra ? ` Рядом ты заметил ещё: ${lootText(extra)}.` : "";
      const nothing = !found.copper && !Object.keys(found.items).length && !found.gear;
      // Про найденное снаряжение пишем и его бонусы: узнать их можно сразу, а не только в рюкзаке.
      const gearNote = found.gear && found.gear.bonuses.length ? ` (${bonusLines(found.gear).join(", ")})` : "";
      exp.log = nothing ? `${pt.find.title}: пусто.` : `${pt.find.title}: ты нашёл ${lootText({ copper: found.copper, items: found.items, gear: found.gear ? [found.gear] : [] })}${gearNote}.`;
      exp.log += extraNote;
      showExpedition();
    }

    // Снаряжение, которое может найтись: то, что продаётся в магазине на уровне героя и ниже.
    // Так находка не обгонит магазин по базе, а силу ей добавляют только редкость и бонусы.
    function gearPoolFor(level) {
      const keys = [];
      SHOP_STOCK.forEach(tier => {
        if (tier.minLevel > level) return;
        tier.items.forEach(k => { if (!isStackable(k) && !keys.includes(k)) keys.push(k); });
      });
      return keys;
    }

    // Выбор по весам: { common: 70, uncommon: 25, rare: 5 } — ключ с вероятностью, пропорциональной своему весу.
    function pickWeighted(weights) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      for (const key in weights) {
        roll -= weights[key];
        if (roll < 0) return key;
      }
      return Object.keys(weights)[0]; // страховка от погрешности вычислений
    }

    // Бросок снаряжения для находки: с шансом spec.chance вообще что-то есть, тип любой (для любого класса), редкость по весам.
    function rollGearFind(spec, level) {
      if (Math.random() >= spec.chance) return null;
      const pool = gearPoolFor(level);
      const base = pool[Math.floor(Math.random() * pool.length)];
      return rollItem(base, pickWeighted(spec.rarity));
    }

    // Деньги и обычные предметы точки: общая часть основной находки и «заметил ещё» (Внимание).
    function rollBasicLoot(spec) {
      const unit = arenaBaseMoney(journey.player.level);
      const copper = spec.copper ? Math.round(unit * rand(spec.copper[0], spec.copper[1])) : 0;
      const items = (spec.items && Math.random() < (spec.itemChance ?? 1)) ? { ...spec.items } : {};
      return { copper, items };
    }

    function rollFindLoot(exp, spec) {
      const { copper, items } = rollBasicLoot(spec);
      const rare = rollRare(spec.rareBoost ?? 0.5);
      for (const k in rare) items[k] = (items[k] ?? 0) + rare[k];
      const gear = spec.gear ? rollGearFind(spec.gear, journey.player.level) : null;
      addLoot(exp, copper, items, gear);
      return { copper, items, gear };
    }

    // Выбор при замеченном враге. encounter сбрасываем сразу: игра сохраняется в начале боя, и перезагрузка не вернёт к выбору.
    function resolveEncounter(choice) {
      const exp = journey.expedition;
      const enc = exp.encounter;
      if (!enc) return;
      exp.encounter = null;
      const name = foeLabel(enc);
      const kinds = Array(enc.count ?? 1).fill(enc.kind);
      const proceed = () => { exp.returning = enc.returning; arriveAt(enc.to); }; // после боя или удачного обхода идём дальше к цели
      const markSlain = () => { exp.defeated.push(enc.to); }; // убитый обитатель не появляется до конца вылазки и возвращается по времени
      const won = enc.resident ? () => { markSlain(); proceed(); } : proceed;
      const drawOpts = enc.resident ? { onDraw: markSlain } : {};
      if (choice === "strike") {
        startWildFight(kinds, `Ты напал первым: ${name} не ждал тебя.`, won, { surprise: true, where: enc.to, ...drawOpts });
        return;
      }
      if (choice === "sneak") {
        if (Math.random() * 100 < sneakChanceOf(journey.player)) {
          setExpLog(enc.resident ? `Ты прокрался на место: ${name} тебя не заметил.` : `Ты прокрался мимо: ${name} тебя не заметил.`);
          proceed();
          return;
        }
        startWildFight(kinds, `Тебя заметили: ${name} бросается на тебя, враг бьёт сильнее.`, won, { dmgBonus: SNEAK.failDmgBonus, where: enc.to, ...drawOpts });
        return;
      }
      setExpLog(enc.resident ? "Ты передумал идти туда и остался на месте." : `Ты затаился, и ${name} ушёл своей дорогой. Придётся идти к цели заново.`);
      showExpedition();
    }

    function travelTo(id) {
      const exp = journey.expedition;
      const loc = LOCATIONS[exp.loc];
      const name = loc.points[id].name;
      setExpLog("");
      if (exp.campLock > 0) exp.campLock -= 1; // каждый переход приближает следующую стоянку
      const resident = residentAlive(exp, id);
      if (resident) {
        const spec = loc.points[id].pack;
        const count = spec ? Math.floor(rand(spec[0], spec[1] + 0.999)) : 1;
        exp.encounter = { kind: resident, count, to: id, returning: Boolean(exp.returning), resident: true };
        setExpLog(`В месте «${name}» обитает ${foeLabel(exp.encounter)}.`);
        showExpedition();
        return;
      }
      if (Math.random() < EXPEDITION.encounterChance * (exp.visited.includes(id) ? EXPEDITION.walkedFactor : 1)) {
        const roll = Math.random();
        if (roll < 0.6) { // встреча с врагом
          const kind = pickRandom(loc.wanderers);
          // Внимание: с шансом watchChanceOf враг замечен раньше, чем он заметил героя, и герой выбирает, что делать.
          if (Math.random() * 100 < watchChanceOf(journey.player)) {
            exp.encounter = { kind, to: id, returning: Boolean(exp.returning) };
            setExpLog(`Ты заметил впереди: ${WILD_ENEMIES[kind].name}. Он тебя пока не видит.`);
            showExpedition();
            return;
          }
          startWildFight(kind, `По пути к месту «${name}» на тебя нападают.`, () => arriveAt(id), { where: id });
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
      const firstTime = !exp.visited.includes(id);
      if (firstTime) exp.visited.push(id);
      // Придя в точку, можно заметить скрытые тропы рядом.
      const newly = revealAround(exp, loc, id);
      const notes = [];
      if (exp.log) notes.push(exp.log);
      if (newly.length) notes.push(`Ты заметил новые места: ${newly.join(", ")}.`);
      exp.log = notes.join(" ");
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
        const kind = pickRandom(loc.wanderers);
        startWildFight(kind, "Пока ты осматривался, кто-то подкрался.", () => showExpedition());
        return;
      }
      const newly = revealAround(exp, loc, exp.at);
      setExpLog(newly.length ? `Ты заметил новые места: ${newly.join(", ")}.` : "Ты внимательно осмотрелся, но ничего нового не нашёл. Можно попробовать ещё раз.");
      showExpedition();
    }

    function makeWildEnemy(kind, level, dmgBonus = 1, scale = 1) { // dmgBonus: множитель урона врага (ночное нападение), обычно 1; scale: общая сила (участник пачки)
      const t = WILD_ENEMIES[kind];
      const L = Math.max(1, level);
      const base = arenaFighterStats(L).dmg;
      const pts = enemyPoints(L, t.traits ?? {});
      return {
        name: t.name, style: t.style, gear: t.gear, health: Math.round((25 + 9 * L) * t.hp * scale), magicResist: Math.floor(0.4 * L),
        dmg: [Math.round(base[0] * t.dmg * WILD_DMG_FACTOR * dmgBonus * scale), Math.round(base[1] * t.dmg * WILD_DMG_FACTOR * dmgBonus * scale)],
        armor: t.armored ? [Math.floor(0.4 * L), Math.floor(0.6 * L), Math.floor(0.4 * L), Math.floor(0.3 * L)] : null,
        dodge: pts.agility ?? 0, critRating: pts.agility ?? 0, accuracy: pts.attention ?? 0, critResist: pts.endurance ?? 0,
        penetration: (pts.strength ?? 0) * PENETRATION_PER_STRENGTH
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

    function startWildFight(kind, introText, onWin, opts = {}) {
      const p = journey.player;
      const exp = journey.expedition;
      const kinds = [].concat(kind); // одиночный враг приходит строкой, пачка массивом
      const foes = kinds.map(k => createEnemy(makeWildEnemy(k, p.level, opts.dmgBonus ?? 1, kinds.length > 1 ? PACK_MEMBER : 1)));
      const bot = foes[0];
      const reserve = foes.slice(1);
      const t = WILD_ENEMIES[kinds[0]];
      const xp = kinds.reduce((sum, k) => sum + Math.max(1, Math.round(arenaBaseXp(p.level) * WILD_ENEMIES[k].xp)), 0);
      const fighter = { ...p, name: `${p.name} (ур. ${p.level})`, startMana: Math.min(exp.mana, p.maxMana) }; // мана между боями вылазки не возвращается
      if (opts.surprise) bot.surprised = 1; // враг пропускает первый ход (см. playTurn)
      exp.acted = true;
      saveGame("capital");
      startBattle(fighter, bot, introText, `Вылазка: ${t.name}` + (kinds.length > 1 ? ` и ещё ${kinds.length - 1}` : ""), outcome => {
        recordFight("wild", outcome);
        exp.mana = fighter.mana ?? exp.mana;
        if (outcome === "win") {
          p.health = fighter.health;
          grantRewards(xp, 0);
          const drops = { copper: 0, items: {} };
          kinds.forEach(k => {
            const d = rollDrops(k, p.level);
            drops.copper += d.copper;
            for (const item in d.items) drops.items[item] = (drops.items[item] ?? 0) + d.items[item];
          });
          addLoot(exp, drops.copper, drops.items);
          const dropText = (drops.copper > 0 || Object.keys(drops.items).length) ? `, добыча: ${lootText(drops)}` : ", добычи нет";
          exp.log = `${kinds.length > 1 ? "Победа над пачкой: " + kinds.map(k => WILD_ENEMIES[k].name).join(", ") : `Победа над врагом «${t.name}»`}: опыт +${xp}${dropText}.`;
          saveGame("capital");
          el("result").textContent = `Победа! опыт +${xp}${dropText}` + (journey.levelsGained > 0 ? ". Новый уровень!" : "");
          el("player-xp").textContent = `Опыт: ${p.xp} / ${xpToNext(p.level)}`;
          showAfterButton("Продолжить", () => {
            if (journey.levelsGained > 0) { afterLevelUp = onWin; showLevelUp(); } else onWin();
          });
        } else {
          if (outcome === "draw") opts.onDraw?.(); // ничья: враг тоже упал
          showAfterButton("Очнуться на Опушке", () => expeditionDefeat(opts.where ?? exp.at));
        }
      }, reserve);
      el("player-xp").textContent = `Опыт: ${p.xp} / ${xpToNext(p.level)}`;
    }

    // Поражение не выбрасывает из места: герой приходит в себя на входе, вылазка продолжается, добыча потеряна.
    function expeditionDefeat(where) {
      const p = journey.player;
      const exp = journey.expedition;
      p.health = Math.max(1, Math.floor(p.maxHealth * EXPEDITION.defeatHealthShare));
      // Часть добычи остаётся в точке, где герой упал; с каждой смертью за вылазку доля меньше.
      const share = EXPEDITION.stashShares[Math.min(exp.deaths, EXPEDITION.stashShares.length - 1)];
      exp.deaths += 1;
      const kept = shareOfLoot(exp.loot, share);
      const hasKept = kept.copper > 0 || kept.gear.length > 0 || Object.keys(kept.items).length > 0;
      if (hasKept) {
        const stash = (exp.stashes[where] ??= { copper: 0, items: {}, gear: [] });
        stash.copper += kept.copper;
        kept.gear.forEach(g => stash.gear.push(g));
        for (const key in kept.items) stash.items[key] = (stash.items[key] ?? 0) + kept.items[key];
      }
      exp.at = LOCATIONS[exp.loc].start;
      exp.loot = { copper: 0, items: {}, gear: [] };
      exp.encounter = null;
      exp.returning = false;
      exp.campLock = 0;
      exp.log = hasKept
        ? `Тебя нашли и вынесли на Опушку. Часть добычи осталась в месте «${LOCATIONS[exp.loc].points[where].name}», остальное потеряно.`
        : "Тебя нашли и вынесли на Опушку. Всё найденное в походе потеряно.";
      saveGame("capital");
      showExpedition();
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

    // Нажатие кнопки выхода: на Опушке выходим к воротам, иначе идём к Опушке шаг за шагом (на каждом шаге возможна встреча).
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
      (loot.gear ?? []).forEach(inst => p.items.push(inst));
      capitalNote = `Ты вернулся из вылазки. Принёс: ${lootText(loot)}.`;
      p.regenAt = Date.now();
      finishTrip(journey.expedition);
      journey.expedition = null;
      saveGame("capital");
      showGates();
    }

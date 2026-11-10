    // ----- Экран «Герой и рюкзак» -----
    function barPercent(value, max) {
      return Math.min(100, value / max * 100) + "%";
    }

    function makeButton(text, handler, disabled) {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.disabled = Boolean(disabled);
      btn.addEventListener("click", handler);
      return btn;
    }

    function makeRow(labelText, buttons, labelClass) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("span");
      label.textContent = labelText;
      if (labelClass) label.className = labelClass;
      const holder = document.createElement("div");
      holder.className = "btns";
      buttons.forEach(b => holder.appendChild(b));
      row.append(label, holder);
      return row;
    }

    // Экран героя длинный: после смены снаряжения показываем итог сверху и прокручиваем наверх,
    // иначе кажется, что кнопка внизу ничего не сделала.
    let heroMessage = "";
    function heroAction(change, what) {
      const p = journey.player;
      change();
      heroMessage = `${what}. Ударов: ${p.gear.strikes}, блоков: ${p.gear.blocks}. Урон за удар: ${damageText(p)}. Броня: ${p.gear.armor.join("/")}.`;
      renderHero();
      window.scrollTo(0, 0);
    }

    // Вкладка экрана героя запоминается: после надевания вещи экран не должен прыгать обратно на характеристики.
    let heroTab = "stats";
    const HERO_TABS = [
      { key: "stats", name: "Характеристики" },
      { key: "details", name: "Подробно" },
      { key: "equipment", name: "Снаряжение" },
      { key: "skills", name: "Умения" },
      { key: "bag", name: "Рюкзак" },
      { key: "journal", name: "Журнал" }
    ];

    // Небольшая «фабрика» элементов: тег, класс, текст.
    function mk(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    // Карточка с заголовком, большим числом и пояснением; extra — необязательные кнопки.
    function statCard(title, big, sub, cls, buttons, iconName) {
      const card = mk("div", `card ${cls ?? ""}`);
      const top = mk("div", "card-top");
      if (iconName) top.appendChild(icon(iconName, 20));
      top.appendChild(mk("div", "card-title", title));
      card.append(top, mk("div", `big${String(big).length > 9 ? " small" : ""}`, big));
      if (sub) card.appendChild(mk("div", "card-sub", sub));
      (buttons ?? []).forEach(b => card.appendChild(b));
      return card;
    }

    function renderHero() {
      const p = journey.player;
      syncRegen(p);
      el("hero-msg").textContent = heroMessage;
      const need = xpToNext(p.level);
      el("hero-title").textContent = `${p.name}${p.arena?.title ? `, ${titleName(p.arena)}` : ""} · уровень ${p.level}`;
      el("hero-money").textContent = formatMoney(p.copper);
      el("hero-xp").textContent = `${p.xp} / ${need}`;
      el("hero-xp-bar").style.width = barPercent(p.xp, need);
      el("hero-mana-wrap").hidden = !(p.maxMana > 0);
      el("hero-mana").textContent = `${p.maxMana} / ${p.maxMana} · полная в начале боя`;
      el("hero-hp").textContent = `${p.health} / ${p.maxHealth}${regenClock(p) ? " · " + regenClock(p) : ""}`;
      el("hero-hp-bar").style.width = barPercent(p.health, p.maxHealth);

      // Свободные очки — всегда на виду над вкладками, чтобы их не пропустить.
      const banner = el("hero-points");
      banner.replaceChildren();
      banner.hidden = p.pendingPoints <= 0;
      if (p.pendingPoints > 0) {
        banner.appendChild(mk("div", "", `Свободных очков: ${p.pendingPoints}`));
        const btns = mk("div", "btns");
        btns.append(
          makeButton("+1 Сила", () => spendPointFromHero("strength")),
          makeButton("+1 Выносливость", () => spendPointFromHero("endurance")),
          makeButton("+1 Ловкость", () => spendPointFromHero("agility")),
          makeButton("+1 Внимание", () => spendPointFromHero("attention"))
        );
        if (p.classKey === "mage") btns.appendChild(makeButton("+1 Интеллект", () => spendPointFromHero("intelligence")));
        banner.appendChild(btns);
      }

      const tabs = el("hero-tabs");
      tabs.replaceChildren();
      HERO_TABS.forEach(t => {
        const btn = makeButton(t.name, () => { heroTab = t.key; renderHero(); });
        btn.className = `tab${heroTab === t.key ? " on" : ""}`;
        tabs.appendChild(btn);
      });

      const body = el("hero-tab-body");
      body.replaceChildren();
      if (heroTab === "stats") renderHeroStats(p, body);
      else if (heroTab === "details") renderHeroDetails(p, body);
      else if (heroTab === "equipment") renderHeroEquipment(p, body);
      else if (heroTab === "skills") renderHeroSkills(p, body);
      else if (heroTab === "journal") renderHeroJournal(p, body);
      else renderHeroBag(p, body);
      // Любое изменение снаряжения или еды сразу запоминается.
      saveGame("stop");
    }

    // Число характеристики для карточки: очки игрока и, если есть, «+N» от снаряжения (и направления, extra).
    const statBig = (p, key, extra = 0) => {
      const bonus = bonusOf(p, key) + extra;
      return `${p[key]}${bonus ? ` +${bonus}` : ""}`;
    };

    // Строка журнала: название слева, значение справа, пояснение мелким текстом.
    function journalRow(label, value, note, valueClass) {
      const row = mk("div", "detail-row");
      const top = mk("div", "detail-top");
      top.append(mk("span", "detail-label", label), mk("span", `detail-value${valueClass ? ` ${valueClass}` : ""}`, value));
      row.appendChild(top);
      if (note) row.appendChild(mk("div", "detail-parts", note));
      return row;
    }

    // Вкладка «Журнал»: счётчики боёв и места, где можно снова что-то найти.
    function renderHeroJournal(p, body) {
      const fights = mk("div", "detail-list");
      const total = { wins: 0, losses: 0, draws: 0, all: 0 };
      FIGHT_PLACES.forEach(f => {
        const s = sumFights(p.stats.fights[f.key]);
        ["wins", "losses", "draws", "all"].forEach(k => { total[k] += s[k]; });
      });
      const winRate = total.all ? `${Math.round(total.wins / total.all * 100)}%` : "—";
      fights.appendChild(journalRow("Всего боёв", `${total.all}`, `побед ${total.wins} · поражений ${total.losses} · ничьих ${total.draws} · доля побед ${winRate}`));
      FIGHT_PLACES.forEach(f => {
        const s = sumFights(p.stats.fights[f.key]);
        fights.appendChild(journalRow(f.name, `${s.all}`, `побед ${s.wins} · поражений ${s.losses} · ничьих ${s.draws}`));
      });
      body.append(mk("div", "section-title", "Бои"), fights);

      const trips = worldState().trips;
      const finds = mk("div", "detail-list");
      finds.appendChild(journalRow("Вылазок за город", `${trips}`, "вылазка засчитывается, если был бой или находка"));
      body.append(mk("div", "section-title", "Вылазки"), finds);

      const places = mk("div", "detail-list");
      const known = placeResets();
      if (!known.length) places.appendChild(mk("p", "muted", "Здесь появятся места, где ты уже побывал, и когда они обновятся."));
      known.forEach(k => {
        const open = journey.expedition?.loc === k.key;
        places.appendChild(journalRow(k.place, open ? "Ты здесь" : resetText(k.leftMs),
          open ? "пока ты внутри, ничего не меняется; отсчёт пойдёт, когда выйдешь к воротам" : "убитые враги вернутся, находки появятся снова",
          !open && k.leftMs > 0 ? "wait" : "ready"));
      });
      body.append(mk("div", "section-title", "Места и сроки"), places);
    }

    // Вкладка «Подробно»: каждое итоговое число боя с разбором, из чего оно сложилось.
    function renderHeroDetails(p, body) {
      describeStats(p).forEach(section => {
        const list = mk("div", "detail-list");
        section.rows.forEach(row => {
          const item = mk("div", "detail-row");
          const top = mk("div", "detail-top");
          top.append(mk("span", "detail-label", row.label), mk("span", "detail-value", row.value));
          item.append(top, mk("div", "detail-parts", row.parts.join(" · ")));
          list.appendChild(item);
        });
        body.append(mk("div", "section-title", section.title), list);
      });
    }

    // Сила крита для показа: ×2, ×2.15 (без лишних нулей).
    const critMultText = p => String(Math.round(p.critMult * 100) / 100);

    function renderHeroStats(p, body) {
      const canSpend = p.pendingPoints > 0;
      const plus = key => (canSpend ? [makeButton("+1", () => spendPointFromHero(key))] : []);
      const cards = mk("div", "cards");
      cards.append(
        statCard("Сила", statBig(p, "strength"), p.gear.hits.some(h => h.strMult > 1) ? `+${statOf(p, "strength")} к урону удара, с двуручным ×${BALANCE.twoHandStrength}` : `+${statOf(p, "strength")} к урону каждого удара`, "stat-red", plus("strength"), "dumbbell"),
        statCard("Выносливость", statBig(p, "endurance"), `+${healthPerEndurance(p) * statOf(p, "endurance")} к здоровью`, "stat-green", plus("endurance"), "heart"),
        statCard("Ловкость", statBig(p, "agility", directionAgility(p)),
          `Уклонение ${p.dodge}%, крит +${critBonusOf(p)}%`, "stat-cyan", plus("agility"), "feather"),
        statCard("Внимание", statBig(p, "attention"), `Шанс заметить ещё: ${noticeChanceOf(p)}%`, "stat-orange", plus("attention"), "eye"),
        statCard("Уровень", `${p.level}`, `+${healthPerLevel(p) * (p.level - 1)} к здоровью`, "stat-gold", [], "level")
      );
      // Интеллект и мана есть только у мага: воину очко в Интеллекте ничего бы не дало.
      if (p.classKey === "mage") cards.append(statCard("Интеллект", statBig(p, "intelligence"), `Мана в бою: ${p.maxMana}`, "stat-violet", plus("intelligence"), "flask"));
      body.append(mk("div", "section-title", "Характеристики"), cards);

      const fight = mk("div", "cards");
      fight.append(
        p.spellDamage ? statCard("Заклинание", rangeText(p.spellDamage), `мана −${SPELL.cost}; без маны удар ${damageText(p)}`, "", [], "flask") : statCard("Урон за удар", damageText(p), `ударов за ход: ${p.gear.strikes}`, "", [], "sword"),
        p.spellDamage ? statCard("Мана", `${p.maxMana}`, `в начале боя; +${BALANCE_MANA.regen} за ход`, "", [], "flask") : statCard("Шанс крита", critText(p), `по открытой зоне ×${critMultText(p)}, пробивает блок`, "", [], "star"),
        // Шанс крита показываем всем: воину по его ударам, магу по заклинанию (физический удар мага нужен только без маны).
        ...(p.spellDamage ? [statCard("Шанс крита", `${p.spellDamage.crit}%`, `заклинания; по открытой зоне ×${critMultText(p)}`, "", [], "star")] : []),
        statCard("Блоки за ход", `${p.gear.blocks}`, "закрывают зоны тела", "", [], "shield"),
        statCard("Уклонение", `${p.dodge}%`, "от каждого прошедшего удара", "", [], "feather")
      );
      body.append(mk("div", "section-title", "В бою"), fight);

      const armor = mk("div", "cards");
      const ZONE_ICONS = ["helm", "armor", "pants", "boots"];
      ZONES.forEach((z, i) => armor.appendChild(statCard(z, `${p.gear.armor[i]}`, `гасит ${armorCutPercent(p.gear.armor[i])}% урона`, "", [], ZONE_ICONS[i])));
      body.append(mk("div", "section-title", "Броня по зонам"), armor);

      const dir = mk("div", "cards");
      if (p.classKey === "mage") {
        dir.appendChild(statCard("Класс", "Маг", "Бьёт заклинаниями, которые не держит блок. Мана и урон растут от Интеллекта.", "wide", [], "flask"));
      } else if (p.direction) {
        const card = statCard("Направление", DIRECTIONS[p.direction].name, DIRECTIONS[p.direction].description, "wide", [], DIRECTION_ICONS[p.direction]);
        dir.appendChild(card);
      } else if (journey.phase === "capital") {
        dir.appendChild(statCard("Направление", "не выбрано", "Выбрать можно у учителя воинов на площади.", "wide empty"));
      }
      if (dir.children.length) body.append(mk("div", "section-title", "Путь"), dir);

      if (p.classKey === "mage") {
        const book = mk("div", "cards");
        p.spells.forEach(key => {
          const sp = SPELLS[key];
          book.appendChild(statCard(sp.name, rangeText(p.spellDamage), `мана −${sp.cost}; блок не держит; крит ${p.spellDamage.crit}%`, "stat-violet", [], "flask"));
        });
        body.append(mk("div", "section-title", "Книга заклинаний"), book);
      }
    }

    function renderHeroEquipment(p, body) {
      const cards = mk("div", "cards");
      SLOTS.forEach(slot => {
        const inst = p.equipment[slot.key];
        const card = mk("div", `card${inst ? "" : " empty"}`);
        card.appendChild(mk("div", "card-title", slot.name));
        if (!slot.active) {
          card.appendChild(mk("div", "card-sub", "пока недоступно"));
        } else if (inst) {
          const nameRow = mk("div", "card-top");
          nameRow.append(itemIcon(inst.base, 22), mk("div", "name", instName(inst)));
          card.append(nameRow, mk("div", "card-sub", itemOf(inst).description));
          bonusLines(inst).forEach(t => card.appendChild(mk("div", "card-bonus", t)));
          card.appendChild(makeButton("Снять", () => heroAction(() => unequipFromUi(p, slot.key), `Снято: ${itemOf(inst).name}`)));
        } else {
          const occupied = slot.key === "offHand" && itemOf(p.equipment.mainHand)?.type === "weapon2h";
          card.appendChild(mk("div", "card-sub", occupied ? "занята двуручным оружием" : "пусто"));
        }
        cards.appendChild(card);
      });
      const summary = mk("div", "cards");
      summary.append(
        statCard("Урон за удар", damageText(p), `ударов за ход: ${p.gear.strikes}`, "", [], "sword"),
        statCard("Блоки", `${p.gear.blocks}`, "за ход", "", [], "shield"),
        statCard("Броня", p.gear.armor.join(" / "), "голова / корпус / пояс / ноги", "", [], "armor")
      );
      body.append(mk("div", "section-title", "Итог снаряжения"), summary, mk("div", "section-title", "Надето"), cards);
    }

    // Кнопки для карточки снаряжения. Каждая привязана к конкретному экземпляру inst, а не к ключу шаблона.
    function gearButtons(p, inst) {
      const item = itemOf(inst);
      const wear = (slot, label, done, disabled) => makeButton(label, () => heroAction(() => equipItem(p, inst, slot), `${item.name}: ${done}`), disabled);
      if (!canUseItem(p, item)) return [makeButton(item.type === "staff" ? "Только магу" : "Магу не подходит", () => {}, true)];
      if (item.type === "weapon1h") {
        const main = itemOf(p.equipment.mainHand);
        return [wear("mainHand", "В основную руку", "надето в основную руку"),
          wear("offHand", "Во вторую руку", "надето во вторую руку", !(main && main.type === "weapon1h"))];
      }
      if (item.type === "staff") return [wear("mainHand", "В руку", "надето")];
      if (item.type === "weapon2h") return [wear("mainHand", "Надеть (обе руки)", "надето в обе руки")];
      if (item.type === "shield") return [wear("offHand", "Надеть щит", "надето")];
      if (item.type === "armor") return [wear(item.slot, "Надеть", "надето")];
      return [];
    }

    function bagCard(icon, title, description, buttons, lines = []) {
      const card = mk("div", "card");
      const nameRow = mk("div", "card-top");
      nameRow.append(icon, mk("div", "name", title));
      card.append(nameRow, mk("div", "card-sub", description));
      lines.forEach(t => card.appendChild(mk("div", "card-bonus", t)));
      const holder = mk("div", "btns");
      buttons.forEach(b => holder.appendChild(b));
      card.appendChild(holder);
      return card;
    }

    function renderHeroSkills(p, body) {
      if (p.skills.learned.length === 0) {
        body.appendChild(mk("p", "muted", "Умений пока нет. Их можно выучить у учителя в городе."));
        return;
      }
      const cards = mk("div", "cards");
      p.skills.learned.forEach(key => {
        const s = SKILLS[key];
        const equipped = p.skills.equipped === key;
        const button = makeButton(equipped ? "В слоте" : "Взять в бой", () => {
          p.skills.equipped = key;
          renderHero();
        }, equipped);
        cards.appendChild(bagCard(icon("star", 24), s.name, `${s.description} Перезарядка: ${s.cooldown} ходов.`, [button]));
      });
      body.appendChild(cards);
    }

    function renderHeroBag(p, body) {
      const keys = Object.keys(p.inventory).filter(k => p.inventory[k] > 0);
      if (keys.length === 0 && p.items.length === 0) {
        body.appendChild(mk("p", "muted", "В рюкзаке пока пусто."));
        return;
      }
      const cards = mk("div", "cards");
      // Снаряжение: каждый предмет — своя карточка.
      p.items.forEach(inst => {
        cards.appendChild(bagCard(itemIcon(inst.base, 24), instName(inst), itemOf(inst).description, gearButtons(p, inst), bonusLines(inst)));
      });
      // Еда и трофеи: стопками.
      keys.forEach(key => {
        const item = ITEMS[key];
        const buttons = item.type === "food" ? [makeButton("Съесть", () => useItem(key), p.health >= p.maxHealth)] : [];
        cards.appendChild(bagCard(itemIcon(key, 24), `${rarityMark(key)} ${item.name} ×${p.inventory[key]}`.trim(), item.description, buttons));
      });
      body.appendChild(cards);
    }

    function useItem(key) {
      const p = journey.player;
      if (!(p.inventory[key] > 0)) return;
      p.inventory[key] -= 1;
      p.health = Math.min(p.maxHealth, p.health + ITEMS[key].heal);
      renderHero();
    }

    // Экран героя открывается с остановки дороги или после поражения в бою; вернуться нужно туда, откуда пришли.
    let heroReturnScreen = "story";

    function openHero(returnScreen) {
      heroReturnScreen = ["battle", "capital", "teacher", "arena", "shop", "tavern", "expedition", "gates", "shopscene"].includes(returnScreen) ? returnScreen : "story";
      heroMessage = "";
      heroTab = "stats";
      renderHero();
      showScreen("hero");
    }

    function closeHero() {
      if (heroReturnScreen === "battle") {
        showScreen("battle");
        return;
      }
      if (heroReturnScreen === "capital") { showCapital(); return; }
      if (heroReturnScreen === "teacher") { openTeacher(); return; }
      if (heroReturnScreen === "arena") { showArena(); return; }
      if (heroReturnScreen === "shop") { showShop(); return; }
      if (heroReturnScreen === "shopscene") { showShopScene(); return; }
      if (heroReturnScreen === "tavern") { showTavern(); return; }
      if (heroReturnScreen === "expedition") { showExpedition(); return; }
      if (heroReturnScreen === "gates") { showGates(); return; }
      el("story-status").textContent = JOURNEY[journey.index].type === "end" ? "" : heroStatusText();
      showScreen("story");
    }

    // Награда за победу применяется сразу, а на экран переходим по кнопке: так победа запоминается в момент победы.
    // Уровней за один бой может прибавиться несколько, поэтому цикл, а не одно условие.
    // loot — трофеи вида { ключПредмета: количество }, они попадают в рюкзак.
    function grantRewards(xp, copper, loot) {
      const p = journey.player;
      p.xp += xp;
      p.copper += copper;
      for (const key in (loot ?? {})) addToInventory(p, key, loot[key]);
      const oldMax = p.maxHealth;
      const oldLevel = p.level;
      while (p.xp >= xpToNext(p.level)) {
        p.xp -= xpToNext(p.level);
        p.level += 1;
        p.pendingPoints += POINTS_PER_LEVEL;
      }
      // Каждый новый уровень сам добавляет здоровье, независимо от очков выносливости.
      refreshDerived(p);
      p.health += p.maxHealth - oldMax;
      journey.levelsGained = p.level - oldLevel;
    }

    // Текст о полученном: деньги и трофеи; пустые части не показываются.
    function rewardText(xp, copper, loot) {
      const parts = [`опыт +${xp}`];
      if (copper > 0) parts.push(`деньги +${formatMoney(copper)}`);
      const trophies = Object.keys(loot ?? {}).map(k => `${ITEMS[k].name} ×${loot[k]}`);
      if (trophies.length) parts.push(`трофеи: ${trophies.join(", ")}`);
      return parts.join(", ");
    }

    function awardVictory(xp, copper, loot) {
      grantRewards(xp, copper, loot);
      journey.index += 1;
      // Экран повышения уровня показывается только когда уровень только что вырос; отложенные очки им не навязываются снова.
      saveGame(journey.levelsGained > 0 ? "levelup" : "stop");
    }

    function proceedAfterFight() {
      if (journey.levelsGained > 0) showLevelUp();
      else runStop();
    }

    // Само вложение очка; что показать после него, решает вызывающий (экран уровня или экран героя).
    function applyPoint(statKey) {
      const p = journey.player;
      if (p.pendingPoints <= 0) return false;
      const oldMax = p.maxHealth;
      p[statKey] += 1;
      p.pendingPoints -= 1;
      refreshDerived(p);
      // Рост максимума сразу добавляется и к текущему здоровью, иначе очко выносливости ощущалось бы только после привала.
      p.health += p.maxHealth - oldMax;
      return true;
    }

    function spendPoint(statKey) {
      if (!applyPoint(statKey)) return;
      saveGame("levelup");
      showLevelUp();
    }

    function spendPointFromHero(statKey) {
      if (applyPoint(statKey)) renderHero();
    }

    function showLevelUp() {
      const p = journey.player;
      el("levelup-title").textContent = `Новый уровень! Теперь ты на уровне ${p.level}`;
      el("levelup-points").textContent = `Уровень сам добавил +${healthPerLevel(p) * journey.levelsGained} к максимуму здоровья. Очков для распределения: ${p.pendingPoints}.${p.pendingPoints > 0 ? " Можно распределить позже на экране «Герой и рюкзак»." : ""}`;

      const rows = [
        { key: "strength", name: "Сила", icon: "dumbbell", cls: "stat-red", big: statBig(p, "strength"), info: `урон за удар: ${damageText(p)}` },
        { key: "endurance", name: "Выносливость", icon: "heart", cls: "stat-green", big: statBig(p, "endurance"), info: `здоровье: ${p.health} / ${p.maxHealth}` },
        { key: "agility", name: "Ловкость", icon: "feather", cls: "stat-cyan", big: statBig(p, "agility", directionAgility(p)), info: `уклонение ${p.dodge}%, крит +${critBonusOf(p)}%` },
        { key: "attention", name: "Внимание", icon: "eye", cls: "stat-orange", big: statBig(p, "attention"), info: `шанс заметить ещё: ${noticeChanceOf(p)}%` }
      ];
      if (p.classKey === "mage") rows.push({ key: "intelligence", name: "Интеллект", icon: "flask", cls: "stat-violet", big: statBig(p, "intelligence"), info: `мана в бою: ${p.maxMana}` });
      const container = el("levelup-stats");
      container.replaceChildren();
      rows.forEach(r => {
        container.appendChild(statCard(r.name, r.big, r.info, r.cls, [makeButton("+1", () => spendPoint(r.key), p.pendingPoints === 0)], r.icon));
      });
      // Очки можно не тратить сейчас: они остаются у героя и вкладываются на экране «Герой и рюкзак».
      el("levelup-btn").textContent = p.pendingPoints > 0 ? "Распределю позже (очки сохранятся)" : "Продолжить путь";
      showScreen("levelup");
    }

    function runFight(stop) {
      // Копия игрока на время боя: если проиграешь, здоровье до боя останется нетронутым.
      journey.applied = false;
      saveGame("stop");
      const startHealth = journey.player.health;
      const fighter = { ...journey.player, name: `${journey.player.name} (ур. ${journey.player.level})` };
      const e = stop.enemy;
      const bot = createEnemy(e);

      startBattle(fighter, bot, stop.intro, progressText(), outcome => {
        recordFight("road", outcome);
        if (outcome === "win") {
          journey.player.health = fighter.health;
          awardVictory(e.xp, e.copper ?? 0, e.loot);
          const need = xpToNext(journey.player.level);
          el("result").textContent = journey.levelsGained > 0
            ? `Победа! ${rewardText(e.xp, e.copper ?? 0, e.loot)}. Новый уровень!`
            : `Победа! ${rewardText(e.xp, e.copper ?? 0, e.loot)} (опыт теперь ${journey.player.xp} / ${need})`;
          el("player-xp").textContent = `Опыт: ${journey.player.xp} / ${need}`;
          showAfterButton("Идти дальше", proceedAfterFight);
        } else {
          showAfterButton("Попробовать снова", runFight.bind(null, stop));
          journey.player.health = startHealth;
          // После поражения можно сменить снаряжение или поесть перед новой попыткой.
          const heroBtn = el("after-hero-btn");
          heroBtn.onclick = () => openHero("battle");
          heroBtn.hidden = false;
        }
      });
      el("player-xp").textContent = `Опыт: ${journey.player.xp} / ${xpToNext(journey.player.level)}`;
    }

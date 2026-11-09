    // ----- Лавка жетонов -----
    let arenaShopMessage = "";
    function showArenaShop() {
      const p = journey.player;
      syncRegen(p);
      const a = p.arena;
      setStatus("arenashop-status", p, [chip(`Жетоны: ${a.tokens}`, "gold", "token"), chip(ARENA_RANKS[a.rank].name, "dim", "crown")].concat(a.title ? [chip(titleName(a), "dim", "crown")] : []));
      el("arenashop-msg").textContent = arenaShopMessage;
      const list = el("arenashop-list");
      list.replaceChildren();
      ARENA_GOODS.forEach(g => {
        list.appendChild(infoCard({ iconEl: itemIcon(g.item, 26), title: ITEMS[g.item].name, sub: ITEMS[g.item].description,
          chips: [chip(`${g.cost}`, a.tokens < g.cost ? "dim" : "gold", "token")],
          buttons: [makeButton("Купить", () => buyArenaGood(g), a.tokens < g.cost)] }));
      });
      ARENA_TITLES.forEach(t => {
        const owned = a.titles.includes(t.key);
        const rankOk = a.rank >= t.rank;
        if (owned) {
          list.appendChild(infoCard({ icon: "crown", title: `Звание «${t.name}»`, sub: "Куплено.", cls: "promo-card",
            buttons: [makeButton(a.title === t.key ? "Носится" : "Носить", () => wearTitle(t), a.title === t.key)] }));
        } else {
          list.appendChild(infoCard({ icon: rankOk ? "crown" : "lock", title: `Звание «${t.name}»`, sub: rankOk ? "Звание рядом с именем героя." : `Нужен ранг «${ARENA_RANKS[t.rank].name}».`,
            cls: rankOk ? "" : "empty", chips: [chip(`${t.cost}`, a.tokens < t.cost ? "dim" : "gold", "token")],
            buttons: [makeButton("Купить", () => buyTitle(t), !rankOk || a.tokens < t.cost)] }));
        }
      });
      saveGame("capital");
      showScreen("arenashop");
    }

    function buyArenaGood(g) {
      const a = journey.player.arena;
      if (a.tokens < g.cost) return;
      a.tokens -= g.cost;
      addToInventory(journey.player, g.item, 1);
      arenaShopMessage = `Куплено: ${ITEMS[g.item].name}.`;
      showArenaShop();
    }

    function buyTitle(t) {
      const a = journey.player.arena;
      if (a.tokens < t.cost || a.rank < t.rank || a.titles.includes(t.key)) return;
      a.tokens -= t.cost;
      a.titles.push(t.key);
      a.title = t.key;
      arenaShopMessage = `Теперь ты носишь звание «${t.name}».`;
      showArenaShop();
    }

    function wearTitle(t) {
      journey.player.arena.title = t.key;
      arenaShopMessage = `Теперь ты носишь звание «${t.name}».`;
      showArenaShop();
    }

    // ----- Учитель воинов -----
    // Выбор направления нельзя отменить, поэтому он подтверждается вторым нажатием.
    let teacherArmed = null;

    function openTeacher() {
      syncRegen(journey.player);
      teacherArmed = null;
      el("teacher-result").textContent = "";
      renderTeacher();
      showScreen("teacher");
    }

    const DIRECTION_ICONS = { tank: "shield", damager: "sword", evader: "feather" };
    function renderTeacher() {
      const p = journey.player;
      const box = el("teacher-choices");
      box.replaceChildren();
      // Кнопки с подтверждением: первое нажатие «взводит» выбор, второе его применяет.
      const confirmButtons = (key, apply) => (teacherArmed === key
        ? [makeButton("Точно? Это нельзя изменить", apply), makeButton("Отмена", () => { teacherArmed = null; renderTeacher(); })]
        : [makeButton("Выбрать", () => { teacherArmed = key; renderTeacher(); })]);

      if (!p.classChosen) {
        el("teacher-text").textContent = "Старый воин оглядывает тебя: «Для начала скажи, кем ты хочешь стать. Очки, вложенные в характеристики, вернутся к тебе, если ты выберешь магию. Вещи останутся при тебе.»";
        box.appendChild(infoCard({ icon: "sword", iconSize: 34, title: "Воин", sub: "Бьёт оружием, держит удары щитом и бронёй. Следующим шагом выберешь направление.", cls: teacherArmed === "class:warrior" ? "promo-card" : "", buttons: confirmButtons("class:warrior", () => chooseClass("warrior")) }));
        box.appendChild(infoCard({ icon: "flask", iconSize: 34, title: "Маг", sub: "Бьёт заклинаниями: их не держит блок. Меньше здоровья, нет щита. Появляются Интеллект, мана и книга заклинаний.", cls: teacherArmed === "class:mage" ? "promo-card" : "", buttons: confirmButtons("class:mage", () => chooseClass("mage")) }));
        return;
      }
      if (p.classKey === "warrior" && !p.direction) {
        el("teacher-text").textContent = "Старый воин оглядывает тебя: «Выбери, каким бойцом станешь. Очки, которые ты вложил в характеристики, вернутся к тебе, и ты распределишь их заново. Вещи останутся при тебе.»";
        for (const key in DIRECTIONS) {
          const d = DIRECTIONS[key];
          box.appendChild(infoCard({ icon: DIRECTION_ICONS[key] ?? "sword", iconSize: 34, title: d.name, sub: d.description, cls: teacherArmed === key ? "promo-card" : "", buttons: confirmButtons(key, () => chooseDirection(key)) }));
        }
        return;
      }
      el("teacher-text").textContent = `Ты уже выбрал путь: ${pathNameOf(p)}. Пока учитель больше ничему не может тебя научить.`;
    }

    // Возвращаем потраченные очки: характеристики откатываются к стартовым, очки идут в «свободные».
    function refundStats(p) {
      p.pendingPoints += (p.strength - BASE_STAT) + (p.endurance - BASE_STAT) + (p.agility - BASE_STAT) + (p.attention - BASE_STAT) + (p.intelligence - BASE_STAT);
      p.strength = p.endurance = p.agility = p.attention = p.intelligence = BASE_STAT;
    }

    function chooseClass(key) {
      const p = journey.player;
      p.classChosen = true;
      p.classKey = key;
      if (key === "mage") {
        refundStats(p);
        p.spells = ["arrow"];
        p.direction = null;
        enforceClassGear(p);
      }
      refreshDerived(p);
      p.health = Math.min(p.health, p.maxHealth);
      teacherArmed = null;
      saveGame("capital");
      renderTeacher();
      el("teacher-result").textContent = key === "mage"
        ? `Теперь ты маг. Свободных очков: ${p.pendingPoints}. Распредели их на экране «Герой и рюкзак»; в книге заклинаний у тебя «${SPELL.name}».`
        : "Ты воин. Теперь выбери направление.";
    }

    function chooseDirection(key) {
      const p = journey.player;
      refundStats(p);
      p.direction = key;
      refreshDerived(p);
      p.health = Math.min(p.health, p.maxHealth);
      teacherArmed = null;
      saveGame("capital");
      renderTeacher();
      el("teacher-result").textContent = `Теперь ты ${DIRECTIONS[key].name}. Свободных очков: ${p.pendingPoints}. Распредели их на экране «Герой и рюкзак».`;
    }

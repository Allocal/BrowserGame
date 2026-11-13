    // ======================= СТОЛИЦА =======================
    function enterCapital() {
      journey.phase = "capital";
      journey.player.regenAt = Date.now();
      showCapital();
    }

    function capitalStatusText() {
      const p = journey.player;
      return `${p.name}: уровень ${p.level}, здоровье ${p.health} / ${p.maxHealth}, деньги ${formatMoney(p.copper)}.` + regenText(p)
           + (pathNameOf(p) ? ` Путь: ${pathNameOf(p)}.` : " Путь ещё не выбран.")
           + (p.pendingPoints > 0 ? ` Свободных очков: ${p.pendingPoints}.` : "");
    }

    function showCapital() {
      const p = journey.player;
      syncRegen(p);
      el("capital-text").textContent = (capitalNote ? capitalNote + " " : "") + (pathNameOf(p)
        ? "Шумная площадь столицы. Вокруг торговцы, стража и такие же искатели удачи, как ты."
        : "Шумная площадь столицы. Начни с учителя воинов: он поможет выбрать путь.");
      capitalNote = ""; // сообщение о вылазке показывается один раз
      setStatus("capital-status", p, [], regenText(p));
      saveGame("capital");
      showScreen("capital");
    }

    // Городские ворота: место перед инстансами. Отсюда ведут дороги в подземелья из DUNGEONS.
    function showGates() {
      const p = journey.player;
      syncRegen(p);
      el("gates-text").textContent = (capitalNote ? capitalNote + " " : "") + "Городские ворота. Отсюда дороги ведут за пределы города.";
      capitalNote = "";
      setStatus("gates-status", p, [], regenText(p));
      const list = el("gates-list");
      list.replaceChildren();
      Object.keys(DUNGEONS).forEach(key => list.appendChild(makeButton(DUNGEONS[key].name, () => startDungeon(key))));
      saveGame("capital");
      showScreen("gates");
    }

    // Торговая площадь: соседний с главной экран, здесь лавки и ремёсла.
    function showTrade() {
      const p = journey.player;
      syncRegen(p);
      el("trade-text").textContent = (capitalNote ? capitalNote + " " : "") + "Торговая площадь. Лавки, кузница и мастерские.";
      capitalNote = "";
      setStatus("trade-status", p, [], regenText(p));
      saveGame("capital");
      showScreen("trade");
    }

    const SOON = {
      guild: "Гильдия пока закрыта: доска заданий ещё пуста.",
      library: "Библиотека пока закрыта: книги ещё не привезли.",
      forge: "Кузница пока закрыта: кузнец ещё не вернулся.",
      bank: "Банк пока закрыт: двери заперты, ключ у управляющего.",
      alchemist: "Лавка алхимика пока закрыта: травы ещё не завезли.",
      artificer: "Мастерская артефактора пока закрыта: мастер в отъезде."
    };

    function openBuilding(key) {
      if (SOON[key]) { el("capital-text").textContent = SOON[key]; return; }
      if (key === "gate") showGates();
      if (key === "teacher") openTeacher();
      if (key === "arena") showArena();
      if (key === "shop") showShopScene();
      if (key === "tavern") openTavern();
      if (key === "trade") showTrade();
    }

    function openTradeBuilding(key) {
      if (SOON[key]) { el("trade-text").textContent = SOON[key]; return; }
      if (key === "shop") showShopScene();
      if (key === "main") showCapital();
    }

    // ----- Таверна -----
    let tavernMessage = "";
    function openTavern() { tavernMessage = ""; showTavern(); }

    function showTavern() {
      const p = journey.player;
      syncRegen(p);
      setStatus("tavern-status", p, [], regenText(p));
      el("tavern-msg").textContent = tavernMessage;
      const list = el("tavern-list");
      list.replaceChildren();
      const price = tavernPrice(p);
      const missing = p.maxHealth - p.health;
      list.appendChild(price <= 0
        ? infoCard({ icon: "bed", iconSize: 34, title: "Ты и так полон сил", sub: "Отдыхать не нужно.", cls: "wide empty", buttons: [makeButton("Отдохнуть", () => {}, true)] })
        : infoCard({ icon: "bed", iconSize: 34, title: "Отдохнуть до полного здоровья", sub: "Мгновенно, на мягкой кровати.", cls: "wide",
            chips: [chip(`+${missing} здоровья`, "red", "heart"), chip(formatMoney(price), "gold", "coin")],
            buttons: [makeButton("Отдохнуть", tavernRest, p.copper < price)] }));
      saveGame("capital");
      showScreen("tavern");
    }

    function tavernRest() {
      const p = journey.player;
      syncRegen(p);
      const price = tavernPrice(p);
      if (price <= 0 || p.copper < price) return;
      const healed = p.maxHealth - p.health;
      p.copper -= price;
      p.health = p.maxHealth;
      p.regenAt = Date.now();
      tavernMessage = `Ты выспался: здоровье +${healed}, заплачено ${formatMoney(price)}.`;
      showTavern();
    }

    // Бесплатный отдых на площади — временная мера, пока нет таверны, иначе после боёв на арене не восстановить здоровье.

    // ----- Магазин -----
    // Сколько названий показывать в подсказке о новых товарах; остальные сворачиваются в «и ещё N».
    const TEASER_NAMES = 4;

    function teaserText(tier) {
      if (!tier) return "";
      const names = tier.items.map(k => ITEMS[k].name);
      const more = names.length > TEASER_NAMES ? ` и ещё ${names.length - TEASER_NAMES}` : "";
      return `Новые товары откроются на ${tier.minLevel} уровне: ${names.slice(0, TEASER_NAMES).join(", ")}${more}.`;
    }

    function shopSellPrice(key) {
      const item = ITEMS[key];
      return item.type === "trophy" ? item.value : Math.floor((item.price ?? 0) * SELL_RATE);
    }

    // Множитель цены продажи по редкости. Бонусы на предмете случайны, но чем выше редкость, тем их больше и они сильнее,
    // поэтому пока цену определяет только редкость. Числа примерные, подлежат балансу.
    const RARITY_PRICE = { common: 1, uncommon: 2.5, rare: 5, unique: 10 };

    // Цена продажи конкретного экземпляра: цена продажи шаблона, умноженная на множитель редкости.
    const sellPriceOf = inst => Math.floor(shopSellPrice(inst.base) * (RARITY_PRICE[inst.rarity] ?? 1));

    function buyItem(key) {
      const p = journey.player;
      const price = ITEMS[key].price;
      if (p.copper < price) return;
      p.copper -= price;
      addToInventory(p, key, 1);
      showShop();
    }

    function sellItem(key, count) {
      const p = journey.player;
      const n = Math.min(count, p.inventory[key] ?? 0);
      if (n <= 0) return;
      p.inventory[key] -= n;
      p.copper += shopSellPrice(key) * n;
      showShop();
    }

    // Продажа конкретного экземпляра снаряжения по его цене (sellPriceOf).
    function sellGear(inst) {
      const p = journey.player;
      const index = p.items.indexOf(inst);
      if (index === -1) return;
      p.items.splice(index, 1);
      p.copper += sellPriceOf(inst);
      showShop();
    }

    // Сцена магазина: картинка с областями; область ведёт в раздел (пока все разделы открывают весь магазин).
    let shopSceneNote = "";
    function showShopScene() {
      const p = journey.player;
      syncRegen(p);
      document.querySelectorAll(".zone.lit").forEach(z => z.classList.remove("lit")); // при смене экрана mouseleave не приходит
      el("shop-zone-tag").hidden = true;
      setStatus("shopscene-status", p);
      el("shopscene-text").textContent = shopSceneNote || "Лавка торговца. Выбирай, что тебя интересует.";
      shopSceneNote = "";
      saveGame("capital");
      showScreen("shopscene");
    }

    // Подсветка всех частей раздела на картинке и подпись над ними.
    function lightZone(cat, on) {
      const tag = el("shop-zone-tag");
      const zones = [...document.querySelectorAll(`#shop-zones .zone[data-cat="${cat}"]`)];
      zones.forEach(z => z.classList.toggle("lit", on));
      tag.hidden = !on;
      if (!on || !zones.length) return;
      const boxes = zones.map(z => z.getBBox());
      const left = Math.min(...boxes.map(b => b.x));
      const right = Math.max(...boxes.map(b => b.x + b.width));
      const top = Math.min(...boxes.map(b => b.y));
      tag.textContent = zones[0].dataset.name;
      tag.style.left = `${(left + right) / 2 / 1408 * 100}%`;
      tag.style.top = `${Math.max(top, 40) / 768 * 100}%`; // не выше верхнего края картинки
    }

    function openShopZone(cat) {
      if (cat === "soon") { shopSceneNote = "Эти витрины пока пусты: торговец ещё ждёт товар."; showShopScene(); return; }
      showShop(cat);
    }

    // Разделы лавки: какие типы вещей (поле type в ITEMS) продаются в разделе. Пустой список — раздел только для продажи.
    const SHOP_CATEGORIES = {
      armor:    { name: "Броня", types: ["armor"], note: "Броня на четыре зоны: голова, корпус, пояс, ноги." },
      weapons:  { name: "Оружие и щиты", types: ["weapon1h", "weapon2h", "staff", "shield"], note: "Оружие и щиты. Посох для мага, остальное для воина." },
      supplies: { name: "Припасы", types: ["food", "tool"], note: "Еда для лечения и снаряжение для вылазок: огниво и спальник." },
      sell:     { name: "Продажа", types: [], note: "Торговец покупает снаряжение за 40% цены, трофеи по их стоимости. Надетые вещи сначала нужно снять на экране героя." }
    };
    let shopCat = "armor"; // открытый раздел: после покупки и продажи страница перерисовывается в нём же

    // Продаёт все трофеи. Перерисовка и сохранение один раз, после цикла.
    function sellAllTrophies() {
      const p = journey.player;
      Object.keys(p.inventory).forEach(key => {
        const item = ITEMS[key];
        if (item.type !== "trophy") return;
        p.copper += shopSellPrice(key) * p.inventory[key];
        p.inventory[key] = 0;
      });
      showShop();
    }

    // Группа в списке продажи: подзаголовок и карточки; пустая группа не показывается.
    function addSellGroup(parent, title, cards, extraButton = null) {
      if (cards.length === 0) return;
      const heading = document.createElement("div");
      heading.className = "section-title sell-group";
      heading.textContent = title;
      parent.appendChild(heading);
      if (extraButton) {
        extraButton.classList.add("sell-group");
        parent.appendChild(extraButton);
      }
      cards.forEach(card => parent.appendChild(card));
    }

    function showShop(cat = shopCat) {
      shopCat = cat;
      const category = SHOP_CATEGORIES[cat];
      const p = journey.player;
      syncRegen(p);
      setStatus("shop-status", p);
      el("shop-title").textContent = category.name;
      el("shop-note").textContent = category.note;
      const buying = category.types.length > 0;
      el("shop-buy-title").hidden = el("shop-buy").hidden = el("shop-teaser").hidden = !buying;
      el("shop-sell-title").hidden = el("shop-sell").hidden = buying;

      const buy = el("shop-buy");
      buy.replaceChildren();
      const rows = [];
      let nextTier = null;
      SHOP_STOCK.forEach(tier => {
        const here = tier.items.filter(key => category.types.includes(ITEMS[key].type) && canUseItem(p, ITEMS[key])); // воину не показываем посохи, магу мечи и щиты
        if (tier.minLevel > p.level) {
          if (!nextTier && here.length) nextTier = { minLevel: tier.minLevel, items: here };
          return;
        }
        here.forEach(key => rows.push({ key, item: ITEMS[key] }));
      });
      rows.sort((a, b) => a.item.price - b.item.price);
      rows.forEach(({ key, item }) => {
        const owned = item.type === "tool" && (p.inventory[key] ?? 0) > 0; // инструмент покупается один раз
        buy.appendChild(infoCard({ iconEl: itemIcon(key, 26), title: item.name, sub: item.description,
          chips: [chip(formatMoney(item.price), p.copper < item.price ? "dim" : "gold", "coin")],
          buttons: [makeButton(owned ? "Уже есть" : "Купить", () => buyItem(key), owned || p.copper < item.price)] }));
      });
      el("shop-teaser").textContent = teaserText(nextTier);

      const sell = el("shop-sell");
      sell.replaceChildren();
      // Инструменты (огниво, спальник) не продаются: случайная продажа лишила бы вылазок.
      const keys = Object.keys(p.inventory).filter(k => p.inventory[k] > 0 && ITEMS[k].type !== "tool");
      const trophies = keys.filter(k => ITEMS[k].type === "trophy");
      const food = keys.filter(k => ITEMS[k].type === "food");
      if (keys.length === 0 && p.items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "В рюкзаке ничего нет.";
        sell.appendChild(empty);
      }
      const gearCards = p.items.map(inst => infoCard({ iconEl: itemIcon(inst.base, 26), title: instName(inst), titleCls: rarityClass(inst), sub: gearLines(inst).join(" · "),
        buttons: [makeButton(`Продать (${formatMoney(sellPriceOf(inst))})`, () => sellGear(inst))] }));
      const stackCard = key => {
        const count = p.inventory[key];
        const unit = shopSellPrice(key);
        const buttons = [makeButton(`Продать 1 (${formatMoney(unit)})`, () => sellItem(key, 1))];
        if (count > 1) buttons.push(makeButton(`Продать все (${formatMoney(unit * count)})`, () => sellItem(key, count)));
        return infoCard({ iconEl: itemIcon(key, 26), title: `${ITEMS[key].name} ×${count}`, buttons });
      };
      addSellGroup(sell, "Снаряжение", gearCards);
      const trophyTotal = trophies.reduce((sum, k) => sum + shopSellPrice(k) * p.inventory[k], 0);
      const sellAllButton = trophies.length >= 2
        ? makeButton(`Продать все трофеи (${formatMoney(trophyTotal)})`, sellAllTrophies) : null;
      addSellGroup(sell, "Трофеи", trophies.map(stackCard), sellAllButton);
      addSellGroup(sell, "Еда", food.map(stackCard));
      saveGame("capital");
      showScreen("shop");
    }

    const CATEGORY_ICONS = ["sword", "arena", "fist"];

    function showArena() {
      const p = journey.player;
      const a = p.arena;
      syncRegen(p);
      syncTickets(a);
      ensureOffers(p);
      const rank = ARENA_RANKS[a.rank];

      // Шапка: уровень, здоровье, деньги, ранг, жетоны, билеты и полоса очков ранга.
      const status = el("arena-status");
      setStatus("arena-status", p, [chip(`${rank.name}`, "gold", "crown"), chip(`Жетоны: ${a.tokens}`, "gold", "token")].concat(a.title ? [chip(titleName(a), "dim", "crown")] : []), regenText(p));
      const pips = document.createElement("span");
      pips.className = "pips";
      for (let i = 0; i < TICKET_MAX; i++) { const pip = document.createElement("span"); pip.className = `pip${i < a.tickets ? " on" : ""}`; pips.appendChild(pip); }
      const ticketLine = document.createElement("div");
      ticketLine.className = "chiprow";
      ticketLine.append(icon("ticket", 18), pips, document.createTextNode(` ${a.tickets} / ${TICKET_MAX}`));
      if (a.tickets < TICKET_MAX) {
        const minutes = Math.max(1, Math.ceil((TICKET_MS - (Date.now() - a.ticketAt)) / 60000));
        const next = document.createElement("span");
        next.className = "muted";
        next.textContent = ` · следующий через ~${minutes} мин`;
        ticketLine.appendChild(next);
      }
      status.appendChild(ticketLine);
      if (rank.need) {
        const label = document.createElement("div");
        label.className = "meter-label";
        label.innerHTML = `<span>Очки ранга</span><span>${a.points} / ${rank.need}</span>`;
        const bar = document.createElement("div");
        bar.className = "bar meter-small";
        bar.innerHTML = `<div class="fill xpfill" style="width:${barPercent(a.points, rank.need)}"></div>`;
        status.append(label, bar);
      }

      const list = el("arena-list");
      list.replaceChildren();

      const promotionReady = rank.need && a.points >= rank.need;
      if (promotionReady) {
        const boss = { name: rank.boss, ...arenaFighterStats(p.level + BOSS_LEVELS_ABOVE) };
        list.appendChild(infoCard({ icon: "crown", iconSize: 34, title: `Бой за повышение: ранг «${ARENA_RANKS[a.rank + 1].name}»`, cls: "wide promo-card",
          sub: `${boss.name}, уровень ${boss.level}. Без билетов; можно пробовать снова.`,
          chips: [chip(`ранг и ${PROMOTION_TOKENS}`, "gold", "token")],
          buttons: [makeButton("Бой за повышение", () => startArenaFight(boss, "promo", -1))] }));
      }

      ARENA_CATEGORIES.forEach((cat, i) => {
        const f = a.offers[i];
        const r = arenaRewards(p.level, f.level);
        const open = i < rank.categories;
        const rr = ratedRewards(p.level, f.level, cat);
        const card = document.createElement("div");
        card.className = "card offer";

        const top = document.createElement("div");
        top.className = "card-top";
        const title = document.createElement("div");
        title.className = "name";
        title.textContent = cat.name;
        top.append(icon(CATEGORY_ICONS[i], 24), title);
        card.appendChild(top);
        const who = document.createElement("div");
        who.className = "card-sub";
        who.textContent = `${f.name}, уровень ${f.level}`;
        card.appendChild(who);

        const normal = document.createElement("div");
        normal.className = "offer-section";
        normal.innerHTML = '<div class="offer-label">Обычный бой</div>';
        normal.appendChild(chipRow([chip(`${r.xp}`, "blue", "star"), chip(formatMoney(r.copper), "gold", "coin")]));
        normal.appendChild(makeButton("Обычный бой", () => startArenaFight(f, "normal", i)));
        card.appendChild(normal);

        const rated = document.createElement("div");
        rated.className = "offer-section";
        rated.innerHTML = '<div class="offer-label">Бой за ранг</div>';
        if (open) {
          rated.appendChild(chipRow([chip(`${rr.points}`, "gold", "crown"), chip(`${rr.tokens}`, "gold", "token"), chip(`−${cat.cost}`, a.tickets < cat.cost ? "dim" : "cyan", "ticket")]));
        } else {
          const need = ARENA_RANKS.find(x => x.categories > i).name;
          rated.appendChild(chipRow([chip(`с ранга «${need}»`, "dim", "lock")]));
        }
        rated.appendChild(makeButton("Бой за ранг", () => startArenaFight(f, "rated", i), !open || promotionReady || a.tickets < cat.cost));
        card.appendChild(rated);
        list.appendChild(card);
      });
      saveGame("capital");
      showScreen("arena");
    }

    // mode: "normal" — опыт и деньги; "rated" — очки ранга и жетоны за билеты; "promo" — бой за повышение ранга (без билетов).
    // Всё, что зависит от состояния героя, фиксируется в начале боя; билеты тратятся сразу, чтобы выход из игры не спасал от списания.
    function startArenaFight(f, mode, catIdx) {
      const p = journey.player;
      const a = p.arena;
      const cat = ARENA_CATEGORIES[catIdx];
      syncTickets(a);
      if (mode === "rated") {
        if (a.tickets < cat.cost) return;
        if (a.tickets >= TICKET_MAX) a.ticketAt = Date.now(); // билеты были полными, отсчёт возврата начинается сейчас
        a.tickets -= cat.cost;
      }
      const normal = arenaRewards(p.level, f.level);
      const rated = mode === "rated" ? ratedRewards(p.level, f.level, cat) : null;
      syncRegen(p);
      const startHealth = p.health;
      const fighter = { ...p, name: `${p.name} (ур. ${p.level})` };
      const bot = createEnemy(arenaEnemyDef(f));
      const label = mode === "promo" ? "Бой за повышение" : (mode === "rated" ? "Бой за ранг" : "Арена");
      saveGame("capital");
      startBattle(fighter, bot, `${label}. Твой соперник: ${f.name}, уровень ${f.level}.`, `${label}: ${f.name}`, outcome => {
        recordFight("arena", outcome);
        p.regenAt = Date.now(); // после боя отсчёт восстановления начинается заново
        if (catIdx >= 0) a.offers[catIdx] = null; // после боя с этим соперником предложение обновляется
        if (outcome === "win") {
          p.health = fighter.health;
          let text;
          if (mode === "normal") {
            grantRewards(normal.xp, normal.copper);
            text = rewardText(normal.xp, normal.copper);
          } else if (mode === "rated") {
            const xp = Math.round(normal.xp * RATED_XP_SHARE);
            grantRewards(xp, 0);
            a.points += rated.points;
            a.tokens += rated.tokens;
            text = `очки ранга +${rated.points}, жетоны +${rated.tokens}, опыт +${xp}`;
          } else {
            grantRewards(0, 0);
            a.rank += 1;
            a.points = 0;
            a.tokens += PROMOTION_TOKENS;
            text = `ты получил ранг «${ARENA_RANKS[a.rank].name}», жетоны +${PROMOTION_TOKENS}`;
          }
          saveGame("capital");
          el("result").textContent = `Победа! ${text}` + (journey.levelsGained > 0 ? ". Новый уровень!" : (mode === "normal" ? ` (опыт теперь ${xpLine(p)})` : ""));
          el("player-xp").textContent = `Опыт: ${xpLine(p)}`;
          showAfterButton("Вернуться на арену", () => (journey.levelsGained > 0 ? showLevelUp() : showArena()));
        } else {
          p.health = startHealth;
          saveGame("capital");
          showAfterButton("Вернуться на арену", showArena);
          if (mode === "rated") el("result").textContent += ` Билеты потрачены: ${cat.cost}.`;
          const heroBtn = el("after-hero-btn");
          heroBtn.onclick = () => openHero("battle");
          heroBtn.hidden = false;
        }
      });
      el("player-xp").textContent = `Опыт: ${xpLine(p)}`;
    }

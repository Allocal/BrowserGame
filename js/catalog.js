    // ======================= КАТАЛОГ ВЕЩЕЙ: СЕМЕЙСТВА БРОНИ =======================
    // Семейство задаёт ступень и броню; постоянный характер (бонусы к характеристикам) лежит в MATERIALS по ключу material.
    // Редкость и случайные бонусы сюда не входят: они принадлежат экземпляру вещи (items.js, bonuses.js).

    // Доля брони корпуса, которая достаётся каждому слоту.
    const SLOT_ARMOR_SHARE = { head: 0.5, chest: 1, legs: 0.5, boots: 0.5 };

    const FAMILIES = {
      linen: {
        material: "cloth",
        minLevel: 1,
        chestArmor: 3,
        chestPrice: 120,
        headShape: "cap",
        color: "#c9b98a",
        names: { head: "Льняной капюшон", chest: "Льняная мантия", legs: "Льняные штаны", boots: "Льняные туфли" }
      },
      steel: {
        material: "steel",
        minLevel: 10,
        chestArmor: 12,
        chestPrice: 2000,
        headShape: "helm",
        color: "#a9b4c4",
        names: { head: "Стальной шлем", chest: "Стальной нагрудник", legs: "Стальные поножи", boots: "Стальные сапоги" }
      },
      mail: {
        material: "mail",
        minLevel: 10,
        chestArmor: 10,
        chestPrice: 2000,
        headShape: "cap",
        color: "#8f9aa6",
        names: { head: "Кольчужный капюшон", chest: "Кольчужная рубаха", legs: "Кольчужные штаны", boots: "Кольчужные сапоги" }
      },
      silk: {
        material: "silk",
        minLevel: 10,
        chestArmor: 5,
        chestPrice: 2000,
        headShape: "cap",
        color: "#b9a6d6",
        names: { head: "Шёлковый капюшон", chest: "Шёлковая мантия", legs: "Шёлковые штаны", boots: "Шёлковые туфли" }
      },
      meteorite: {
        material: "meteorite",
        minLevel: 20,
        chestArmor: 20,
        chestPrice: 3500,
        headShape: "helm",
        color: "#6e6480",
        names: { head: "Метеоритный шлем", chest: "Метеоритный нагрудник", legs: "Метеоритные поножи", boots: "Метеоритные сапоги" }
      },
      crystal: {
        material: "crystal",
        minLevel: 20,
        chestArmor: 14,
        chestPrice: 3500,
        headShape: "helm",
        color: "#6fb7d6",
        names: { head: "Кристаллический шлем", chest: "Кристаллический нагрудник", legs: "Кристаллические поножи", boots: "Кристаллические сапоги" }
      },
      elven: {
        material: "elven",
        minLevel: 20,
        chestArmor: 16,
        chestPrice: 3500,
        headShape: "cap",
        color: "#6aa86e",
        names: { head: "Эльфийский капюшон", chest: "Эльфийский доспех", legs: "Эльфийские поножи", boots: "Эльфийские сапоги" }
      },
      velvet: {
        material: "velvet",
        minLevel: 20,
        chestArmor: 8,
        chestPrice: 3500,
        headShape: "cap",
        color: "#8c3b5a",
        names: { head: "Бархатный капюшон", chest: "Бархатная мантия", legs: "Бархатные штаны", boots: "Бархатные туфли" }
      }
    };

    const SLOT_ZONE_GENITIVE = { head: "головы", chest: "корпуса", legs: "пояса", boots: "ног" };

    // Создаёт в ITEMS вещи по таблице семейств и ставит их в магазин по minLevel семейства.
    // Ключи вида steel_chest; цена и броня части — доля от нагрудника.
    function buildFamilyArmor() {
      Object.entries(FAMILIES).forEach(([familyKey, family]) => {
        let shopTier = SHOP_STOCK.find(t => t.minLevel === family.minLevel);
        if (!shopTier) {
          shopTier = { minLevel: family.minLevel, items: [] };
          SHOP_STOCK.push(shopTier);
        }
        ARMOR_SLOTS.forEach(slot => {
          const share = SLOT_ARMOR_SHARE[slot];
          const armor = Math.round(family.chestArmor * share);
          const key = `${familyKey}_${slot}`;
          ITEMS[key] = {
            name: family.names[slot], type: "armor", slot, material: family.material, armor,
            color: family.color, price: Math.round(family.chestPrice * share),
            description: `Броня ${SLOT_ZONE_GENITIVE[slot]} +${armor}`
          };
          if (slot === "head") ITEMS[key].shape = family.headShape;
          shopTier.items.push(key);
        });
      });
      // Подсказка «новые товары» берёт первую закрытую ступень по порядку массива, поэтому он должен идти по возрастанию уровня.
      SHOP_STOCK.sort((a, b) => a.minLevel - b.minLevel);
    }

    buildFamilyArmor();

    // ----- Проверка целостности: тихие опечатки (например, неверный слот в материале даёт бонус 0 без ошибки) превращаем в явный список -----
    const isPositive = x => Number.isFinite(x) && x > 0;

    function checkCatalog() {
      const problems = [];
      const bad = text => problems.push(text);

      Object.entries(MATERIALS).forEach(([key, material]) => {
        Object.entries(material.stats).forEach(([stat, bySlot]) => {
          if (!BONUS_TYPES[stat]) bad(`материал ${key}: неизвестная характеристика ${stat}`);
          ARMOR_SLOTS.forEach(slot => {
            if (!Number.isFinite(bySlot[slot])) bad(`материал ${key}, ${stat}: нет числа для слота ${slot}`);
          });
        });
      });

      Object.entries(FAMILIES).forEach(([key, family]) => {
        if (!MATERIALS[family.material]) bad(`семейство ${key}: нет материала ${family.material}`);
        ["minLevel", "chestArmor", "chestPrice"].forEach(field => {
          if (!isPositive(family[field])) bad(`семейство ${key}: поле ${field} не положительное число`);
        });
        ARMOR_SLOTS.forEach(slot => {
          if (!family.names?.[slot]) bad(`семейство ${key}: нет названия для слота ${slot}`);
        });
        if (!ICONS[family.headShape]) bad(`семейство ${key}: нет значка ${family.headShape}`);
      });

      Object.entries(ITEMS).filter(([, item]) => item.type === "armor").forEach(([key, item]) => {
        if (!MATERIALS[item.material]) bad(`вещь ${key}: нет материала ${item.material}`);
        if (!ARMOR_SLOTS.includes(item.slot)) bad(`вещь ${key}: неизвестный слот ${item.slot}`);
      });

      SHOP_STOCK.forEach(tier => tier.items.forEach(key => {
        if (!ITEMS[key]) bad(`магазин, ступень ${tier.minLevel}: нет вещи ${key}`);
      }));

      return problems;
    }

    // Запуск после загрузки всех скриптов: ICONS и BONUS_TYPES лежат в других файлах. Игроку ничего не показывает, только консоль разработчика.
    document.addEventListener("DOMContentLoaded", () => {
      const problems = checkCatalog();
      if (problems.length) console.warn(`Каталог вещей: найдено проблем ${problems.length}\n${problems.join("\n")}`);
    });


    // ======================= ПРЕДМЕТЫ-ЭКЗЕМПЛЯРЫ =======================
    // Шаблон предмета (название, тип, базовый урон) лежит в ITEMS. Экземпляр хранит только то, что у каждого предмета своё:
    // ссылку на шаблон, редкость и случайные бонусы. Так два меча из одного шаблона могут отличаться.
    // Экземпляры — обычные данные без методов, поэтому они без потерь сохраняются в JSON.

    // Еда, трофеи и инструменты (огниво, спальник) одинаковы между собой и складываются в стопки «ключ → количество». Всё остальное — снаряжение.
    const STACKABLE_TYPES = ["food", "trophy", "tool"];
    const isStackable = key => STACKABLE_TYPES.includes(ITEMS[key].type);

    function makeItem(base, rarity = "common", bonuses = []) {
      return { base, rarity, bonuses };
    }

    // Шаблон по экземпляру: всё, что не меняется от предмета к предмету, читаем отсюда.
    // Для пустого слота (null) возвращает null, поэтому проверять слот отдельно не нужно.
    const itemOf = inst => (inst ? ITEMS[inst.base] : null);

    // Звёзды редкости экземпляра и его название для показа: «★ Меч».
    const instStars = inst => RARITY_STARS[inst.rarity] ?? "";
    const instName = inst => `${instStars(inst)} ${itemOf(inst).name}`.trim();

    // Экземпляр из сохранения проверяем: неизвестный шаблон или испорченные бонусы не должны ломать игру.
    function cleanItem(raw) {
      if (!raw || !ITEMS[raw.base] || isStackable(raw.base)) return null;
      const bonuses = Array.isArray(raw.bonuses)
        ? raw.bonuses.filter(b => b && typeof b.stat === "string" && Number.isFinite(b.value)).map(b => ({ stat: b.stat, value: b.value }))
        : [];
      return makeItem(raw.base, typeof raw.rarity === "string" ? raw.rarity : "common", bonuses);
    }

    // ======================= ПОДЗЕМЕЛЬЯ (только данные, ничего не рисует и не считает) =======================
    // Сосуществует со старым LOCATIONS из expedition.js до шага 6 переделки леса, игра пока читает только старое.
    // kind узла: entrance — вход и выход; hunt — охота на группу монстров; boss — босс; secret — скрытое необязательное место.
    // monsters — какой зверь из WILD_ENEMIES и сколько их в группе; у одного из них при каждом заходе случайно лежит key.
    // gate стоит на узле, В КОТОРЫЙ ведёт переход: requires — узел, чей ключ нужен, guard — страж на переходе (зверь × scale, title — имя на экране).
    // Добычи босса по слотам здесь пока нет: она появится на шаге 5.
    const NODE_KINDS = ["entrance", "hunt", "boss", "secret"];

    const DUNGEONS = {
      darkForest: {
        name: "Тёмный лес",
        intro: "За городскими воротами начинается лес. Тропы расходятся в разные стороны, и не все их видно сразу.",
        start: "edge",
        nodes: {
          edge:     { name: "Опушка", kind: "entrance", x: 50, y: 90, image: "img/forest/path1.jpg", visible: true,
                      text: "Здесь кончается дорога от городских ворот. Отсюда можно вернуться к воротам." },
          clearing: { name: "Поляна", kind: "hunt", x: 26, y: 66, image: "img/forest/path2.jpg", visible: true,
                      text: "Солнечная поляна с высокой травой.",
                      monsters: { kind: "wolf", count: 4 }, key: "Волчья метка",
                      find: { label: "Осмотреть траву", title: "Высокая трава", copper: [0.2, 0.8], items: { bread: 1 }, itemChance: 0.4 } },
          brook:    { name: "Ручей", kind: "hunt", x: 70, y: 56, image: "img/forest/path2.jpg", visible: true,
                      text: "Быстрый ручей. На влажной земле видны следы зверей.",
                      monsters: { kind: "boar", count: 3 }, key: "Кабаний клык",
                      gate: { requires: "clearing", guard: { kind: "wolf", scale: 1.5, title: "Матёрый волк" } },
                      find: { label: "Поискать у воды", title: "Берег ручья", copper: [0, 0.4] } },
          hut:      { name: "Заброшенная сторожка", kind: "hunt", x: 42, y: 36, image: "img/forest/tower.jpg", visible: true,
                      text: "Покосившаяся сторожка лесника. Давно никто не заходил.",
                      monsters: { kind: "bandit", count: 3 }, key: "Ключ лесника",
                      gate: { requires: "brook", guard: { kind: "boar", scale: 1.5, title: "Старый секач" } },
                      find: { label: "Обыскать сторожку", title: "Сторожка", copper: [0.3, 1.2], items: { bread: 2 }, itemChance: 0.7,
                              gear: { chance: 0.35, rarity: { common: 70, uncommon: 25, rare: 5 } } } },
          wolfpath: { name: "Волчья тропа", kind: "boss", x: 70, y: 14, image: "img/forest/path1.jpg", visible: true,
                      text: "Тропа, вытоптанная лапами. Здесь живёт вожак стаи.",
                      boss: { kind: "leader", scale: 1 },
                      gate: { requires: "hut", guard: { kind: "bandit", scale: 1.5, title: "Главарь разбойников" } } },
          oak:      { name: "Старый дуб", kind: "secret", x: 12, y: 30, image: "img/forest/oak.jpg", visible: false,
                      text: "Огромный дуб, в дупле которого кто-то оставил сундучок.",
                      find: { label: "Открыть сундучок", title: "Сундучок в дупле", copper: [1.0, 2.5], rareBoost: 4 } }
        },
        links: [["edge", "clearing"], ["clearing", "brook"], ["brook", "hut"], ["hut", "wolfpath"], ["hut", "oak"]]
      }
    };

    // Проверка данных подземелий: собирает все проблемы списком (а не обрывает на первой), чтобы опечатка не ломала игру.
    function checkDungeons() {
      const problems = [];
      const bad = text => problems.push(text);
      const isCount = n => Number.isInteger(n) && n >= 1;

      Object.entries(DUNGEONS).forEach(([key, dungeon]) => {
        const where = `подземелье ${key}`;

        if (!dungeon.nodes[dungeon.start]) bad(`${where}: стартового узла «${dungeon.start}» нет среди узлов`);

        dungeon.links.forEach(([a, b]) => {
          if (!dungeon.nodes[a] || !dungeon.nodes[b]) bad(`${where}: тропа ${a}–${b} ведёт в несуществующий узел`);
        });

        Object.entries(dungeon.nodes).forEach(([id, node]) => {
          const at = `${where}, узел ${id}`;

          if (!NODE_KINDS.includes(node.kind)) bad(`${at}: неизвестный вид «${node.kind}»`);
          if (node.kind === "hunt" && !(node.monsters && node.key)) bad(`${at}: у охоты должны быть и monsters, и key`);
          if (node.kind === "boss" && !node.boss) bad(`${at}: у босса нет поля boss`);

          if (node.monsters) {
            if (!WILD_ENEMIES[node.monsters.kind]) bad(`${at}: неизвестный зверь «${node.monsters.kind}»`);
            if (!isCount(node.monsters.count)) bad(`${at}: размер группы должен быть целым числом от 1`);
          }

          if (node.boss) {
            if (!WILD_ENEMIES[node.boss.kind]) bad(`${at}: неизвестный босс «${node.boss.kind}»`);
            if (!(node.boss.scale > 0)) bad(`${at}: scale босса должен быть больше нуля`);
          }

          if (node.gate) {
            const needed = dungeon.nodes[node.gate.requires];
            if (!needed) bad(`${at}: ворота требуют несуществующий узел «${node.gate.requires}»`);
            else if (!needed.key) bad(`${at}: ворота требуют ключ из «${node.gate.requires}», а там ключа нет`);
            const guard = node.gate.guard;
            if (!guard || !WILD_ENEMIES[guard.kind]) bad(`${at}: у ворот неизвестный страж`);
            else if (!(guard.scale > 0) || !guard.title) bad(`${at}: у стража нужны scale больше нуля и title`);
          }

          if (node.find) {
            const f = node.find;
            if (!f.label || !f.title) bad(`${at}: у находки нужны label и title`);
            if (!Array.isArray(f.copper) || f.copper.length !== 2 || f.copper[0] > f.copper[1]) bad(`${at}: copper должен быть парой [от, до]`);
            Object.keys(f.items ?? {}).forEach(item => { if (!ITEMS[item]) bad(`${at}: в находке неизвестный предмет «${item}»`); });
            if (f.itemChance !== undefined && !(f.itemChance >= 0 && f.itemChance <= 1)) bad(`${at}: itemChance должен быть от 0 до 1`);
          }
        });

        // Достижимость: от старта по тропам должны находиться все узлы, иначе часть подземелья недоступна.
        const reached = new Set([dungeon.start]);
        let grew = true;
        while (grew) {
          grew = false;
          dungeon.links.forEach(([a, b]) => {
            if (reached.has(a) !== reached.has(b)) { reached.add(a); reached.add(b); grew = true; }
          });
        }
        Object.keys(dungeon.nodes).forEach(id => { if (!reached.has(id)) bad(`${where}: узел ${id} недостижим от старта`); });
      });

      return problems;
    }

    document.addEventListener("DOMContentLoaded", () => {
      const problems = checkDungeons();
      if (problems.length) console.warn(`Подземелья: найдено проблем ${problems.length}\n${problems.join("\n")}`);
    });

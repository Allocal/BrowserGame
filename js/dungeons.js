    // ======================= ПОДЗЕМЕЛЬЯ (только данные, ничего не рисует и не считает) =======================
    // Единственный лес игры: старая вылазка удалена, общие помощники (звери, добыча) лежат в wild.js.
    // kind узла: entrance — вход и выход; hunt — охота на группу монстров; boss — босс; secret — скрытое необязательное место.
    // monsters — какой зверь из WILD_ENEMIES, сколько их в группе и scale (множитель силы, подобран замером: обычный монстр отнимает 10–20% здоровья); у одного из них при каждом заходе случайно лежит key.
    // gate стоит на узле, В КОТОРЫЙ ведёт переход: requires — узел, чей ключ нужен, guard — страж на переходе (зверь × scale, title — имя на экране).
    // look — осмотр узла: происходит сам при первом входе за заход (кнопок нет). nothing — тексты неудачи, found — тексты находки,
    // loot — что находится (суммы в долях базовой награды арены), reveal — какие скрытые узлы открываются, sure: true — без броска Внимания.
    // Слотовой добычи с боссов здесь нет: лес решено делать не про вещи (снаряжение лишь с шансом из тайников).
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
                      monsters: { kind: "wolf", count: 4, scale: 0.65 }, key: "Волчья метка",
                      look: {
                        nothing: ["Ты осмотрел поляну: трава высокая, следов почти нет, ничего интересного."],
                        found: ["В высокой траве у поваленного ствола что-то блеснуло. Подойдя ближе, ты нашёл несколько монет."],
                        loot: { copper: [0.2, 0.8], items: { bread: 1 }, itemChance: 0.4 } } },
          brook:    { name: "Ручей", kind: "hunt", x: 70, y: 56, image: "img/forest/path2.jpg", visible: true,
                      text: "Быстрый ручей. На влажной земле видны следы зверей.",
                      monsters: { kind: "boar", count: 3, scale: 0.7 }, key: "Кабаний клык",
                      gate: { requires: "clearing", guard: { kind: "wolf", scale: 1, title: "Матёрый волк" } },
                      look: {
                        nothing: ["Ты осмотрел берег: вода да мокрые камни, ничего интересного."],
                        found: ["У самой воды среди камней что-то блеснуло. Ты достал из ила несколько монет."],
                        loot: { copper: [0.1, 0.4] } } },
          hut:      { name: "Заброшенная сторожка", kind: "hunt", x: 42, y: 36, image: "img/forest/tower.jpg", visible: true,
                      text: "Покосившаяся сторожка лесника. Давно никто не заходил.",
                      monsters: { kind: "bandit", count: 3, scale: 0.7 }, key: "Ключ лесника",
                      gate: { requires: "brook", guard: { kind: "boar", scale: 1, title: "Старый секач" } },
                      look: {
                        nothing: ["Ты заглянул в сторожку: пыль, паутина и пустые полки."],
                        found: ["В щели между брёвен лежал свёрток: кто-то спрятал его и забыл."],
                        loot: { copper: [0.3, 1.2], items: { bread: 2 }, itemChance: 0.7, gear: { chance: 0.35, rarity: { common: 70, uncommon: 25, rare: 5 } } },
                        reveal: { nodes: ["oak"], text: "Из окна ты заметил среди деревьев тропу, ведущую к огромному дубу." } } },
          wolfpath: { name: "Волчья тропа", kind: "boss", x: 70, y: 14, image: "img/forest/path1.jpg", visible: true,
                      text: "Тропа, вытоптанная лапами. Здесь живёт вожак стаи.",
                      boss: { kind: "leader", scale: 0.85 },
                      gate: { requires: "hut", guard: { kind: "bandit", scale: 1, title: "Главарь разбойников" } } },
          oak:      { name: "Старый дуб", kind: "secret", x: 12, y: 30, image: "img/forest/oak.jpg", visible: false,
                      text: "Огромный дуб, в дупле которого кто-то оставил сундучок.",
                      look: {
                        sure: true,
                        found: ["В дупле огромного дуба стоит сундучок. Ты открыл его."],
                        loot: { copper: [1.0, 2.5], rareBoost: 4 } } }
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
            if (!(node.monsters.scale > 0)) bad(`${at}: scale монстров должен быть больше нуля`);
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

          if (node.look) {
            const look = node.look;
            const texts = list => Array.isArray(list) && list.length > 0 && list.every(t => typeof t === "string" && t);
            if (!texts(look.found)) bad(`${at}: у осмотра нужен непустой список текстов found`);
            if (!look.sure && !texts(look.nothing)) bad(`${at}: у осмотра нужен непустой список текстов nothing (или sure: true)`);
            if (look.loot) {
              const f = look.loot;
              if (!Array.isArray(f.copper) || f.copper.length !== 2 || f.copper[0] > f.copper[1]) bad(`${at}: copper должен быть парой [от, до]`);
              Object.keys(f.items ?? {}).forEach(item => { if (!ITEMS[item]) bad(`${at}: в находке неизвестный предмет «${item}»`); });
              if (f.itemChance !== undefined && !(f.itemChance >= 0 && f.itemChance <= 1)) bad(`${at}: itemChance должен быть от 0 до 1`);
            }
            if (look.reveal) {
              if (!Array.isArray(look.reveal.nodes) || !look.reveal.nodes.every(n => dungeon.nodes[n])) bad(`${at}: reveal ссылается на несуществующий узел`);
              if (!look.reveal.text) bad(`${at}: у reveal нужен text`);
            }
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

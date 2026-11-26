    // ======================= ПОДЗЕМЕЛЬЯ (только данные, ничего не рисует и не считает) =======================
    // Единственный лес игры: старая вылазка удалена, общие помощники (звери, добыча) лежат в wild.js.
    // kind узла: entrance — вход и выход; hunt — охота на группу монстров; boss — босс; secret — скрытое необязательное место; quiet — тихое место без врагов (безопасное).
    // monsters — какой зверь из WILD_ENEMIES, сколько их в группе и scale (множитель силы, подобран замером: обычный монстр отнимает 10–20% здоровья); у одного из них при каждом заходе случайно лежит key.
    // gate стоит на узле, В КОТОРЫЙ ведёт переход: requires — узел (или список узлов), чей ключ нужен, pick — необязательная загадка: { counts: { число ключей: вес } }, в начале захода случайно решается, сколько и какие ключи из requires нужны; guard — страж на переходе (зверь × scale, title — имя на экране).
    // look — осмотр узла: происходит сам при первом входе за заход (кнопок нет). nothing — тексты неудачи, found — тексты находки,
    // loot — что находится (суммы в долях базовой награды арены), reveal — какие скрытые узлы открываются, clue — узел с воротами, чью загадку выдаёт успешный осмотр (игрок узнаёт, какие ключи нужны), sure: true — без броска Внимания.
    // Слотовой добычи с боссов здесь нет: лес решено делать не про вещи (снаряжение лишь с шансом из тайников).
    const NODE_KINDS = ["entrance", "quiet", "hunt", "boss", "secret"];

    const DUNGEONS = {
      darkForest: {
        name: "Тёмный лес",
        intro: "За городскими воротами начинается лес. Тропы расходятся в разные стороны, и не все их видно сразу.",
        start: "edge",
        maxEnemyLevel: 20, // лес рассчитан на уровни 1–20: выше враги и награды больше не растут (см. GDD, «Диапазоны подземелий»)
        nodes: {
          edge:      { name: "Опушка", kind: "entrance", x: 50, y: 92, image: "img/bg/forest_edge.jpg", visible: true,
                       text: "Здесь кончается дорога от городских ворот. Отсюда можно вернуться к воротам.",
                       look: {
                         nothing: ["Ты осмотрел опушку: следы колёс, сломанные ветки, ничего особенного."],
                         found: ["У корней придорожного дерева лежит выцветшая записка: кто-то уже ходил этим лесом и оставил заметки для других."],
                         clue: "wolfpath" } },
          clearing:  { name: "Поляна", kind: "quiet", x: 50, y: 76, image: "img/bg/forest_glade.jpg", visible: true,
                       text: "Тихая поляна среди старых деревьев, трава покрыта инеем. Тропы расходятся к ручью, к сторожке и в овраг, а ещё одна ведёт вглубь леса.",
                       look: {
                         nothing: ["Ты осмотрел поляну: трава высокая, следов почти нет, ничего интересного."],
                         found: ["В высокой траве у поваленного ствола что-то блеснуло. Подойдя ближе, ты нашёл несколько монет."],
                         loot: { copper: [0.2, 0.8], items: { bread: 1 }, itemChance: 0.4 } } },
          brook:     { name: "Ручей", kind: "hunt", x: 84, y: 66, image: "img/bg/forest_clearing.jpg", visible: true,
                       text: "Быстрый ручей. На влажной земле видны следы кабанов.",
                       monsters: { kind: "boar", count: 3, scale: 0.7 }, key: "Кабаний клык",
                       look: {
                         nothing: ["Ты осмотрел берег: вода да мокрые камни, ничего интересного."],
                         found: ["У самой воды среди камней что-то блеснуло. Ты достал из ила несколько монет."],
                         loot: { copper: [0.1, 0.4] },
                         reveal: { nodes: ["mill"], text: "Вдоль ручья ты заметил тропку, ведущую к старой мельнице." } } },
          mill:      { name: "Старая мельница", kind: "secret", x: 88, y: 40, image: "img/bg/forest_clearing.jpg", visible: false,
                       text: "Полуразрушенная мельница у ручья. Колесо давно не вертится.",
                       look: {
                         sure: true,
                         found: ["На чердаке мельницы ты нашёл забытый мешок."],
                         loot: { copper: [0.6, 1.6], items: { bread: 2 }, itemChance: 0.8 } } },
          hut:       { name: "Заброшенная сторожка", kind: "hunt", x: 18, y: 66, image: "img/bg/forest_hut.jpg", visible: true,
                       text: "Покосившаяся сторожка лесника. Давно никто не заходил.",
                       monsters: { kind: "bandit", count: 3, scale: 0.7 }, key: "Ключ лесника",
                       look: {
                         nothing: ["Ты заглянул в сторожку: пыль, паутина и пустые полки."],
                         found: ["В щели между брёвен лежал свёрток: кто-то спрятал его и забыл."],
                         loot: { copper: [0.3, 1.2], items: { bread: 2 }, itemChance: 0.7 },
                         reveal: { nodes: ["cellar"], text: "За сторожкой ты заметил в земле люк: ход в погреб." } } },
          cellar:    { name: "Погреб лесника", kind: "secret", x: 12, y: 40, image: "img/bg/forest_hut.jpg", visible: false,
                       text: "Тёмный погреб под сторожкой. Здесь хранили то, что не хотели показывать.",
                       look: {
                         sure: true,
                         found: ["В погребе, за бочками, стоит ящик, забытый хозяином."],
                         loot: { copper: [0.8, 1.8], gear: { chance: 0.4, rarity: { common: 70, uncommon: 25, rare: 5 } } } } },
          ravine:    { name: "Овраг", kind: "hunt", x: 36, y: 52, image: "img/bg/forest_wolfpath.jpg", visible: true,
                       text: "Глубокий овраг, заросший папоротником. По склонам вытоптаны волчьи тропы.",
                       monsters: { kind: "wolf", count: 3, scale: 0.7 }, key: "Волчья метка",
                       look: {
                         nothing: ["Ты осмотрел склоны оврага: следы лап, но ничего ценного."],
                         found: ["В папоротнике лежала старая сумка: её хозяин не вернулся."],
                         loot: { copper: [0.2, 0.7] },
                         reveal: { nodes: ["oak"], text: "На краю оврага, среди деревьев, ты заметил огромный старый дуб." } } },
          oak:       { name: "Старый дуб", kind: "secret", x: 36, y: 26, image: "img/bg/forest_oak.jpg", visible: false,
                       text: "Огромный дуб, в дупле которого кто-то оставил сундучок.",
                       look: {
                         sure: true,
                         found: ["В дупле огромного дуба стоит сундучок. Ты открыл его."],
                         loot: { copper: [1.0, 2.5], rareBoost: 4 } } },
          crossroads: { name: "Перекрёсток", kind: "quiet", x: 62, y: 48, image: "img/bg/forest_glade.jpg", visible: true,
                        text: "Перекрёсток троп. Здесь стоит старое кострище: путники останавливаются у него, прежде чем идти дальше." },
          gatehall:  { name: "Врата логова", kind: "quiet", x: 62, y: 30, image: "img/bg/forest_wolfpath.jpg", visible: true,
                       text: "Каменная арка, заросшая плющом, и тяжёлые створки: за ними логово. На створках вырезаны знаки.",
                       look: {
                         nothing: ["Ты осмотрел створки: знаки стёрлись, прочесть их не удаётся."],
                         found: ["На створках вырезаны знаки, и ты разобрал их смысл."],
                         clue: "wolfpath" } },
          wolfpath:  { name: "Логово Вожака", kind: "boss", x: 62, y: 12, image: "img/bg/forest_wolfpath.jpg", visible: true,
                       text: "Логово вожака стаи: вытоптанная земля, кости и клочья шерсти.",
                       boss: { kind: "leader", scale: 0.85 },
                       gate: { requires: ["brook", "hut", "ravine"], pick: { counts: { 1: 20, 2: 60, 3: 20 } },
                               guard: { kind: "wolf", scale: 1, title: "Страж логова" } } }
        },
        links: [["edge", "clearing"], ["clearing", "brook"], ["clearing", "hut"], ["clearing", "ravine"], ["clearing", "crossroads"],
                ["brook", "mill"], ["mill", "ravine"], ["mill", "crossroads"], ["hut", "cellar"], ["cellar", "crossroads"], ["ravine", "oak"], ["oak", "crossroads"],
                ["crossroads", "gatehall"], ["gatehall", "wolfpath"]]
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
            [].concat(node.gate.requires).forEach(req => {
              const needed = dungeon.nodes[req];
              if (!needed) bad(`${at}: ворота требуют несуществующий узел «${req}»`);
              else if (!needed.key) bad(`${at}: ворота требуют ключ из «${req}», а там ключа нет`);
            });
            if (node.gate.pick) {
              const pool = [].concat(node.gate.requires);
              const counts = node.gate.pick.counts ?? {};
              if (!Object.keys(counts).some(n => Number(n) >= 1 && Number(n) <= pool.length && counts[n] > 0)) bad(`${at}: у загадки ворот нет ни одного допустимого числа ключей (от 1 до ${pool.length}) с весом больше нуля`);
            }
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
            if (look.clue && !(dungeon.nodes[look.clue]?.gate?.pick)) bad(`${at}: clue ссылается на узел «${look.clue}», у которого нет загадки ворот (gate.pick)`);
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

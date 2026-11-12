    // ======================= СТАТИСТИКА ИГРЫ И ЖУРНАЛ МЕСТ (не знает про экран) =======================
    // Счётчики боёв хранятся у героя (p.stats) и сохраняются вместе с ним. Тренировка не считается: в ней нет героя-путешественника.
    const FIGHT_PLACES = [
      { key: "arena", name: "Арена" },
      { key: "wild", name: "Вылазки" },
      { key: "road", name: "Дорога в столицу" }
    ];

    const newStats = () => {
      const fights = {};
      FIGHT_PLACES.forEach(f => { fights[f.key] = { wins: 0, losses: 0, draws: 0 }; });
      return { fights };
    };

    // Статистику из сохранения проверяем: неизвестные места отбрасываем, плохие числа заменяем нулём.
    function cleanStats(raw) {
      const stats = newStats();
      FIGHT_PLACES.forEach(f => {
        const r = raw?.fights?.[f.key];
        ["wins", "losses", "draws"].forEach(k => { stats.fights[f.key][k] = Number.isFinite(r?.[k]) && r[k] > 0 ? Math.floor(r[k]) : 0; });
      });
      return stats;
    }

    // Записать итог боя. outcome — «win», «lose» или «draw».
    function recordFight(kind, outcome) {
      const place = journey?.player?.stats?.fights?.[kind];
      if (!place) return;
      place[{ win: "wins", lose: "losses", draw: "draws" }[outcome]] += 1;
    }

    const sumFights = f => ({ wins: f.wins, losses: f.losses, draws: f.draws, all: f.wins + f.losses + f.draws });

    // Склонение по числу: 1 минуту, 2 минуты, 5 минут.
    function plural(n, one, few, many) {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
      return many;
    }


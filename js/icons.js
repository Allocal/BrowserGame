    // ----- Иконки -----
    // Простые векторные значки в сетке 24×24, нарисованные линиями; цвет берут из текущего цвета текста (currentColor),
    // поэтому один и тот же значок можно красить стилем. Новый значок — одна строка в этой таблице.
    const ICONS = {
      sword:   '<path d="M21 3l-.8 4.7L11 17l-4-4 9.3-9.2z" fill="currentColor" fill-opacity=".22"/><path d="M6.5 13.5l4 4M8.6 15.4L4.5 19.5"/><circle cx="3.7" cy="20.3" r="1"/>',
      knife:   '<path d="M20.5 3.5l-9.5 12-3-3z" fill="currentColor" fill-opacity=".22"/><path d="M7 16.5l3-3M8.8 14.7L4 19.5"/><circle cx="3.5" cy="20.5" r="1"/>',
      gate:    '<path d="M4.5 21V10a7.5 7.5 0 0 1 15 0v11"/><path d="M9 21v-6a3 3 0 0 1 6 0v6" fill="currentColor" fill-opacity=".22"/>',
      gem:     '<path d="M12 3l7 6-7 12L5 9z" fill="currentColor" fill-opacity=".22"/><path d="M5 9h14M9.5 9L12 3l2.5 6M9.5 9L12 21l2.5-12"/>',
      tree:    '<path d="M12 3l6 8h-3l4 6H5l4-6H6z" fill="currentColor" fill-opacity=".22"/><path d="M12 17v4"/>',
      staff:   '<path d="M6.5 21.5L16 9"/><circle cx="17.5" cy="6.5" r="3" fill="currentColor" fill-opacity=".22"/>',
      axe:     '<path d="M5.5 20.5L17 8"/><path d="M10.5 6C13.5 2.5 19.5 3.5 21 8.5L15.5 12z" fill="currentColor" fill-opacity=".22"/>',
      shield:  '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" fill="currentColor" fill-opacity=".22"/><path d="M12 3v18M4 10h16"/>',
      buckler: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity=".22"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5"/>',
      cap:     '<path d="M4.5 15a7.5 7.5 0 0 1 15 0z" fill="currentColor" fill-opacity=".22"/><path d="M3 15h18M12 7.5V4"/>',
      helm:    '<path d="M5 20v-8a7 7 0 0 1 14 0v8z" fill="currentColor" fill-opacity=".22"/><path d="M5 13h14M12 5v8M9 17h6"/>',
      armor:   '<path d="M8 3L3 7l3 4 2-1v11h8V10l2 1 3-4-5-4c-1 2-5 2-6 0z" fill="currentColor" fill-opacity=".22"/>',
      pants:   '<path d="M7 3h10l1 18h-4.2L12 11l-1.8 10H6z" fill="currentColor" fill-opacity=".22"/><path d="M7 7h10"/>',
      boots:   '<path d="M9 3h6v9.5l5 2.5v5H5v-4.5l4-2z" fill="currentColor" fill-opacity=".22"/><path d="M5 17.5h15"/>',
      bread:   '<path d="M3.5 14c0-4 4-7 8.5-7s8.5 3 8.5 7c0 2-1.5 3.5-3.5 3.5H7c-2 0-3.5-1.5-3.5-3.5z" fill="currentColor" fill-opacity=".22"/><path d="M9 10.5l1.2 3M13 9.5l1.2 3.5M17 11l.8 2.5"/>',
      fang:    '<path d="M7 4h10c0 6-2 11-5 17-3-6-5-11-5-17z" fill="currentColor" fill-opacity=".22"/>',
      pelt:    '<path d="M5 5l4-2 3 2 3-2 4 2-2.5 5 2.5 6-5 4-2-3-2 3-5-4 2.5-6z" fill="currentColor" fill-opacity=".22"/>',
      coin:    '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity=".22"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5M10 11h3.5M10 13h3.5"/>',
      ticket:  '<path d="M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" fill="currentColor" fill-opacity=".22"/><path d="M14 9v9" stroke-dasharray="1.5 2"/>',
      token:   '<circle cx="12" cy="9" r="6" fill="currentColor" fill-opacity=".22"/><path d="M9 14l-2 7 5-3 5 3-2-7M12 6.5l1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 8.8l2-.3z"/>',
      heart:   '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" fill="currentColor" fill-opacity=".22"/>',
      star:    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" fill-opacity=".22"/>',
      dumbbell:'<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>',
      feather: '<path d="M20 4C10 4 5 9 5 17c0 1 0 2 .2 3 .8-.2 1.8-.3 2.8-.3 6 0 12-4 12-15.7z" fill="currentColor" fill-opacity=".22"/><path d="M5 20l8-9"/>',
      fire:    '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" fill="currentColor" fill-opacity=".22"/>',
      eye:     '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="currentColor" fill-opacity=".22"/><circle cx="12" cy="12" r="3"/>',
      level:   '<path d="M6 11l6-6 6 6M6 18l6-6 6 6"/>',
      arena:   '<path d="M20 3l-.6 3.6L12 14l-3-3 7.4-7.4z" fill="currentColor" fill-opacity=".22"/><path d="M4 3l.6 3.6L12 14l3-3L7.6 3.6z" fill="currentColor" fill-opacity=".22"/><path d="M8.5 15.5l-3 3M15.5 15.5l3 3M3.5 20.5l2-2M20.5 20.5l-2-2"/>',
      shop:    '<path d="M5 8h14l1 12H4z" fill="currentColor" fill-opacity=".22"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
      tavern:  '<path d="M5 8h11v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".22"/><path d="M16 10.5h1.5a2 2 0 0 1 0 5H16M5 8c0-2.5 3-3 4-1 1-2 4-2 5 0 .8-.8 2-.8 2 1"/>',
      teacher: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" fill="currentColor" fill-opacity=".22"/><path d="M12 6v14"/>',
      crown:   '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="currentColor" fill-opacity=".22"/>',
      lock:    '<path d="M6 11h12v9H6z" fill="currentColor" fill-opacity=".22"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      bed:     '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.8"/>',
      flask:   '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" fill="currentColor" fill-opacity=".22"/>',
      fist:    '<path d="M7 11V8a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v5c0 4-3 7-6.5 7S6 18 6 14v-3z" fill="currentColor" fill-opacity=".22"/>',
      bag:     '<path d="M5 9h14l-1 11H6z" fill="currentColor" fill-opacity=".22"/><path d="M9 9a3 3 0 0 1 6 0M9 13h6"/>'
    };

    // Значок как элемент страницы; size — размер в пикселях.
    function icon(name, size) {
      const wrap = document.createElement("span");
      wrap.className = "ico";
      if (size) { wrap.style.width = `${size}px`; wrap.style.height = `${size}px`; }
      wrap.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
      return wrap;
    }

    // Какой значок у предмета: трофеи, еда и оружие по виду, броня по месту.
    function itemIconName(key) {
      const item = ITEMS[key];
      if (key === "dogFang") return "fang";
      if (key === "wolfPelt") return "pelt";
      if (item.type === "food") return "bread";
      if (item.type === "armor") {
        if (item.slot === "head") return key === "ironHelm" ? "helm" : "cap";
        return { chest: "armor", legs: "pants", boots: "boots" }[item.slot];
      }
      return item.shape ?? "bag";
    }

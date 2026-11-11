    // ----- Общие элементы карточек -----
    // Плашка-«чип»: короткое значение с цветом и значком.
    function chip(text, cls, iconName) {
      const c = document.createElement("span");
      c.className = `chip${cls ? " " + cls : ""}`;
      if (iconName) c.appendChild(icon(iconName, 16));
      c.appendChild(document.createTextNode(text));
      return c;
    }

    function chipRow(chips) {
      const row = document.createElement("div");
      row.className = "chiprow";
      chips.forEach(c => row.appendChild(c));
      return row;
    }

    // Значок предмета: цвет берётся у самого предмета (у брони он есть), иначе по виду.
    function itemIcon(key, size) {
      const ic = icon(itemIconName(key), size);
      const item = ITEMS[key];
      ic.style.color = item.color ?? (item.type === "food" ? "#e0b070" : item.type === "trophy" ? "#c9a27e" : "#d7dbe6");
      return ic;
    }

    // Общая карточка: значок и название, пояснение, чипы, кнопки. o: { icon, iconEl, title, sub, chips, buttons, cls }
    function infoCard(o) {
      const card = document.createElement("div");
      card.className = `card ${o.cls ?? ""}`;
      const top = document.createElement("div");
      top.className = "card-top";
      const ic = o.iconEl ?? (o.icon ? icon(o.icon, o.iconSize ?? 22) : null);
      if (ic) top.appendChild(ic);
      const name = document.createElement("div");
      name.className = `name ${o.titleCls ?? ""}`;
      name.textContent = o.title;
      top.appendChild(name);
      card.appendChild(top);
      if (o.sub) { const sub = document.createElement("div"); sub.className = "card-sub"; sub.textContent = o.sub; card.appendChild(sub); }
      if (o.chips && o.chips.length) card.appendChild(chipRow(o.chips));
      if (o.buttons && o.buttons.length) {
        const holder = document.createElement("div");
        holder.className = "btns";
        o.buttons.forEach(b => holder.appendChild(b));
        card.appendChild(holder);
      }
      return card;
    }

    // Строка состояния героя в виде чипов; extra — необязательные чипы вдобавок.
    function setStatus(id, p, extra, note) {
      const box = el(id);
      box.replaceChildren();
      const chips = [];
      if (p.pendingPoints > 0) chips.push(chip(`Свободных очков: ${p.pendingPoints}`, "blue", "star"));
      const all = chips.concat(extra ?? []);
      if (all.length) box.appendChild(chipRow(all));
    }

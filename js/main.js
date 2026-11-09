    // ======================= ЗАПУСК =======================
    fillPresetSelect(el("player-gear"), "weaponShield");
    el("player-gear").appendChild(new Option("Маг (заклинания)", "mage")); // только для игрока: у бота нет логики заклинаний
    fillPresetSelect(el("bot-gear"), "weapon");
    el("journey-btn").addEventListener("click", onNewGameClick);
    el("continue-btn").addEventListener("click", loadGame);
    el("training-btn").addEventListener("click", () => showScreen("training-setup"));
    el("training-back-btn").addEventListener("click", () => showScreen("menu"));
    el("start-btn").addEventListener("click", startTraining);
    el("levelup-btn").addEventListener("click", () => {
      journey.levelsGained = 0;
      saveGame("stop");
      if (afterLevelUp) { const next = afterLevelUp; afterLevelUp = null; next(); return; } // продолжение вылазки после повышения уровня
      if (journey.phase === "capital") showArena();
      else runStop();
    });
    refreshMenu();
    el("story-hero-btn").addEventListener("click", () => openHero("story"));
    el("capital-hero-btn").addEventListener("click", () => openHero("capital"));
    el("arena-hero-btn").addEventListener("click", () => openHero("arena"));
    el("exp-hero-btn").addEventListener("click", () => openHero("expedition"));
    el("exp-look-btn").addEventListener("click", lookAround);
    el("exp-home-btn").addEventListener("click", goHome);
    el("shop-hero-btn").addEventListener("click", () => openHero("shop"));
    el("shop-back-btn").addEventListener("click", showCapital);
    el("arena-back-btn").addEventListener("click", showCapital);
    el("tavern-hero-btn").addEventListener("click", () => openHero("tavern"));
    el("tavern-back-btn").addEventListener("click", showCapital);
    el("arena-shop-btn").addEventListener("click", () => { arenaShopMessage = ""; showArenaShop(); });
    el("arenashop-back-btn").addEventListener("click", showArena);
    el("capital-menu-btn").addEventListener("click", () => showScreen("menu"));
    el("teacher-hero-btn").addEventListener("click", () => openHero("teacher"));
    el("teacher-back-btn").addEventListener("click", showCapital);
    el("hero-back-btn").addEventListener("click", closeHero);
    el("turn-btn").addEventListener("click", onTurn);
    el("tactic-btn").addEventListener("click", () => {
      autoTacticIndex = (autoTacticIndex + 1) % TACTICS.length;
      setAuto(autoOn);
    });
    el("skill-btn").addEventListener("click", () => {
      skillArmed = !skillArmed;
      refreshSkillButton();
    });
    el("village").querySelectorAll(".hotspot").forEach(btn => {
      btn.addEventListener("click", () => openBuilding(btn.dataset.place));
    });
    el("auto-btn").addEventListener("click", () => {
      setAuto(!autoOn);
      if (autoOn) autoStep();
    });
    el("speed-btn").addEventListener("click", () => {
      autoSpeedIndex = (autoSpeedIndex + 1) % AUTO_SPEEDS.length;
      setAuto(autoOn);
    });
    el("strike-reset").addEventListener("click", () => {
      selectedStrikes.length = 0;
      refreshSelection();
    });

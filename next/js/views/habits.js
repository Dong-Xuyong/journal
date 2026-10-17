(function () {
  "use strict";

  var WEEK_COUNT = 12;
  var MONTH_COUNT = 6;
  var HEAT_WEEKS = 53;
  var HISTORY_DAYS = 1826;
  var BODY = {
    training: true,
    food_logged: true,
    weigh_in: true,
    sunlight: true,
    protein_breakfast: true
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var SVG = "http://www.w3.org/2000/svg";
  var HEALTH = "https://dong-xuyong.github.io/health/";

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function button(className, text) {
    var el = node("button", className, text);
    el.type = "button";
    return el;
  }

  function svgEl(name) {
    return document.createElementNS(SVG, name);
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function announce(text) {
    if (window.JournalUI && typeof JournalUI.announce === "function") JournalUI.announce(text);
  }

  function localDate(day) {
    return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12, 0, 0);
  }

  function findDef(defs, id) {
    var i;
    for (i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i];
    return null;
  }

  function selectedId(key, defs) {
    if (!key || key === "all" || key === "habits") return "";
    return findDef(defs, key) ? key : "";
  }

  function statusText(status) {
    if (status === "done") return "Done";
    if (status === "miss") return "Not done";
    if (status === "unknown") return "Unknown";
    return "No log";
  }

  function pct(rate) {
    if (rate == null) return "no log";
    return Math.round(rate * 100) + "%";
  }

  function level(rate) {
    if (rate <= 0) return 0;
    if (rate <= 0.2) return 1;
    if (rate <= 0.4) return 2;
    if (rate <= 0.6) return 3;
    if (rate <= 0.8) return 4;
    return 5;
  }

  function readStore(today) {
    var entries = {};
    var day = today;
    var i;
    var entry;
    for (i = 0; i < HISTORY_DAYS; i++) {
      entry = JournalData.entry(day);
      if (entry) entries[day] = entry;
      day = JournalData.shift(day, -1);
      if (!day) break;
    }
    return { entries: entries };
  }

  function currentStreak(id, today) {
    var key = today;
    var status = JournalData.habitStatus(key, id);
    var n = 0;
    if (status === "none") key = JournalData.shift(today, -1);
    else if (status !== "done") return 0;
    while (key && JournalData.habitStatus(key, id) === "done") {
      n += 1;
      if (n >= HISTORY_DAYS) break;
      key = JournalData.shift(key, -1);
    }
    return n;
  }

  function bestStreak(id, today) {
    var day = today;
    var keys = [];
    var i;
    var best = 0;
    var run = 0;
    for (i = 0; i < HISTORY_DAYS; i++) {
      keys.push(day);
      day = JournalData.shift(day, -1);
      if (!day) break;
    }
    for (i = keys.length - 1; i >= 0; i--) {
      if (JournalData.habitStatus(keys[i], id) === "done") {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    return best;
  }

  function daySummary(day, defs) {
    var done = 0;
    var miss = 0;
    var unknown = 0;
    var none = 0;
    var i;
    var status;
    for (i = 0; i < defs.length; i++) {
      status = JournalData.habitStatus(day, defs[i].id);
      if (status === "done") done += 1;
      else if (status === "miss") miss += 1;
      else if (status === "unknown") unknown += 1;
      else none += 1;
    }
    if (!defs.length || none === defs.length) {
      return { state: "none", done: 0, miss: 0, unknown: defs.length, total: defs.length, rate: null };
    }
    if (unknown === defs.length) {
      return { state: "unknown", done: done, miss: miss, unknown: unknown, total: defs.length, rate: null };
    }
    return { state: "logged", done: done, miss: miss, unknown: unknown, total: defs.length, rate: done / defs.length };
  }

  function periodStats(days, defs) {
    var logged = [];
    var per = {};
    var i;
    var j;
    var hits = 0;
    var count;
    var id;
    for (i = 0; i < days.length; i++) {
      if (daySummary(days[i], defs).state !== "none") logged.push(days[i]);
    }
    for (j = 0; j < defs.length; j++) {
      id = defs[j].id;
      count = 0;
      for (i = 0; i < logged.length; i++) {
        if (JournalData.habitStatus(logged[i], id) === "done") count += 1;
      }
      hits += count;
      per[id] = { done: count, total: logged.length, rate: logged.length ? count / logged.length : null };
    }
    return {
      logged: logged.length,
      overall: logged.length && defs.length ? hits / (logged.length * defs.length) : null,
      perHabit: per
    };
  }

  function periodDays(key, today) {
    var days = JournalData.daysIn(key, today) || [];
    var out = [];
    var i;
    for (i = 0; i < days.length; i++) if (days[i] <= today) out.push(days[i]);
    return out;
  }

  function recentKeys(kind, count, today) {
    var key = JournalData.todayKey(kind, localDate(today));
    var keys = [];
    var i;
    for (i = 0; i < count - 1; i++) key = JournalData.shift(key, -1);
    for (i = 0; i < count; i++) {
      keys.push(key);
      key = JournalData.shift(key, 1);
    }
    return keys;
  }

  function shortLabel(kind, key) {
    var start;
    if (kind === "week") {
      start = (JournalData.children(key) || [])[0] || key;
      if (start.length >= 10) return Number(start.slice(5, 7)) + "/" + Number(start.slice(8, 10));
      return key;
    }
    return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(2, 4);
  }

  function section(id, title, summary) {
    var made = JournalUI.fold({ id: id, title: title, level: 3, summary: summary });
    made.root.classList.add("habit-fold", "dx-card");
    made.root.setAttribute("data-fold", id);
    if (made.body) made.body.classList.add("habit-body");
    return made;
  }

  function todayLine(board, defs) {
    if (!board.logged) return "Today · no log yet";
    var line = "Today · " + board.done + " of " + defs.length + " done";
    if (board.win) line += " · win day";
    return line;
  }

  function renderToday(store, defs, today) {
    var board = JournalGamify.play(store, defs, today);
    var cycle = board.cycle;
    var made = section("habit-today", "Today", todayLine(board, defs));
    var row = node("div", "play-row");
    var ring = node("div", "day-ring" + (board.win ? " win" : ""));
    var figure = node("span", "day-ring-num");
    var copy = node("div", "play-copy");
    var bar = node("span", "rate-bar");
    var fill = node("i");
    var wins = cycle.wins === 1 ? "1 win" : cycle.wins + " wins";
    var head = node("div", "cite-row");
    ring.style.setProperty("--p", String(Math.round((defs.length ? Math.min(1, board.done / defs.length) : 0) * 100)));
    ring.setAttribute("data-done", String(board.done));
    ring.setAttribute("data-win", board.win ? "1" : "0");
    figure.appendChild(node("strong", "", String(board.done)));
    figure.appendChild(node("span", "", "/" + defs.length));
    ring.appendChild(figure);
    copy.appendChild(node("p", "play-status" + (board.win ? " win" : ""), board.logged ? (board.win ? "Win day" : "Not a win yet") : "No log yet"));
    copy.appendChild(node("p", "play-streak", board.winStreak ? board.winStreak + (board.winStreak === 1 ? " win day in a row" : " win days in a row") : "No win streak yet"));
    if (cycle.phase === "test") {
      copy.appendChild(node("p", "cycle-label", "Test automaticity, day " + cycle.testDay + " of 7"));
      copy.appendChild(node("p", "habit-note cycle-wins", wins + " in the 21 days"));
    } else {
      copy.appendChild(node("p", "cycle-label", "Day " + cycle.day + " of 21"));
      copy.appendChild(node("p", "habit-note cycle-wins", wins + " so far"));
    }
    fill.style.setProperty("--v", Math.round(cycle.progress * 100) + "%");
    bar.appendChild(fill);
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "Cycle progress " + Math.round(cycle.progress * 100) + " percent");
    copy.appendChild(bar);
    copy.setAttribute("data-cycle-day", String(cycle.day));
    copy.setAttribute("data-cycle-phase", cycle.phase);
    row.appendChild(ring);
    row.appendChild(copy);
    head.appendChild(node("span", "", "21-day system"));
    head.appendChild(JournalUI.info("twentyOne"));
    made.body.appendChild(head);
    made.body.appendChild(row);
    made.body.appendChild(node("p", "habit-note", "A win is " + JournalGamify.WIN_AT + " or more done today. Missed habits are not made up tomorrow."));
    return made.root;
  }

  // Levels, XP, and surprise rolls. Remove this function's call to drop them.
  function renderEffort(store, defs, today) {
    var board = JournalGamify.play(store, defs, today);
    var xp = board.xp;
    var todayXp = xp.today;
    var made = section("habit-effort", "Effort", "Effort · level " + xp.level + " · " + xp.xp + " XP");
    var levelRow = node("div", "level-row");
    var bar = node("span", "rate-bar");
    var fill = node("i");
    var surprise = node("div", "surprise-row");
    var bits;
    var head = node("div", "cite-row");
    made.root.setAttribute("data-level", String(xp.level));
    made.root.setAttribute("data-xp", String(xp.xp));
    head.appendChild(node("span", "", "Effort"));
    head.appendChild(JournalUI.info("effort"));
    made.body.appendChild(head);
    levelRow.appendChild(node("b", "", "Level " + xp.level));
    levelRow.appendChild(node("span", "", xp.xp + " XP"));
    fill.style.setProperty("--v", Math.round((xp.into / xp.need) * 100) + "%");
    bar.appendChild(fill);
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", xp.into + " of " + xp.need + " XP to the next level");
    made.body.appendChild(levelRow);
    made.body.appendChild(bar);
    made.body.appendChild(node("p", "habit-note", xp.into + " / " + xp.need + " XP to the next level. " + JournalGamify.XP_HABIT + " XP a habit, " + JournalGamify.XP_WIN + " XP on a win day."));
    if (board.logged && todayXp.done > 0) {
      bits = ["+" + todayXp.habit + " habits"];
      if (todayXp.win) bits.push("+" + todayXp.win + " win");
      if (todayXp.surprise) bits.push("+" + todayXp.surprise + " surprise");
      made.body.appendChild(node("p", "xp-today", "Today · " + bits.join(" · ")));
    }
    surprise.appendChild(node("span", "", "Surprise bonus"));
    surprise.appendChild(JournalUI.info("intermittent"));
    surprise.setAttribute("data-surprise", todayXp.surprise ? "1" : "0");
    if (todayXp.surprise) surprise.appendChild(node("span", "surprise-badge", "+" + JournalGamify.XP_SURPRISE + " XP"));
    made.body.appendChild(surprise);
    return made.root;
  }

  function renderStreaks(store, defs, today, selected, onSelect) {
    var onStreak = 0;
    var i;
    var made;
    var tools;
    var grid;
    for (i = 0; i < defs.length; i++) if (currentStreak(defs[i].id, today) > 0) onStreak += 1;
    made = section("habit-streaks", "Streaks", onStreak === 0 ? "Streaks · no streak yet" : onStreak === 1 ? "Streaks · 1 on a streak" : "Streaks · " + onStreak + " on a streak");
    tools = node("div", "mech-line");
    tools.appendChild(mech("Identity", "identity"));
    tools.appendChild(mech("Milestones", "milestones"));
    tools.appendChild(mech("Difficulty", "moderate"));
    made.body.appendChild(tools);
    grid = node("div", "habit-grid");
    defs.forEach(function (def) {
      grid.appendChild(habitTile(store, def, today, selected, onSelect));
    });
    made.body.appendChild(grid);
    return made.root;
  }

  function mech(label, citeKey) {
    var item = node("span", "mech");
    item.appendChild(node("span", "", label));
    item.appendChild(JournalUI.info(citeKey));
    return item;
  }

  function habitTile(store, def, today, selected, onSelect) {
    var status = JournalData.habitStatus(today, def.id);
    var current = currentStreak(def.id, today);
    var best = bestStreak(def.id, today);
    var streakLabel = current === 1 ? "day in a row" : "days in a row";
    var linchpin = JournalGamify.isLinchpin(def.id);
    var tile = node("article", "habit-tile" + (selected === def.id ? " on" : "") + (linchpin ? " linchpin" : ""));
    var open = button("habit-open");
    var badges = node("div", "badges");
    var hint = JournalGamify.nudge(store, def.id, today);
    var ident = node("p", "identity");
    var name;
    var emoji = node("span", "habit-emoji", def.emoji || "");
    tile.setAttribute("data-habit", def.id);
    tile.setAttribute("data-streak", String(current));
    tile.setAttribute("data-best", String(best));
    tile.setAttribute("data-status", status);
    emoji.setAttribute("aria-hidden", "true");
    open.setAttribute("aria-pressed", selected === def.id ? "true" : "false");
    open.setAttribute("data-select", def.id);
    open.setAttribute("data-focus", "tile:" + def.id);
    open.setAttribute("aria-label", def.label + ", " + current + " " + streakLabel + ", best " + best + ", today " + statusText(status).toLowerCase() + (selected === def.id ? ", selected" : ""));
    open.appendChild(emoji);
    if (!BODY[def.id]) {
      name = node("span", "habit-label", def.label);
      open.appendChild(name);
    }
    open.appendChild(node("span", "habit-streak", String(current)));
    open.appendChild(node("span", "habit-streak-lbl", streakLabel));
    open.appendChild(node("span", "best", "Best " + best));
    open.appendChild(node("span", "today-pill " + status, "Today · " + statusText(status)));
    open.addEventListener("click", function () {
      onSelect(selected === def.id ? "" : def.id, "tile:");
    });
    tile.appendChild(open);
    if (BODY[def.id]) {
      name = node("a", "habit-health", def.label);
      name.href = HEALTH;
      name.setAttribute("data-focus", "link:" + def.id);
      tile.appendChild(name);
    }
    ident.textContent = JournalGamify.identityOf(def.id);
    tile.appendChild(ident);
    if (linchpin) {
      var mark = node("p", "linchpin-mark");
      mark.appendChild(node("span", "", "Linchpin"));
      mark.appendChild(JournalUI.info("linchpin"));
      tile.appendChild(mark);
    }
    JournalGamify.milestoneStates(best).forEach(function (item) {
      var badge = node("span", "badge" + (item.unlocked ? " on" : ""), String(item.days));
      badge.setAttribute("data-days", String(item.days));
      badge.setAttribute("data-unlocked", item.unlocked ? "1" : "0");
      badges.appendChild(badge);
    });
    tile.appendChild(badges);
    if (hint) tile.appendChild(node("p", "nudge " + hint.kind, hint.text));
    return tile;
  }

  function legendItem(className, mark, text) {
    var item = node("span", "legend-item");
    var swatch = node("i", className, mark);
    swatch.setAttribute("aria-hidden", "true");
    item.appendChild(swatch);
    item.appendChild(node("span", "", text));
    return item;
  }

  function renderLegend(selected) {
    var legend = node("div", "heat-legend");
    legend.appendChild(legendItem("hcell sample done", "\u2713", "Done"));
    legend.appendChild(legendItem("hcell sample miss", "\u00d7", "Not done"));
    legend.appendChild(legendItem("hcell sample unknown", "", "Unknown"));
    legend.appendChild(legendItem("hcell sample none", "", "No log"));
    if (!selected) {
      legend.appendChild(node("span", "legend-label", "Less"));
      [0, 1, 2, 3, 4, 5].forEach(function (n) {
        var swatch = node("i", "hcell sample lv" + n, n ? String(n) : "0");
        swatch.setAttribute("aria-hidden", "true");
        legend.appendChild(swatch);
      });
      legend.appendChild(node("span", "legend-label", "More"));
    }
    return legend;
  }

  function cellInfo(day, defs, selected, today) {
    var name;
    var status;
    var summary;
    var mark;
    var cls;
    if (day > today) return { className: "hcell future", text: JournalData.label(day) + " · ahead", status: "future", mark: "" };
    if (selected) {
      name = findDef(defs, selected);
      name = name ? name.label : selected;
      status = JournalData.habitStatus(day, selected);
      if (status === "none") status = "none";
      mark = status === "done" ? "\u2713" : status === "miss" ? "\u00d7" : "";
      cls = "hcell " + (status === "done" ? "done" : status === "miss" ? "miss" : status === "unknown" ? "unknown" : "none");
      return {
        className: cls,
        text: JournalData.label(day) + " · " + name + " · " + statusText(status === "none" ? "none" : status).toLowerCase(),
        status: status,
        mark: mark
      };
    }
    summary = daySummary(day, defs);
    if (summary.state === "none") return { className: "hcell none", text: JournalData.label(day) + " · no log", status: "none", mark: "" };
    if (summary.state === "unknown") return { className: "hcell unknown", text: JournalData.label(day) + " · unknown", status: "unknown", mark: "" };
    cls = "hcell lv" + level(summary.rate) + (summary.unknown ? " mixed" : "");
    return {
      className: cls,
      text: JournalData.label(day) + " · " + summary.done + " of " + summary.total + " done" + (summary.unknown ? " · " + summary.unknown + " unknown" : ""),
      status: summary.miss && !summary.done ? "miss" : "level",
      mark: String(summary.done)
    };
  }

  function heatWeeks(today) {
    var week = JournalData.todayKey("week", localDate(today));
    var weeks = [];
    var i;
    for (i = 0; i < HEAT_WEEKS - 1; i++) week = JournalData.shift(week, -1);
    for (i = 0; i < HEAT_WEEKS; i++) {
      weeks.push({ key: week, days: JournalData.children(week) || [] });
      week = JournalData.shift(week, 1);
    }
    return weeks;
  }

  function loggedCount(weeks, defs, today) {
    var n = 0;
    weeks.forEach(function (week) {
      (week.days || []).forEach(function (day) {
        if (day <= today && daySummary(day, defs).state !== "none") n += 1;
      });
    });
    return n;
  }

  function renderHeat(defs, today, selected, onSelect) {
    var weeks = heatWeeks(today);
    var loggedDays = loggedCount(weeks, defs, today);
    var focus = selected ? findDef(defs, selected) : null;
    var summary = "Year in days · " + (focus ? focus.label + " · " : "") + loggedDays + (loggedDays === 1 ? " day logged" : " days logged");
    var made = section("habit-year", "Year in days", summary);
    var chips = node("div", "habit-chips");
    var scroll = node("div", "heat-scroll");
    var months = node("div", "heat-months");
    var body = node("div", "heat-body");
    var dow = node("div", "heat-dow");
    var cols = node("div", "heat-cols");
    var detail = node("p", "heat-detail", "Choose a day to see how it went.");
    var columns = [];
    made.body.appendChild(node("p", "habit-note", selected ? "One habit across the last year. Stripes mean unknown." : "How many habits were done each day. Stripes mean unknown."));
    chips.appendChild(chipButton("", "All habits", !selected, onSelect));
    defs.forEach(function (def) {
      chips.appendChild(chipButton(def.id, def.label, selected === def.id, onSelect));
    });
    made.body.appendChild(chips);
    DOW.forEach(function (label) { dow.appendChild(node("span", "", label)); });
    weeks.forEach(function (week, colIndex) {
      var col = node("div", "heat-col");
      var monthLabel = "";
      var cells = [];
      (week.days || []).forEach(function (day, rowIndex) {
        var info = cellInfo(day, defs, selected, today);
        var cell = day > today ? node("span", info.className) : button(info.className);
        if (day.slice(8, 10) === "01") monthLabel = MONTHS[Number(day.slice(5, 7)) - 1];
        if (day === today) cell.classList.add("today");
        cell.setAttribute("data-day", day);
        cell.setAttribute("data-status", info.status);
        if (info.mark) cell.textContent = info.mark;
        if (day <= today && cell.tagName === "BUTTON") {
          cell.setAttribute("aria-label", info.text);
          cell.setAttribute("data-col", String(colIndex));
          cell.setAttribute("data-row", String(rowIndex));
          cell.addEventListener("click", function () {
            detail.textContent = info.text;
            announce(info.text);
          });
          cell.addEventListener("keydown", function (event) {
            var next = null;
            var colN = colIndex;
            var rowN = rowIndex;
            if (event.key === "ArrowRight") next = moveCell(columns, colN + 1, rowN);
            else if (event.key === "ArrowLeft") next = moveCell(columns, colN - 1, rowN);
            else if (event.key === "ArrowDown") next = moveCell(columns, colN, rowN + 1);
            else if (event.key === "ArrowUp") next = moveCell(columns, colN, rowN - 1);
            if (next) {
              event.preventDefault();
              next.focus();
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              detail.textContent = info.text;
              announce(info.text);
            }
          });
        }
        cells.push(cell);
        col.appendChild(cell);
      });
      columns.push(cells);
      months.appendChild(node("span", "heat-month", monthLabel));
      cols.appendChild(col);
    });
    body.appendChild(dow);
    body.appendChild(cols);
    scroll.appendChild(months);
    scroll.appendChild(body);
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "group");
    scroll.setAttribute("aria-label", "Year of days");
    made.body.appendChild(scroll);
    made.body.appendChild(renderLegend(selected));
    made.body.appendChild(detail);
    if (!loggedDays) made.body.appendChild(node("p", "habit-note", "No habit log in this year yet."));
    requestAnimationFrame(function () {
      var current = cols.querySelector(".today");
      if (!current || !scroll.getBoundingClientRect) return;
      var edge = current.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft;
      scroll.scrollLeft = Math.max(0, edge - scroll.clientWidth + current.offsetWidth + 16);
    });
    return made.root;
  }

  function moveCell(columns, col, row) {
    if (col < 0 || row < 0 || col >= columns.length) return null;
    var cell = columns[col][row];
    if (!cell || cell.tagName !== "BUTTON") return null;
    return cell;
  }

  function chipButton(id, text, pressed, onSelect) {
    var el = button("habit-chip" + (pressed ? " on" : ""));
    el.setAttribute("aria-pressed", pressed ? "true" : "false");
    el.setAttribute("aria-label", id ? text : "All habits");
    el.setAttribute("data-select", id || "all");
    el.setAttribute("data-focus", "chip:" + (id || "all"));
    el.textContent = id ? text : "All";
    el.addEventListener("click", function () { onSelect(id, "chip:"); });
    return el;
  }

  function windowTotals(series, defs, id) {
    var done = 0;
    var total = 0;
    series.forEach(function (item) {
      if (id) {
        var row = item.stats.perHabit[id];
        done += row ? row.done : 0;
        total += row ? row.total : 0;
        return;
      }
      defs.forEach(function (def) {
        var each = item.stats.perHabit[def.id];
        done += each ? each.done : 0;
        total += each ? each.total : 0;
      });
    });
    return { done: done, total: total, rate: total ? done / total : null };
  }

  function chartValues(series, id) {
    return series.map(function (item) {
      if (!id) return item.stats.overall;
      var row = item.stats.perHabit[id];
      return row ? row.rate : null;
    });
  }

  function drawLines(svg, values, xAt, yAt, className) {
    var seg = [];
    function flush() {
      var path;
      var i;
      var d;
      if (!seg.length) return;
      path = svgEl("path");
      d = "M " + seg[0].x + " " + seg[0].y;
      for (i = 1; i < seg.length; i++) d += " L " + seg[i].x + " " + seg[i].y;
      path.setAttribute("d", d);
      path.setAttribute("class", className);
      svg.appendChild(path);
      seg = [];
    }
    values.forEach(function (rate, i) {
      if (rate == null) flush();
      else seg.push({ x: round(xAt(i)), y: round(yAt(rate)) });
    });
    flush();
  }

  function drawDots(svg, values, xAt, yAt, className) {
    values.forEach(function (rate, i) {
      var dot;
      if (rate == null) return;
      dot = svgEl("circle");
      dot.setAttribute("cx", round(xAt(i)));
      dot.setAttribute("cy", round(yAt(rate)));
      dot.setAttribute("r", "3.2");
      dot.setAttribute("class", className);
      svg.appendChild(dot);
    });
  }

  function seriesClass(index, selected, id) {
    var cls = "trend-habit s" + (index % 7);
    if (selected === id) return cls + " is-on";
    if (selected) return cls + " is-dim";
    return cls + " is-quiet";
  }

  function renderChart(series, defs, selected) {
    var plot = { l: 36, r: 352, t: 16, b: 132 };
    var svg = svgEl("svg");
    var n = series.length;
    var cursor = svgEl("rect");
    var overall = chartValues(series, "");
    function xAt(i) {
      if (n <= 1) return (plot.l + plot.r) / 2;
      return plot.l + (i * (plot.r - plot.l)) / (n - 1);
    }
    function yAt(rate) {
      return plot.b - Math.max(0, Math.min(1, rate)) * (plot.b - plot.t);
    }
    svg.setAttribute("viewBox", "0 0 360 148");
    svg.setAttribute("class", "trend-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    [0, 0.5, 1].forEach(function (mark) {
      var y = round(yAt(mark));
      var line = svgEl("line");
      var text = svgEl("text");
      line.setAttribute("x1", plot.l);
      line.setAttribute("x2", plot.r);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "trend-grid");
      text.setAttribute("x", plot.l - 6);
      text.setAttribute("y", y + 3);
      text.setAttribute("class", "trend-axis");
      text.textContent = Math.round(mark * 100);
      svg.appendChild(line);
      svg.appendChild(text);
    });
    cursor.setAttribute("class", "trend-cursor");
    cursor.setAttribute("y", plot.t);
    cursor.setAttribute("height", plot.b - plot.t);
    cursor.setAttribute("visibility", "hidden");
    svg.appendChild(cursor);
    defs.forEach(function (def, index) {
      drawLines(svg, chartValues(series, def.id), xAt, yAt, seriesClass(index, selected, def.id));
      if (selected === def.id) drawDots(svg, chartValues(series, def.id), xAt, yAt, "trend-dot s" + (index % 7));
    });
    drawLines(svg, overall, xAt, yAt, "trend-overall" + (selected ? " is-dim" : " is-on"));
    if (!selected) drawDots(svg, overall, xAt, yAt, "trend-dot overall");
    return { svg: svg, xAt: xAt, plot: plot, cursor: cursor };
  }

  function describePeriod(item, defs, selected) {
    var name = JournalData.label(item.key);
    var row;
    var def;
    if (selected) {
      def = findDef(defs, selected);
      row = item.stats.perHabit[selected];
      if (!row || row.rate == null) return name + " · " + (def ? def.label : selected) + " · no log";
      return name + " · " + (def ? def.label : selected) + " · " + pct(row.rate) + " · " + row.done + " of " + row.total + " days";
    }
    if (item.stats.overall == null) return name + " · no log";
    return name + " · " + pct(item.stats.overall) + " of habits done · " + item.stats.logged + " logged days";
  }

  function trendSummary(kind, headline, focus) {
    var title = kind === "week" ? "Week by week" : "Month by month";
    if (headline.rate == null) return title + " · no log yet";
    if (focus) return title + " · " + focus.label + " · " + pct(headline.rate) + " done";
    return title + " · " + pct(headline.rate) + " done";
  }

  function renderTrend(kind, defs, today, selected, onSelect) {
    var count = kind === "week" ? WEEK_COUNT : MONTH_COUNT;
    var keys = recentKeys(kind, count, today);
    var series = keys.map(function (key) {
      return {
        key: key,
        label: shortLabel(kind, key),
        stats: periodStats(periodDays(key, today), defs)
      };
    });
    var headline = windowTotals(series, defs, selected);
    var focus = selected ? findDef(defs, selected) : null;
    var made = section(kind === "week" ? "habit-weeks" : "habit-months", kind === "week" ? "Week by week" : "Month by month", trendSummary(kind, headline, focus));
    var chart = renderChart(series, defs, selected);
    var labels = node("div", "trend-x");
    var tip = node("p", "trend-tip");
    var list = node("div", "rate-list");
    var stops = node("div", "trend-stops");
    var noun = kind === "week" ? "12 weeks" : "6 months";
    var head = node("p", "trend-head");
    var chartLabel = (kind === "week" ? "Weekly" : "Monthly") + " completion, " + pct(headline.rate) + (focus ? " for " + focus.label : " for all habits") + ".";
    var active = series.length - 1;
    made.root.setAttribute("data-span", kind);
    head.appendChild(node("b", "", pct(headline.rate)));
    head.appendChild(document.createTextNode(focus ? " " + focus.label + " · last " + noun : " of habits done · last " + noun));
    made.body.appendChild(head);
    made.body.appendChild(chart.svg);
    stops.className = "trend-stops";
    stops.setAttribute("role", "group");
    stops.setAttribute("aria-label", chartLabel);
    series.forEach(function (item, index) {
      var stop = button("trend-stop");
      var value = selected ? (item.stats.perHabit[selected] || {}).rate : item.stats.overall;
      stop.setAttribute("aria-label", describePeriod(item, defs, selected));
      stop.setAttribute("tabindex", index === active ? "0" : "-1");
      stop.setAttribute("data-index", String(index));
      stop.appendChild(node("span", "trend-stop-label", item.label));
      stop.appendChild(node("span", "trend-stop-pct", value == null ? "\u2013" : pct(value)));
      stop.addEventListener("focus", function () { show(index, false); });
      stop.addEventListener("keydown", function (event) {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(Math.min(series.length - 1, indexFrom(stop) + 1));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(Math.max(0, indexFrom(stop) - 1));
        } else if (event.key === "Home") {
          event.preventDefault();
          move(0);
        } else if (event.key === "End") {
          event.preventDefault();
          move(series.length - 1);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          announce(stop.getAttribute("aria-label"));
        }
      });
      stops.appendChild(stop);
    });
    made.body.appendChild(stops);
    labels.style.setProperty("--n", String(series.length));
    series.forEach(function (item, index) {
      var mid = Math.floor((series.length - 1) / 2);
      var showLabel = series.length <= 6 || index === 0 || index === series.length - 1 || index === mid;
      labels.appendChild(node("span", "", showLabel ? item.label : ""));
    });
    made.body.appendChild(labels);
    tip.textContent = describePeriod(series[active], defs, selected);
    made.body.appendChild(tip);

    function indexFrom(stop) {
      return Number(stop.getAttribute("data-index"));
    }

    function show(index, speak) {
      var slot = (chart.plot.r - chart.plot.l) / series.length;
      var x = chart.xAt(index) - slot / 2;
      var text = describePeriod(series[index], defs, selected);
      chart.cursor.setAttribute("x", round(Math.max(chart.plot.l, x)));
      chart.cursor.setAttribute("width", round(slot));
      chart.cursor.setAttribute("visibility", "visible");
      tip.textContent = text;
      if (speak) announce(text);
    }

    function move(index) {
      var buttons = stops.querySelectorAll(".trend-stop");
      var i;
      for (i = 0; i < buttons.length; i++) buttons[i].setAttribute("tabindex", i === index ? "0" : "-1");
      show(index, true);
      buttons[index].focus();
    }

    show(active, false);

    function addRow(id, label, rate, index, pressed) {
      var row = button("rate-row" + (pressed ? " on" : ""));
      var bar = node("span", "rate-bar" + (id ? " hue s" + (index % 7) : ""));
      var fill = node("i");
      var swatch = node("span", "rate-swatch" + (id ? " s" + (index % 7) : " overall"));
      row.setAttribute("aria-pressed", pressed ? "true" : "false");
      row.setAttribute("aria-label", label + ", " + pct(rate));
      row.setAttribute("data-select", id || "all");
      row.setAttribute("data-focus", "rate:" + kind + ":" + (id || "all"));
      swatch.setAttribute("aria-hidden", "true");
      row.appendChild(swatch);
      row.appendChild(node("span", "rate-name", label));
      row.appendChild(node("span", "rate-num", pct(rate)));
      fill.style.setProperty("--v", rate == null ? "0%" : Math.round(rate * 100) + "%");
      bar.appendChild(fill);
      row.appendChild(bar);
      row.addEventListener("click", function () { onSelect(pressed ? "" : id, "rate:" + kind + ":"); });
      list.appendChild(row);
    }

    addRow("", "All habits", windowTotals(series, defs, "").rate, 0, !selected);
    defs.forEach(function (def, index) {
      addRow(def.id, def.label, windowTotals(series, defs, def.id).rate, index, selected === def.id);
    });
    made.body.appendChild(list);
    return made.root;
  }

  function render(root, opts) {
    var defs;
    var today;
    var selected;
    var store;
    opts = opts || {};
    if (!window.JournalData || !window.JournalUI || !window.JournalGamify) {
      throw new Error("Habits view needs JournalData, JournalUI, and JournalGamify");
    }
    today = opts.today || JournalData.todayKey("day", new Date());
    defs = JournalData.habitDefs();
    selected = selectedId(opts.key, defs);
    store = readStore(today);
    root.classList.add("habit-view");
    root.textContent = "";

    function onSelect(id, focusKind) {
      var next = id || "";
      var hash = next ? "#habits/" + encodeURIComponent(next) : "#habits";
      var focus = (focusKind || "chip:") + (next || "all");
      if (location.hash !== hash) location.hash = hash;
      render(root, { key: next, today: today, focus: focus });
    }

    root.appendChild(renderToday(store, defs, today));
    root.appendChild(renderEffort(store, defs, today));
    root.appendChild(renderStreaks(store, defs, today, selected, onSelect));
    root.appendChild(renderHeat(defs, today, selected, onSelect));
    root.appendChild(renderTrend("week", defs, today, selected, onSelect));
    root.appendChild(renderTrend("month", defs, today, selected, onSelect));

    if (opts.focus && /^[a-z0-9:-]+$/i.test(opts.focus)) {
      var el = root.querySelector('[data-focus="' + opts.focus + '"]');
      if (el && el.focus) el.focus();
    }
  }

  window.JournalViews = window.JournalViews || {};
  window.JournalViews.habits = render;
})();

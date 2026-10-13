(function () {
  "use strict";

  var WEEK_COUNT = 12;
  var MONTH_COUNT = 6;
  var HEAT_WEEKS = 53;
  var HUES = [28, 152, 198, 262, 340, 48, 174];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SVG = "http://www.w3.org/2000/svg";

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

  function pct(rate) {
    if (rate == null) return "–";
    return Math.round(rate * 100) + "%";
  }

  function hue(index) {
    return HUES[index % HUES.length];
  }

  function findDef(defs, id) {
    var i;
    for (i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i];
    return null;
  }

  function statusText(status) {
    if (status === "done") return "Done";
    if (status === "miss") return "Not done";
    if (status === "unknown") return "Unknown";
    return "No log";
  }

  function level(rate) {
    if (rate <= 0) return 0;
    if (rate <= 0.2) return 1;
    if (rate <= 0.4) return 2;
    if (rate <= 0.6) return 3;
    if (rate <= 0.8) return 4;
    return 5;
  }

  function logged(entry) {
    return !!(entry && entry.habits && typeof entry.habits === "object" && !Array.isArray(entry.habits));
  }

  function daysOfWeek(week, today) {
    return JournalCore.weekDays(week).filter(function (day) { return day <= today; });
  }

  function daysOfMonth(month, today) {
    var year = Number(month.slice(0, 4));
    var m = Number(month.slice(5, 7));
    var last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    var out = [];
    var d;
    for (d = 1; d <= last; d++) {
      var key = month + "-" + (d < 10 ? "0" : "") + d;
      if (key > today) break;
      out.push(key);
    }
    return out;
  }

  function periodKeys(kind, count, now) {
    var key = JournalCore.todayKey(kind, now);
    var keys = [];
    var i;
    for (i = count - 1; i >= 0; i--) keys.push(JournalCore.shift(key, -i));
    return keys;
  }

  function shortLabel(kind, key) {
    if (kind === "week") {
      var start = JournalCore.weekDays(key)[0];
      return Number(start.slice(5, 7)) + "/" + Number(start.slice(8, 10));
    }
    return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(2, 4);
  }

  function buildSeries(kind, count, now, today, defs, store) {
    return periodKeys(kind, count, now).map(function (key) {
      var days = kind === "week" ? daysOfWeek(key, today) : daysOfMonth(key, today);
      return {
        key: key,
        label: shortLabel(kind, key),
        stats: JournalCore.habitStats(store, defs, days)
      };
    });
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

  function heatWeeks(now) {
    var week = JournalCore.weekKey(now);
    var i;
    for (i = 0; i < HEAT_WEEKS - 1; i++) week = JournalCore.shift(week, -1);
    var weeks = [];
    for (i = 0; i < HEAT_WEEKS; i++) {
      weeks.push({ key: week, days: JournalCore.weekDays(week) });
      week = JournalCore.shift(week, 1);
    }
    return weeks;
  }

  function cellInfo(day, entry, defs, selected, today) {
    if (day > today) return { className: "hcell future", text: JournalCore.label(day) + " · ahead" };
    if (selected) {
      var def = findDef(defs, selected);
      var name = def ? def.emoji + " " + def.label : selected;
      if (!logged(entry)) return { className: "hcell none", text: JournalCore.label(day) + " · " + name + " · no log" };
      var status = JournalCore.habitStatus(entry, selected);
      var cls = status === "done" ? "hcell done" : status === "miss" ? "hcell miss" : "hcell unknown";
      return { className: cls, text: JournalCore.label(day) + " · " + name + " · " + statusText(status === "none" ? "unknown" : status).toLowerCase() };
    }
    var summary = JournalCore.dayCompletion(entry, defs);
    if (summary.state === "none") return { className: "hcell none", text: JournalCore.label(day) + " · no log" };
    if (summary.state === "unknown") return { className: "hcell unknown", text: JournalCore.label(day) + " · unknown" };
    var mixed = summary.unknown ? " mixed" : "";
    var extra = summary.unknown ? " · " + summary.unknown + " unknown" : "";
    return {
      className: "hcell lv" + level(summary.rate) + mixed,
      text: JournalCore.label(day) + " · " + summary.done + "/" + summary.total + " done" + extra
    };
  }

  function renderCards(store, defs, today, selected, onSelect) {
    var section = node("section", "card");
    var grid = node("div", "habit-grid");
    section.appendChild(node("h3", "", "✨ Streaks"));
    if (!store.habitDefs) {
      section.appendChild(node("p", "habit-note", "Showing the default habits until journal.json includes habitDefs."));
    }
    defs.forEach(function (def) {
      var status = JournalCore.habitStatus(store.entries[today], def.id);
      var current = JournalCore.currentStreak(store, def.id, today);
      var best = JournalCore.bestStreak(store, def.id, today);
      var tile = button("habit-tile" + (selected === def.id ? " on" : ""));
      var streak = node("span", "habit-streak", String(current));
      tile.setAttribute("data-habit", def.id);
      tile.setAttribute("data-streak", String(current));
      tile.setAttribute("data-best", String(best));
      tile.setAttribute("data-status", status);
      tile.setAttribute("aria-pressed", selected === def.id ? "true" : "false");
      tile.appendChild(node("span", "habit-emoji", def.emoji));
      tile.appendChild(node("span", "habit-label", def.label));
      tile.appendChild(streak);
      tile.appendChild(node("span", "habit-streak-lbl", current > 1 ? "days in a row" : "day streak"));
      tile.appendChild(node("span", "best", "Best " + best));
      tile.appendChild(node("span", "today-pill " + status, "Today · " + statusText(status)));
      tile.addEventListener("click", function () {
        onSelect(selected === def.id ? "" : def.id);
      });
      grid.appendChild(tile);
    });
    section.appendChild(grid);
    return section;
  }

  function legendItem(className, text) {
    var item = node("span", "legend-item");
    item.appendChild(node("i", className));
    item.appendChild(node("span", "", text));
    return item;
  }

  function renderLegend(selected) {
    var legend = node("div", "heat-legend");
    if (selected) {
      legend.appendChild(legendItem("hcell done", "Done"));
      legend.appendChild(legendItem("hcell miss", "Not done"));
      legend.appendChild(legendItem("hcell unknown", "Unknown"));
      legend.appendChild(legendItem("hcell none", "No log"));
      return legend;
    }
    legend.appendChild(legendItem("hcell none", "No log"));
    legend.appendChild(legendItem("hcell unknown", "Unknown"));
    legend.appendChild(node("span", "legend-label", "Less"));
    [0, 1, 2, 3, 4, 5].forEach(function (n) { legend.appendChild(node("i", "hcell lv" + n)); });
    legend.appendChild(node("span", "legend-label", "More"));
    return legend;
  }

  function renderHeat(store, defs, today, now, selected, onSelect) {
    var section = node("section", "card");
    var chips = node("div", "habit-chips");
    var scroll = node("div", "heat-scroll");
    var months = node("div", "heat-months");
    var body = node("div", "heat-body");
    var dow = node("div", "heat-dow");
    var cols = node("div", "heat-cols");
    var detail = node("p", "heat-detail", "Tap a day to see how it went.");
    var weeks = heatWeeks(now);
    var loggedDays = 0;
    section.appendChild(node("h3", "", "🗓️ Year in days"));
    section.appendChild(node("p", "habit-note", selected ? "One habit across the last year." : "Share of habits done each day. Unknown stays hatched."));

    function chip(id, text, pressed) {
      var el = button("habit-chip" + (pressed ? " on" : ""), text);
      el.setAttribute("aria-pressed", pressed ? "true" : "false");
      el.addEventListener("click", function () { onSelect(id); });
      return el;
    }
    chips.appendChild(chip("", "All", !selected));
    defs.forEach(function (def) {
      chips.appendChild(chip(def.id, def.emoji + " " + def.label, selected === def.id));
    });
    section.appendChild(chips);

    ["Mon", "", "Wed", "", "Fri", "", ""].forEach(function (label) {
      dow.appendChild(node("span", "", label));
    });
    weeks.forEach(function (week) {
      var col = node("div", "heat-col");
      var monthLabel = "";
      week.days.forEach(function (day) {
        if (day.slice(8, 10) === "01") monthLabel = MONTHS[Number(day.slice(5, 7)) - 1];
        var entry = store.entries[day];
        var info = cellInfo(day, entry, defs, selected, today);
        var cell = day > today ? node("span", info.className) : button(info.className);
        if (logged(entry) && day <= today) loggedDays += 1;
        if (day === today) cell.classList.add("today");
        cell.setAttribute("data-day", day);
        cell.setAttribute("aria-label", info.text);
        if (day <= today && cell.tagName === "BUTTON") {
          cell.addEventListener("click", function () { detail.textContent = info.text; });
          cell.addEventListener("mouseenter", function () { detail.textContent = info.text; });
          cell.addEventListener("focus", function () { detail.textContent = info.text; });
        }
        col.appendChild(cell);
      });
      months.appendChild(node("span", "heat-month", monthLabel));
      cols.appendChild(col);
    });
    body.appendChild(dow);
    body.appendChild(cols);
    scroll.appendChild(months);
    scroll.appendChild(body);
    section.appendChild(scroll);
    section.appendChild(renderLegend(selected));
    section.appendChild(detail);
    if (!loggedDays) section.appendChild(node("p", "habit-note", "No habit log in this year yet."));
    requestAnimationFrame(function () {
      var current = cols.querySelector(".today");
      var edge;
      if (!current) return;
      edge = current.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft;
      scroll.scrollLeft = Math.max(0, edge - scroll.clientWidth + current.offsetWidth + 16);
    });
    return section;
  }

  function describePeriod(item, defs, selected) {
    var name = JournalCore.label(item.key);
    if (selected) {
      var def = findDef(defs, selected);
      var row = item.stats.perHabit[selected];
      var title = def ? def.emoji + " " + def.label : selected;
      if (!row || row.rate == null) return name + " · " + title + " · no log";
      return name + " · " + title + " · " + pct(row.rate) + " · " + row.done + "/" + row.total + " days";
    }
    if (item.stats.overall == null) return name + " · no log";
    return name + " · " + pct(item.stats.overall) + " of habits done · " + item.stats.logged + " logged days";
  }

  function chartValues(series, defs, id) {
    return series.map(function (item) {
      if (!id) return item.stats.overall;
      var row = item.stats.perHabit[id];
      return row ? row.rate : null;
    });
  }

  function drawLines(svg, values, xAt, yAt, plot, className, style) {
    var seg = [];
    function flush() {
      var path, i, d;
      if (!seg.length) return;
      path = svgEl("path");
      d = "M " + seg[0].x + " " + seg[0].y;
      for (i = 1; i < seg.length; i++) d += " L " + seg[i].x + " " + seg[i].y;
      path.setAttribute("d", d);
      path.setAttribute("class", className);
      if (style) path.setAttribute("style", style);
      svg.appendChild(path);
      seg = [];
    }
    values.forEach(function (rate, i) {
      if (rate == null) flush();
      else seg.push({ x: round(xAt(i)), y: round(yAt(rate)) });
    });
    flush();
  }

  function drawArea(svg, values, xAt, yAt, plot) {
    var seg = [];
    function flush() {
      var path, i, d;
      if (seg.length < 2) {
        seg = [];
        return;
      }
      path = svgEl("path");
      d = "M " + seg[0].x + " " + seg[0].y;
      for (i = 1; i < seg.length; i++) d += " L " + seg[i].x + " " + seg[i].y;
      d += " L " + seg[seg.length - 1].x + " " + plot.b + " L " + seg[0].x + " " + plot.b + " Z";
      path.setAttribute("d", d);
      path.setAttribute("class", "trend-area");
      svg.appendChild(path);
      seg = [];
    }
    values.forEach(function (rate, i) {
      if (rate == null) flush();
      else seg.push({ x: round(xAt(i)), y: round(yAt(rate)) });
    });
    flush();
  }

  function drawDots(svg, values, xAt, yAt, className, style) {
    values.forEach(function (rate, i) {
      var dot;
      if (rate == null) return;
      dot = svgEl("circle");
      dot.setAttribute("cx", round(xAt(i)));
      dot.setAttribute("cy", round(yAt(rate)));
      dot.setAttribute("r", "2.8");
      dot.setAttribute("class", className);
      if (style) dot.setAttribute("style", style);
      svg.appendChild(dot);
    });
  }

  function renderChart(series, defs, selected) {
    var plot = { l: 36, r: 352, t: 14, b: 132 };
    var svg = svgEl("svg");
    var n = series.length;
    var cursor = svgEl("rect");
    var overall = chartValues(series, defs, "");
    function xAt(i) {
      if (n <= 1) return (plot.l + plot.r) / 2;
      return plot.l + (i * (plot.r - plot.l)) / (n - 1);
    }
    function yAt(rate) {
      return plot.b - Math.max(0, Math.min(1, rate)) * (plot.b - plot.t);
    }
    svg.setAttribute("viewBox", "0 0 360 148");
    svg.setAttribute("class", "trend-svg");
    svg.setAttribute("role", "img");
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
    if (!selected) drawArea(svg, overall, xAt, yAt, plot);
    defs.forEach(function (def, index) {
      var values = chartValues(series, defs, def.id);
      var dim = selected && selected !== def.id;
      var quiet = !selected;
      var width = selected === def.id ? 2.6 : 1.5;
      drawLines(svg, values, xAt, yAt, plot, "trend-habit" + (dim ? " dim" : quiet ? " quiet" : ""), "--h:" + hue(index) + ";stroke-width:" + width);
      if (selected === def.id) drawDots(svg, values, xAt, yAt, "trend-dot", "--h:" + hue(index));
    });
    drawLines(svg, overall, xAt, yAt, plot, "trend-overall" + (selected ? " dim" : ""), "");
    if (!selected) drawDots(svg, overall, xAt, yAt, "trend-dot overall", "");
    return { svg: svg, xAt: xAt, plot: plot, cursor: cursor };
  }

  function renderTrend(kind, store, defs, today, now, selected, onSelect) {
    var count = kind === "week" ? WEEK_COUNT : MONTH_COUNT;
    var series = buildSeries(kind, count, now, today, defs, store);
    var section = node("section", "card trend");
    var chart = renderChart(series, defs, selected);
    var labels = node("div", "trend-x");
    var tip = node("p", "trend-tip");
    var list = node("div", "rate-list");
    var headline = windowTotals(series, defs, selected);
    var noun = kind === "week" ? "12 weeks" : "6 months";
    var title = kind === "week" ? "📊 Week by week" : "🌙 Month by month";
    var focus = selected ? findDef(defs, selected) : null;
    var head = node("p", "trend-head");
    section.setAttribute("data-span", kind);
    section.appendChild(node("h3", "", title));
    head.appendChild(node("b", "", pct(headline.rate)));
    head.appendChild(document.createTextNode(focus ? " " + focus.label + " · last " + noun : " of habits done · last " + noun));
    section.appendChild(head);
    chart.svg.setAttribute("aria-label", (kind === "week" ? "Weekly" : "Monthly") + " completion, " + pct(headline.rate) + (focus ? " for " + focus.label : " for all habits") + ".");
    section.appendChild(chart.svg);
    labels.style.setProperty("--n", String(series.length));
    series.forEach(function (item, index) {
      var mid = Math.floor((series.length - 1) / 2);
      var showLabel = series.length <= 6 || index === 0 || index === series.length - 1 || index === mid;
      labels.appendChild(node("span", "", showLabel ? item.label : ""));
    });
    section.appendChild(labels);
    tip.textContent = describePeriod(series[series.length - 1], defs, selected);
    section.appendChild(tip);

    function show(index) {
      var slot = (chart.plot.r - chart.plot.l) / series.length;
      var x = chart.xAt(index) - slot / 2;
      chart.cursor.setAttribute("x", round(Math.max(chart.plot.l, x)));
      chart.cursor.setAttribute("width", round(slot));
      chart.cursor.setAttribute("visibility", "visible");
      tip.textContent = describePeriod(series[index], defs, selected);
    }
    series.forEach(function (item, index) {
      var slot = (chart.plot.r - chart.plot.l) / series.length;
      var rect = svgEl("rect");
      rect.setAttribute("class", "trend-hit");
      rect.setAttribute("x", round(chart.xAt(index) - slot / 2));
      rect.setAttribute("y", chart.plot.t);
      rect.setAttribute("width", round(slot));
      rect.setAttribute("height", chart.plot.b - chart.plot.t);
      rect.setAttribute("tabindex", "0");
      rect.setAttribute("role", "button");
      rect.setAttribute("aria-label", describePeriod(item, defs, selected));
      function activate() { show(index); }
      rect.addEventListener("mouseenter", activate);
      rect.addEventListener("focus", activate);
      rect.addEventListener("click", activate);
      rect.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      chart.svg.appendChild(rect);
    });
    show(series.length - 1);

    function addRow(id, label, rate, rowHue, pressed) {
      var row = button("rate-row" + (pressed ? " on" : ""));
      var bar = node("span", "rate-bar" + (id ? " hue" : ""));
      var fill = node("i");
      row.setAttribute("aria-pressed", pressed ? "true" : "false");
      row.appendChild(node("span", "rate-swatch" + (id ? "" : " overall")));
      row.lastChild.style.setProperty("--h", String(rowHue));
      row.appendChild(node("span", "rate-name", label));
      row.appendChild(node("span", "rate-num", pct(rate)));
      fill.style.setProperty("--v", rate == null ? "0%" : Math.round(rate * 100) + "%");
      if (id) bar.style.setProperty("--h", String(rowHue));
      bar.appendChild(fill);
      row.appendChild(bar);
      row.addEventListener("click", function () { onSelect(pressed ? "" : id); });
      list.appendChild(row);
    }
    addRow("", "All habits", windowTotals(series, defs, "").rate, 152, !selected);
    defs.forEach(function (def, index) {
      addRow(def.id, def.emoji + " " + def.label, windowTotals(series, defs, def.id).rate, hue(index), selected === def.id);
    });
    section.appendChild(list);
    return section;
  }

  function render(root, store, opts) {
    var defs = JournalCore.habitDefsOf(store);
    var today = opts.today;
    var now = opts.now || new Date();
    var selected = findDef(defs, opts.selected) ? opts.selected : "";
    var safeStore = store || { entries: {} };
    if (!safeStore.entries) safeStore = { entries: {}, habitDefs: store && store.habitDefs };
    function onSelect(id) {
      if (opts.onSelect) opts.onSelect(id || "");
    }
    root.appendChild(renderCards(safeStore, defs, today, selected, onSelect));
    root.appendChild(renderHeat(safeStore, defs, today, now, selected, onSelect));
    root.appendChild(renderTrend("week", safeStore, defs, today, now, selected, onSelect));
    root.appendChild(renderTrend("month", safeStore, defs, today, now, selected, onSelect));
  }

  window.JournalHabits = { render: render };
})();

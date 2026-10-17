(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var WIDTH = 320;
  var HEIGHT = 180;
  var PAD_L = 36;
  var PAD_R = 12;
  var PAD_T = 16;
  var PAD_B = 12;

  function svgEl(name) {
    return document.createElementNS(SVG_NS, name);
  }

  function innerHeight() {
    return HEIGHT - PAD_T - PAD_B;
  }

  function xAt(index, count) {
    var inner = WIDTH - PAD_L - PAD_R;
    if (count <= 1) return PAD_L + inner / 2;
    return PAD_L + inner * index / (count - 1);
  }

  function yAt(value) {
    return PAD_T + innerHeight() * (5 - value) / 4;
  }

  // Missing and non-scores stay null so the line breaks. Never plotted as 0.
  function pointValue(value) {
    if (typeof value !== "number" || value !== value) return null;
    if (value < 1 || value > 5) return null;
    return value;
  }

  function linePath(points, prop) {
    var count = points.length;
    var d = "";
    var drawing = false;
    var i;
    for (i = 0; i < count; i++) {
      var value = pointValue(points[i][prop]);
      if (value == null) {
        drawing = false;
        continue;
      }
      d += (drawing ? "L" : "M") + xAt(i, count).toFixed(2) + " " + yAt(value).toFixed(2) + " ";
      drawing = true;
    }
    return d.trim();
  }

  function addMarker(svg, x, y, prop) {
    var mark = svgEl("circle");
    mark.setAttribute("cx", String(x));
    mark.setAttribute("cy", String(y));
    mark.setAttribute("r", "3");
    mark.setAttribute("class", prop === "energy" ? "trend-energy" : "trend-mood");
    svg.appendChild(mark);
  }

  function legendLine(prop) {
    var svg = svgEl("svg");
    var line = svgEl("line");
    svg.setAttribute("viewBox", "0 0 44 12");
    svg.setAttribute("class", "trend-key");
    svg.setAttribute("aria-hidden", "true");
    line.setAttribute("x1", "2");
    line.setAttribute("x2", "42");
    line.setAttribute("y1", "6");
    line.setAttribute("y2", "6");
    line.setAttribute("class", prop === "energy" ? "trend-energy" : "trend-mood");
    svg.appendChild(line);
    return svg;
  }

  function legend(parent) {
    var list = document.createElement("ul");
    var mood = document.createElement("li");
    var energy = document.createElement("li");
    list.className = "trend-legend";
    mood.appendChild(legendLine("mood"));
    mood.appendChild(document.createTextNode("Mood, solid line"));
    energy.appendChild(legendLine("energy"));
    energy.appendChild(document.createTextNode("Energy, dashed line"));
    list.appendChild(mood);
    list.appendChild(energy);
    parent.appendChild(list);
  }

  function cellText(value) {
    var plotted = pointValue(value);
    if (plotted == null) return "Not logged";
    return (Math.round(plotted * 10) / 10).toFixed(1);
  }

  function dataTable(points) {
    var table = document.createElement("table");
    var caption = document.createElement("caption");
    var head = document.createElement("thead");
    var body = document.createElement("tbody");
    var headRow = document.createElement("tr");
    var labels = ["Period", "Mood", "Energy"];
    var i;
    table.className = "period-table";
    table.setAttribute("tabindex", "0");
    caption.textContent = "Mood and energy";
    table.appendChild(caption);
    for (i = 0; i < labels.length; i++) {
      var th = document.createElement("th");
      th.setAttribute("scope", "col");
      th.textContent = labels[i];
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    table.appendChild(head);
    for (i = 0; i < points.length; i++) {
      var row = document.createElement("tr");
      var period = document.createElement("th");
      var mood = document.createElement("td");
      var energy = document.createElement("td");
      period.setAttribute("scope", "row");
      period.textContent = points[i].label || "";
      mood.textContent = cellText(points[i].mood);
      energy.textContent = cellText(points[i].energy);
      row.appendChild(period);
      row.appendChild(mood);
      row.appendChild(energy);
      body.appendChild(row);
    }
    table.appendChild(body);
    return table;
  }

  function mountTableFold(container, points, foldId) {
    var table = dataTable(points);
    var made = null;
    if (window.JournalUI && typeof JournalUI.fold === "function") {
      made = JournalUI.fold({
        id: foldId || "period-data",
        title: "Data table",
        level: 4,
        summary: "Data table",
        emoji: "📋"
      });
    }
    if (!made) {
      var details = document.createElement("details");
      var summary = document.createElement("summary");
      var heading = document.createElement("h4");
      var body = document.createElement("div");
      heading.textContent = "Data table";
      summary.appendChild(heading);
      details.appendChild(summary);
      details.appendChild(body);
      made = { root: details, body: body };
    }
    made.root.classList.add("period-fold", "period-table-fold");
    made.body.appendChild(table);
    container.appendChild(made.root);
  }

  function mount(container, opts) {
    var points = opts && opts.points ? opts.points : [];
    var count = points.length;
    var sentence = opts && opts.label ? opts.label : "No check-ins yet.";
    var svg = svgEl("svg");
    var moodPath = svgEl("path");
    var energyPath = svgEl("path");
    var moods = [];
    var energies = [];
    var i;

    svg.setAttribute("viewBox", "0 0 " + WIDTH + " " + HEIGHT);
    svg.setAttribute("class", "trend-chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", sentence);

    for (i = 1; i <= 5; i++) {
      var grid = svgEl("line");
      var label = svgEl("text");
      var y = yAt(i);
      grid.setAttribute("x1", String(PAD_L));
      grid.setAttribute("x2", String(WIDTH - PAD_R));
      grid.setAttribute("y1", y.toFixed(2));
      grid.setAttribute("y2", y.toFixed(2));
      grid.setAttribute("class", "trend-grid");
      svg.appendChild(grid);
      label.setAttribute("x", "4");
      label.setAttribute("y", (y + 4).toFixed(2));
      label.setAttribute("class", "trend-axis");
      label.textContent = String(i);
      svg.appendChild(label);
    }

    moodPath.setAttribute("class", "trend-mood");
    energyPath.setAttribute("class", "trend-energy");
    moodPath.setAttribute("d", linePath(points, "mood"));
    energyPath.setAttribute("d", linePath(points, "energy"));
    svg.appendChild(moodPath);
    svg.appendChild(energyPath);

    for (i = 0; i < count; i++) {
      var mood = pointValue(points[i].mood);
      var energy = pointValue(points[i].energy);
      moods.push(mood == null ? "" : String(mood));
      energies.push(energy == null ? "" : String(energy));
      if (mood != null) addMarker(svg, xAt(i, count), yAt(mood), "mood");
      if (energy != null) addMarker(svg, xAt(i, count), yAt(energy), "energy");
    }

    svg.setAttribute("data-mood", moods.join(","));
    svg.setAttribute("data-energy", energies.join(","));
    container.appendChild(svg);
    legend(container);
    mountTableFold(container, points, opts && opts.foldId);
  }

  window.JournalTrends = { mount: mount };
})();

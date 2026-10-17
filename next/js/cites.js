(function () {
  "use strict";

  // The one-sentence notes behind the ⓘ buttons on the day and period views.
  var VIDEOS = {
    dopamine: { title: "Controlling Your Dopamine For Motivation, Focus & Satisfaction", by: "Huberman" },
    goals: { title: "How to Set & Achieve Goals | Huberman Lab Essentials", by: "Huberman" },
    contiMental: { title: "Dr. Paul Conti: How to Understand & Assess Your Mental Health | Huberman Lab Guest Series", by: "Huberman" },
    brackett: { title: "How to Better Regulate Your Emotions | Dr. Marc Brackett", by: "Huberman" },
    contiTools: { title: "Tools to Bolster Your Mental Health & Confidence | Dr. Paul Conti", by: "Huberman" },
    balcetis: { title: "Essentials: Tools for Setting & Achieving Goals | Dr. Emily Balcetis", by: "Huberman" }
  };

  var CITES = {
    effort: { video: "dopamine", text: "Let the good feeling come from the effort itself." },
    moderate: { video: "goals", text: "If it is too easy or too hard, change it." },
    gratitude: { video: "contiMental", text: "Being glad for something is part of a healthy mind." },
    feelings: { video: "brackett", text: "Naming the feeling helps you decide what to do." },
    reviews: { video: "contiTools", text: "Notice what you chose and what you did on autopilot." },
    failure: { video: "goals", text: "Seeing what you lose if you skip it makes you more likely to do it." },
    obstacle: { video: "balcetis", text: "Name what could stop you, then decide what you will do." }
  };

  function cite(key) {
    var item = Object.prototype.hasOwnProperty.call(CITES, key) ? CITES[key] : null;
    var video = item ? VIDEOS[item.video] : null;
    return {
      key: key,
      title: video ? video.title : "",
      by: video ? video.by : "",
      text: item ? item.text : ""
    };
  }

  window.JournalCites = { cite: cite };
})();

(function () {
  window.JournalSchemas = {
    order: ["day", "week", "month", "quarter", "year"],
    day: {
      label: "Day",
      icon: "☀️",
      parent: { period: "week", field: "oneThing", prefix: "This week" },
      sections: [
        {
          id: "morning",
          title: "Morning",
          fields: [
            { key: "mood", type: "scale", label: "Mood" },
            { key: "energy", type: "scale", label: "Energy" },
            { key: "focus", type: "text", label: "Focus" },
            { key: "grateful", type: "trio", label: "Grateful" },
            { key: "makeGreat", type: "area", label: "What would make today great" },
            { key: "affirmation", type: "text", label: "A line to repeat" }
          ]
        },
        {
          id: "evening",
          title: "Evening",
          fields: [
            { key: "highlights", type: "area", label: "Highlights" },
            { key: "better", type: "area", label: "What I would change" }
          ]
        },
        {
          id: "todos",
          title: "To-dos",
          fields: [{ key: "todos", type: "todos", carry: true }]
        }
      ]
    },
    week: {
      label: "Week",
      icon: "🗓️",
      parent: { period: "month", field: "oneThing", prefix: "This month" },
      moodStrip: true,
      reviewPrevTodos: "Last week",
      sections: [
        {
          id: "planning",
          title: "Planning",
          fields: [
            { key: "enjoyment", type: "enjoy", label: "How the week felt" },
            { key: "why", type: "text", label: "Why" },
            { key: "oneThing", type: "area", label: "One thing that would make this week good" }
          ]
        },
        {
          id: "review",
          title: "Review",
          fields: [
            { key: "wins", type: "area", label: "Wins" },
            { key: "accomplishments", type: "area", label: "What I finished" },
            { key: "improve", type: "area", label: "What to improve" },
            { key: "rootCause", type: "text", label: "What caused it" }
          ]
        },
        {
          id: "reflection",
          title: "Reflection",
          fields: [
            { key: "grateful", type: "trio", label: "Grateful" },
            { key: "lesson", type: "area", label: "Lesson" }
          ]
        },
        {
          id: "ahead",
          title: "Looking ahead",
          fields: [
            { key: "todos", type: "todos" },
            { key: "watch", type: "area", label: "Watch out for" }
          ]
        }
      ]
    },
    month: {
      label: "Month",
      icon: "🌙",
      parent: { period: "quarter", field: "mainQuest", prefix: "This quarter" },
      reviewPrevTodos: "Last month",
      sections: [
        {
          id: "planning",
          title: "Planning",
          fields: [
            { key: "oneThing", type: "area", label: "One thing that would make this month good" }
          ]
        },
        {
          id: "review",
          title: "Review",
          fields: [
            { key: "wins", type: "area", label: "Wins" },
            { key: "accomplishments", type: "area", label: "What I finished" },
            { key: "improve", type: "area", label: "What to improve" },
            { key: "rootCause", type: "text", label: "What caused it" },
            { key: "goalsReview", type: "area", label: "Did the year goals move?" }
          ]
        },
        {
          id: "todos",
          title: "To-dos",
          fields: [{ key: "todos", type: "todos" }]
        }
      ]
    },
    quarter: {
      label: "Quarter",
      icon: "🧭",
      parent: { period: "year", field: "vision", prefix: "This year" },
      reviewPrevTodos: "Last quarter",
      sections: [
        {
          id: "focus",
          title: "Focus",
          fields: [
            { key: "mainQuest", type: "text", label: "Main goal" },
            { key: "q1", type: "area", label: "Most important goal" },
            { key: "q2", type: "area", label: "What would help most" },
            { key: "q3", type: "area", label: "What would make me proud" },
            { key: "q4", type: "area", label: "What would make the rest easier" },
            { key: "q5", type: "area", label: "What I keep putting off" },
            { key: "q6", type: "area", label: "First two hours of work" },
            { key: "commit90", type: "area", label: "In 90 days I will have" },
            { key: "goingTo", type: "area", label: "How I will do it" }
          ]
        },
        {
          id: "review",
          title: "Review",
          fields: [
            { key: "wins", type: "area", label: "Wins" },
            { key: "improve", type: "area", label: "What to improve" },
            { key: "yearProgress", type: "area", label: "Did the year goals move?" }
          ]
        },
        {
          id: "todos",
          title: "To-dos",
          fields: [{ key: "todos", type: "todos" }]
        }
      ]
    },
    year: {
      label: "Year",
      icon: "🏔️",
      sections: [
        {
          id: "vision",
          title: "Vision",
          fields: [
            { key: "vision", type: "area", label: "Who I want to be by December" },
            { key: "principle", type: "text", label: "Guiding line" }
          ]
        },
        {
          id: "goals",
          title: "Goals",
          fields: [{ key: "todos", type: "todos", status: true }]
        },
        {
          id: "review",
          title: "Year-end review",
          fields: [
            { key: "wins", type: "area", label: "Biggest wins" },
            { key: "finished", type: "area", label: "What I finished" },
            { key: "differently", type: "area", label: "What I would change" },
            { key: "lessons", type: "area", label: "Lessons" }
          ]
        }
      ]
    }
  };
})();

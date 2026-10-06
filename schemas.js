(function () {
  window.JournalSchemas = {
    order: ["day", "week", "month", "quarter", "year"],
    day: {
      label: "Day",
      icon: "☀️",
      parent: { period: "week", field: "oneThing", prefix: "🗓️ This week" },
      sections: [
        {
          title: "🌅 Morning",
          fields: [
            { key: "mood", type: "scale", label: "Mood" },
            { key: "energy", type: "scale", label: "Energy" },
            { key: "focus", type: "text", label: "🎯 Focus word" },
            { key: "grateful", type: "trio", label: "🙏 Grateful for" },
            { key: "makeGreat", type: "area", label: "✨ What will make today great" },
            { key: "affirmation", type: "text", label: "🗣️ Daily affirmation" }
          ]
        },
        {
          title: "🌙 Evening",
          fields: [
            { key: "highlights", type: "area", label: "🌟 Highlights" },
            { key: "better", type: "area", label: "🌱 How today could have been better" }
          ]
        },
        {
          title: "✅ To-dos",
          fields: [{ key: "todos", type: "todos", carry: true }]
        }
      ]
    },
    week: {
      label: "Week",
      icon: "🗓️",
      parent: { period: "month", field: "oneThing", prefix: "🌙 This month" },
      moodStrip: true,
      reviewPrevTodos: "🔄 Last week's to-dos",
      sections: [
        {
          title: "🧭 Planning",
          fields: [
            { key: "enjoyment", type: "enjoy", label: "😀 Enjoyment" },
            { key: "why", type: "text", label: "🤔 Why" },
            { key: "oneThing", type: "area", label: "🎯 The one thing that would make this week a success" }
          ]
        },
        {
          title: "🏆 Review",
          fields: [
            { key: "wins", type: "area", label: "🏆 Wins" },
            { key: "accomplishments", type: "area", label: "✅ Accomplishments" },
            { key: "improve", type: "area", label: "🌱 What I could improve" },
            { key: "rootCause", type: "text", label: "🔍 Root cause" }
          ]
        },
        {
          title: "💭 Reflection",
          fields: [
            { key: "grateful", type: "trio", label: "🙏 Grateful for" },
            { key: "lesson", type: "area", label: "💡 Lesson of the week" }
          ]
        },
        {
          title: "🔭 Looking ahead",
          fields: [
            { key: "todos", type: "todos" },
            { key: "watch", type: "area", label: "⚠️ Things to watch out for" }
          ]
        }
      ]
    },
    month: {
      label: "Month",
      icon: "🌙",
      parent: { period: "quarter", field: "mainQuest", prefix: "⚔️ This quarter" },
      reviewPrevTodos: "🔄 Last month's to-dos",
      sections: [
        {
          title: "🌅 Planning",
          fields: [
            { key: "oneThing", type: "area", label: "🎯 The one thing that would make this month a success" }
          ]
        },
        {
          title: "📖 Review",
          fields: [
            { key: "wins", type: "area", label: "🏆 Wins" },
            { key: "accomplishments", type: "area", label: "✅ Accomplishments" },
            { key: "improve", type: "area", label: "🌱 What I could improve" },
            { key: "rootCause", type: "text", label: "🔍 Root cause" },
            { key: "goalsReview", type: "area", label: "🔄 Did I move the year goals forward?" }
          ]
        },
        {
          title: "✅ To-dos",
          fields: [{ key: "todos", type: "todos" }]
        }
      ]
    },
    quarter: {
      label: "Quarter",
      icon: "🧭",
      parent: { period: "year", field: "vision", prefix: "🏔️ This year" },
      reviewPrevTodos: "🔄 Last quarter's to-dos",
      sections: [
        {
          title: "🎯 Focus",
          fields: [
            { key: "mainQuest", type: "text", label: "⚔️ Main quest" },
            { key: "q1", type: "area", label: "🥇 The single most important goal for the next 3 months" },
            { key: "q2", type: "area", label: "📈 What would move the needle the most" },
            { key: "q3", type: "area", label: "🏅 The accomplishment that would make me proud" },
            { key: "q4", type: "area", label: "🔑 The one thing that would make everything else easier" },
            { key: "q5", type: "area", label: "⏳ What I have been postponing" },
            { key: "q6", type: "area", label: "🌄 First two hours of my work day focused on" },
            { key: "commit90", type: "area", label: "🤝 In the next 90 days I will have" },
            { key: "goingTo", type: "area", label: "🛠️ To complete it I am going to" }
          ]
        },
        {
          title: "📖 Review",
          fields: [
            { key: "wins", type: "area", label: "🏆 Wins this quarter" },
            { key: "improve", type: "area", label: "🌱 What to improve next quarter" },
            { key: "yearProgress", type: "area", label: "🔄 Did this quarter move the year goals forward?" }
          ]
        },
        {
          title: "✅ To-dos",
          fields: [{ key: "todos", type: "todos" }]
        }
      ]
    },
    year: {
      label: "Year",
      icon: "🏔️",
      sections: [
        {
          title: "🌟 Vision",
          fields: [
            { key: "vision", type: "area", label: "🌟 The person I want to be by December" },
            { key: "principle", type: "text", label: "🧭 Guiding principle" }
          ]
        },
        {
          title: "🎯 Goals",
          fields: [{ key: "todos", type: "todos", status: true }]
        },
        {
          title: "📖 Year-end review",
          fields: [
            { key: "wins", type: "area", label: "🏆 Biggest wins" },
            { key: "finished", type: "area", label: "✅ What I finished" },
            { key: "differently", type: "area", label: "🔁 What I would do differently" },
            { key: "lessons", type: "area", label: "💡 Lessons learned" }
          ]
        }
      ]
    }
  };
})();

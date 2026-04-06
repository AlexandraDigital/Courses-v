import React, { useState } from "react";

const outlineData = [
  { week: 1, videos: [{ label: "Lesson 1.1", title: "Introduction: Happiness" }, { label: "Lesson 1.2", title: "Core Concepts: Happiness" }, { label: "Lesson 1.3", title: "Deep Dive: Happiness" }] },
  { week: 2, videos: [{ label: "Lesson 2.1", title: "Introduction: Happiness" }, { label: "Lesson 2.2", title: "Core Concepts: Happiness" }, { label: "Lesson 2.3", title: "Deep Dive: Happiness" }] },
  { week: 3, videos: [{ label: "Lesson 3.1", title: "Introduction: Happiness" }, { label: "Lesson 3.2", title: "Core Concepts: Happiness" }, { label: "Lesson 3.3", title: "Deep Dive: Happiness" }] },
  { week: 4, videos: [{ label: "Lesson 4.1", title: "Introduction: Happiness" }, { label: "Lesson 4.2", title: "Core Concepts: Happiness" }, { label: "Lesson 4.3", title: "Deep Dive: Happiness" }] },
];

export default function App() {
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);

  const generateOutline = async () => {
    setLoading(true);

    try {
      const response = await fetch("https://api.groq.com/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: `
Generate a **clean, structured, and readable course outline** for the following data.
Include: Week, Lesson, Talking Points, Tips, and optional AI examples. Format as markdown:

${JSON.stringify(outlineData)}
`,
          max_tokens: 800,
        }),
      });

      const data = await response.json();
      setOutline(data.result || data.output || "No outline returned. Check API.");
    } catch (err) {
      console.error(err);
      setOutline("Error generating outline. Check console.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6">AI Course Outline Generator</h1>
      <button
        onClick={generateOutline}
        className="mb-6 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        {loading ? "Generating..." : "Generate Outline"}
      </button>
      <div className="w-full max-w-3xl bg-white p-6 rounded shadow overflow-auto">
        {outline ? (
          <pre className="whitespace-pre-wrap">{outline}</pre>
        ) : (
          <p className="text-gray-500">Click "Generate Outline" to create your AI course outline.</p>
        )}
      </div>
    </div>
  );
}

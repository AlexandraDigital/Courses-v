import React, { useState } from "react";

export default function App({ courseData }) {
  const [outline, setOutline] = useState("");
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [thumbnails, setThumbnails] = useState([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  // Generate AI Course Outline
  const generateOutline = async () => {
    setLoadingOutline(true);
    try {
      const response = await fetch("https://api.groq.com/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: `
Generate a **clean, structured, readable course outline** for the following course JSON data.
Include: Week, Lesson, Talking Points, Tips, optional AI examples. Format as markdown.

${JSON.stringify(courseData)}
`,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      setOutline(data.result || data.output || "No outline returned. Check API.");
    } catch (err) {
      console.error(err);
      setOutline("Error generating outline. Check console.");
    }
    setLoadingOutline(false);
  };

  // Generate AI Thumbnails
  const generateThumbnails = async () => {
    setLoadingThumbnails(true);
    try {
      const generated = [];

      for (const week of courseData) {
        for (const video of week.videos) {
          const response = await fetch("https://api.groq.com/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              prompt: `
Generate a professional, realistic **thumbnail image prompt** for a lesson:
Lesson: ${video.title}
Make it visually appealing, clean, clear, with a modern design.
Return as a URL-ready AI image prompt or base64 data URL.
`,
              max_tokens: 300,
            }),
          });

          const data = await response.json();
          generated.push({
            lesson: video.title,
            image: data.result || data.output || "",
          });
        }
      }

      setThumbnails(generated);
    } catch (err) {
      console.error(err);
      setThumbnails([]);
    }
    setLoadingThumbnails(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6">AI Course Builder</h1>

      <button
        onClick={generateOutline}
        className="mb-4 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        {loadingOutline ? "Generating Outline..." : "Generate Outline"}
      </button>

      <button
        onClick={generateThumbnails}
        className="mb-6 px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        {loadingThumbnails ? "Generating Thumbnails..." : "Generate Thumbnails"}
      </button>

      <div className="w-full max-w-4xl bg-white p-6 rounded shadow mb-6 overflow-auto">
        {outline ? (
          <pre className="whitespace-pre-wrap">{outline}</pre>
        ) : (
          <p className="text-gray-500">Your AI-generated course outline will appear here.</p>
        )}
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {thumbnails.length > 0 &&
          thumbnails.map((t, i) => (
            <div key={i} className="bg-white rounded shadow p-2 flex flex-col items-center">
              <div className="mb-2 font-semibold text-center">{t.lesson}</div>
              {t.image ? (
                <img src={t.image} alt={t.lesson} className="w-full h-40 object-cover rounded" />
              ) : (
                <div className="w-full h-40 bg-gray-200 flex items-center justify-center rounded">
                  No image
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

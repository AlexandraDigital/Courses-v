// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import "./index.css";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY; // securely stored in Cloudflare

export default function App() {
  const [tab, setTab] = useState("planner");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [clips, setClips] = useState(JSON.parse(localStorage.getItem("clips") || "[]"));
  const [transcript, setTranscript] = useState(localStorage.getItem("transcript") || "");
  const [course, setCourse] = useState({ topic: "", weeks: 4, videos: 3 });
  const [outline, setOutline] = useState([]);
  const [thumbText, setThumbText] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [error, setError] = useState("");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const combinedCanvasRef = useRef(null);

  // Autosave
  useEffect(() => {
    localStorage.setItem("transcript", transcript);
  }, [transcript]);

  useEffect(() => {
    localStorage.setItem("clips", JSON.stringify(clips));
  }, [clips]);

  // Mouse tracking
  useEffect(() => {
    const handleMouse = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  // Camera preview
  useEffect(() => {
    const initCamera = async () => {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const camVideo = document.createElement("video");
        camVideo.srcObject = camStream;
        camVideo.play();
        const canvas = combinedCanvasRef.current;
        const ctx = canvas.getContext("2d");
        const draw = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        };
        draw();
      } catch (err) {
        setError("Camera access denied. Allow camera and microphone permissions.");
      }
    };
    initCamera();
  }, []);

  // Studio recording
  const startStudio = async () => {
    try {
      setError("");
      let screenStream = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        console.log("Screen capture denied, using camera only");
      }
      const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camVideo = document.createElement("video");
      camVideo.srcObject = cam;
      await camVideo.play();

      let screenVideo;
      if (screenStream) {
        screenVideo = document.createElement("video");
        screenVideo.srcObject = screenStream;
        await screenVideo.play();
      }

      const canvas = combinedCanvasRef.current;
      const ctx = canvas.getContext("2d");

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (screenVideo) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        else {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const camW = canvas.width * 0.25;
        const camH = canvas.height * 0.25;
        ctx.drawImage(camVideo, canvas.width - camW - 10, canvas.height - camH - 10, camW, camH);
        ctx.fillStyle = "rgba(255,0,0,0.7)";
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI * 2);
        ctx.fill();
        requestAnimationFrame(draw);
      };
      draw();

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setClips((prev) => [...prev, url]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setPaused(false);
    } catch (err) {
      setError("Recording failed. Check camera/mic permissions.");
    }
  };

  const stopStudio = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setPaused(false);
  };

  const pauseResume = () => {
    if (!mediaRecorder) return;
    if (paused) {
      mediaRecorder.resume();
      setPaused(false);
    } else {
      mediaRecorder.pause();
      setPaused(true);
    }
  };

  // Transcription
  const startTranscript = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++)
        text += event.results[i][0].transcript;
      setTranscript((prev) => prev + " " + text);
    };
    recognition.start();
  };

  // AI-powered Outline & Subtopics
  const generateCourse = async () => {
    if (!course.topic) return alert("Enter a course topic");
    setError("Generating course outline...");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert course designer.",
            },
            {
              role: "user",
              content: `Create a ${course.weeks}-week course outline on "${course.topic}" with ${course.videos} lessons per week. Provide each lesson with 1-2 subtopics. Return as JSON array: weeks [{week:1, videos:[{label:'', title:'', subtopics:[] }]}].`,
            },
          ],
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        const parsed = JSON.parse(data.choices[0].message.content);
        setOutline(parsed);
        setError("");
      } else {
        setError("Outline generation failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Outline generation failed.");
    }
  };

  // AI Thumbnail Generator
  const generateThumbnail = async () => {
    if (!thumbText) return alert("Enter thumbnail text");
    try {
      setError("Generating thumbnail...");
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: `Create a realistic professional YouTube thumbnail for: ${thumbText}`,
          size: "1024x1024",
        }),
      });
      const data = await res.json();
      if (data.data?.[0]?.url) {
        setThumbnailURL(data.data[0].url);
        setError("");
      } else {
        setError("Thumbnail generation failed");
      }
    } catch (err) {
      console.error(err);
      setError("Thumbnail generation failed");
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center p-6 gap-6">
      <h1 className="text-3xl font-bold text-gradient">🎬 Course Video Studio Pro</h1>

      <div className="flex gap-3">
        {["planner", "studio", "transcript", "thumbnail", "library"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === t ? "bg-gradient-to-r from-orange-400 to-red-500 text-white" : "bg-gray-200 text-black"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="w-full max-w-4xl border p-6 rounded-xl shadow-lg bg-gray-50">
        {/* Planner */}
        {tab === "planner" && (
          <div className="flex flex-col items-center gap-4">
            <input
              type="text"
              placeholder="Course Topic"
              value={course.topic}
              onChange={(e) => setCourse({ ...course, topic: e.target.value })}
              className="border p-2 rounded w-full"
            />
            <button
              onClick={generateCourse}
              className="bg-gradient-to-r from-green-400 to-teal-500 text-white px-4 py-2 rounded-lg"
            >
              Generate AI Outline
            </button>
            <div className="w-full mt-4 flex flex-col items-center gap-3">
              {outline.map((w) => (
                <div key={w.week} className="border p-3 rounded w-full bg-white shadow">
                  <h3 className="font-semibold mb-1">Week {w.week}</h3>
                  <ul className="list-disc ml-6">
                    {w.videos.map((v) => (
                      <li key={v.label}>
                        <strong>{v.title}</strong>
                        {v.subtopics && v.subtopics.length > 0 && (
                          <ul className="list-circle ml-4">
                            {v.subtopics.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Studio */}
        {tab === "studio" && (
          <div className="flex flex-col gap-4 items-center">
            <canvas ref={combinedCanvasRef} width={1280} height={720} className="w-full bg-black rounded-xl shadow-lg" />
            {recording && <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded-lg font-semibold">{paused ? "PAUSED" : "REC 🔴"}</div>}
            {!recording ? (
              <button onClick={startStudio} className="bg-gradient-to-r from-green-400 to-teal-500 text-white px-4 py-2 rounded-lg">
                Start Recording
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={pauseResume} className="bg-yellow-400 text-black px-4 py-2 rounded-lg">
                  {paused ? "Resume" : "Pause"}
                </button>
                <button onClick={stopStudio} className="bg-red-500 text-white px-4 py-2 rounded-lg">
                  Stop
                </button>
              </div>
            )}
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Transcript */}
        {tab === "transcript" && (
          <div className="flex flex-col gap-2">
            <button onClick={startTranscript} className="bg-purple-500 text-white px-4 py-2 rounded-lg mb-2">
              Start Transcription
            </button>
            <textarea value={transcript} readOnly className="w-full h-64 border p-2 rounded" />
          </div>
        )}

        {/* Thumbnail */}
        {tab === "thumbnail" && (
          <div className="flex flex-col gap-2 items-center">
            <input type="text" placeholder="Thumbnail Text" value={thumbText} onChange={(e) => setThumbText(e.target.value)} className="border px-2 py-1 w-full rounded" />
            <button onClick={generateThumbnail} className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-2 rounded-lg">
              Generate AI Thumbnail
            </button>
            {thumbnailURL && <img src={thumbnailURL} alt="Generated Thumbnail" className="w-full max-w-sm rounded shadow-lg mt-2" />}
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Library */}
        {tab === "library" && (
          <div className="flex flex-col gap-2">
            {clips.length === 0 ? <p>No clips yet</p> : clips.map((c, i) => <video key={i} src={c} controls className="w-full rounded" />)}
          </div>
        )}
      </div>
    </div>
  );
}

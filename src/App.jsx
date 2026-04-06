// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import "./index.css";

export default function App() {
  const [tab, setTab] = useState("planner");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [clips, setClips] = useState(JSON.parse(localStorage.getItem("clips") || "[]"));
  const [transcript, setTranscript] = useState(localStorage.getItem("transcript") || "");
  const [course, setCourse] = useState({ topic: "", weeks: [] });
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbURL, setThumbURL] = useState("");
  const [error, setError] = useState("");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [shareLinks, setShareLinks] = useState({});

  const combinedCanvasRef = useRef(null);

  // Autosave
  useEffect(() => localStorage.setItem("transcript", transcript), [transcript]);
  useEffect(() => localStorage.setItem("clips", JSON.stringify(clips)), [clips]);

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
      } catch {
        setError("Camera access denied.");
      }
    };
    initCamera();
  }, []);

  // Studio recording
  const startStudio = async () => {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camVideo = document.createElement("video");
      camVideo.srcObject = cam;
      await camVideo.play();

      const canvas = combinedCanvasRef.current;
      const ctx = canvas.getContext("2d");

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
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
    } catch {
      setError("Recording failed.");
    }
  };

  const stopStudio = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setPaused(false);
  };
  const pauseResume = () => {
    if (!mediaRecorder) return;
    paused ? mediaRecorder.resume() : mediaRecorder.pause();
    setPaused(!paused);
  };

  // Transcript
  const startTranscript = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript((prev) => prev + " " + text);
    };

    recognition.onerror = (e) => setError("Transcription error: " + e.error);
    recognition.onend = () => setRecording(false);

    recognition.start();
    setRecording(true);
    setError("");
    window.transcriptionInstance = recognition;
  };

  // Planner functions
  const addWeek = () => {
    setCourse((prev) => ({ ...prev, weeks: [...prev.weeks, { week: prev.weeks.length + 1, videos: [] }] }));
  };
  const addLesson = (weekIndex) => {
    const updatedWeeks = [...course.weeks];
    updatedWeeks[weekIndex].videos.push({ title: "", subtopics: [""] });
    setCourse({ ...course, weeks: updatedWeeks });
  };
  const updateLesson = (weekIndex, videoIndex, field, value) => {
    const updatedWeeks = [...course.weeks];
    updatedWeeks[weekIndex].videos[videoIndex][field] = value;
    setCourse({ ...course, weeks: updatedWeeks });
  };
  const updateSubtopic = (weekIndex, videoIndex, subIndex, value) => {
    const updatedWeeks = [...course.weeks];
    updatedWeeks[weekIndex].videos[videoIndex].subtopics[subIndex] = value;
    setCourse({ ...course, weeks: updatedWeeks });
  };
  const addSubtopic = (weekIndex, videoIndex) => {
    const updatedWeeks = [...course.weeks];
    updatedWeeks[weekIndex].videos[videoIndex].subtopics.push("");
    setCourse({ ...course, weeks: updatedWeeks });
  };

  // Thumbnail upload
  const handleThumbUpload = (e) => {
    const file = e.target.files[0];
    setThumbFile(file);
    setThumbURL(URL.createObjectURL(file));
  };

  // Share/copy URL
  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    alert("Copied shareable URL!");
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

      <div className="w-full max-w-5xl border p-6 rounded-xl shadow-lg bg-gray-50">
       {/* Planner */}
{tab === "planner" && (
  <div className="flex flex-col gap-4">
    <input
      type="text"
      placeholder="Course Topic"
      value={course.topic}
      onChange={(e) => setCourse({ ...course, topic: e.target.value })}
      className="border p-2 rounded w-full"
    />
    <button onClick={addWeek} className="bg-green-400 text-white px-4 py-2 rounded-lg w-fit">
      Add Week
    </button>
    <div className="flex flex-col gap-3 mt-4">
      {course.weeks.map((week, wIdx) => (
        <div key={wIdx} className="border p-3 rounded bg-white shadow relative">
          <h3 className="font-semibold mb-2 flex justify-between items-center">
            Week {week.week}
            <button
              onClick={() => {
                const updatedWeeks = course.weeks.filter((_, idx) => idx !== wIdx);
                setCourse({ ...course, weeks: updatedWeeks });
              }}
              className="text-red-500 font-bold px-2 py-0 rounded"
            >
              ❌
            </button>
          </h3>
          <button onClick={() => addLesson(wIdx)} className="bg-blue-400 text-white px-2 py-1 rounded mb-2">
            Add Lesson
          </button>
          {week.videos.map((video, vIdx) => (
            <div key={vIdx} className="border p-2 mb-2 rounded bg-gray-50 relative">
              <input
                type="text"
                placeholder="Lesson Title"
                value={video.title}
                onChange={(e) => updateLesson(wIdx, vIdx, "title", e.target.value)}
                className="border p-1 rounded w-full mb-1"
              />
              <button
                onClick={() => {
                  const updatedWeeks = [...course.weeks];
                  updatedWeeks[wIdx].videos.splice(vIdx, 1);
                  setCourse({ ...course, weeks: updatedWeeks });
                }}
                className="absolute top-2 right-2 text-red-500 font-bold"
              >
                ❌
              </button>

              <h4 className="font-semibold">Subtopics:</h4>
              {video.subtopics.map((sub, sIdx) => (
                <div key={sIdx} className="flex gap-1 items-center mb-1">
                  <input
                    type="text"
                    placeholder="Subtopic"
                    value={sub}
                    onChange={(e) => updateSubtopic(wIdx, vIdx, sIdx, e.target.value)}
                    className="border p-1 rounded w-full"
                  />
                  <button
                    onClick={() => {
                      const updatedWeeks = [...course.weeks];
                      updatedWeeks[wIdx].videos[vIdx].subtopics.splice(sIdx, 1);
                      setCourse({ ...course, weeks: updatedWeeks });
                    }}
                    className="text-red-500 font-bold px-1"
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button onClick={() => addSubtopic(wIdx, vIdx)} className="bg-gray-300 px-2 py-1 rounded text-sm">
                + Add Subtopic
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)}
        {/* Thumbnail */}
        {tab === "thumbnail" && (
          <div className="flex flex-col gap-2 items-center">
            <input type="file" accept="image/*" onChange={handleThumbUpload} className="border p-1 rounded w-full" />
            {thumbURL && <img src={thumbURL} alt="Thumbnail" className="w-full max-w-sm rounded shadow-lg mt-2" />}
          </div>
        )}

        {/* Studio */}
        {tab === "studio" && (
          <div className="flex flex-col gap-4 items-center relative">
            <canvas ref={combinedCanvasRef} width={1280} height={900} className="w-full bg-black rounded-xl shadow-lg" />
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
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2 mb-2">
              {!recording ? (
                <button onClick={startTranscript} className="bg-purple-500 text-white px-4 py-2 rounded-lg">
                  Start Transcription
                </button>
              ) : (
                <button
                  onClick={() => {
                    window.transcriptionInstance?.stop();
                    setRecording(false);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg"
                >
                  Stop Transcription
                </button>
              )}
              <button
                onClick={() => {
                  const blob = new Blob([transcript], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "transcript.txt";
                  a.click();
                }}
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
              >
                Download Transcript
              </button>
            </div>
            <textarea value={transcript} readOnly className="w-full h-64 border p-2 rounded" placeholder="Your transcript will appear here..." />
          </div>
        )}

        {/* Library */}
        {tab === "library" && (
          <div className="flex flex-col gap-4">
            {clips.length === 0 ? (
              <p>No clips yet</p>
            ) : (
              clips.map((c, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center gap-2">
                  <video src={c} controls className="w-full md:w-3/4 rounded shadow" />
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={async () => {
                        const blob = await fetch(c).then((r) => r.blob());
                        const url = URL.createObjectURL(blob);
                        setShareLinks((prev) => ({ ...prev, [i]: url }));
                        copyToClipboard(url);
                      }}
                      className="bg-green-500 text-white px-3 py-1 rounded"
                    >
                      Copy Link
                    </button>
                    <a href={c} download={`clip-${i + 1}.mp4`} target="_blank" className="text-blue-600 underline">
                      Download
                    </a>
                    {shareLinks[i] && <input type="text" readOnly value={shareLinks[i]} className="border px-2 py-1 w-full md:w-64 rounded" />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

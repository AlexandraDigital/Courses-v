// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import './index.css';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function App() {
  const [tab, setTab] = useState('planner');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [clips, setClips] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [course, setCourse] = useState({ topic: '', weeks: 4, videos: 3 });
  const [outline, setOutline] = useState([]);
  const [thumbText, setThumbText] = useState('');
  const [error, setError] = useState('');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const combinedCanvasRef = useRef(null);
  const thumbCanvasRef = useRef(null);

  // --- Cursor tracking ---
  useEffect(() => {
    const handleMouse = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  // --- Camera init ---
  useEffect(() => {
    const initCamera = async () => {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const camVideo = document.createElement('video');
        camVideo.srcObject = camStream;
        camVideo.play();

        const canvas = combinedCanvasRef.current;
        const ctx = canvas.getContext('2d');

        const draw = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        };
        draw();
      } catch (err) {
        console.error('Camera access denied:', err);
        setError('Camera access denied. Allow camera and microphone permissions.');
      }
    };
    initCamera();
  }, []);

  // --- Studio recording ---
  const startStudio = async () => {
    try {
      setError('');
      let screenStream = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        console.log('Screen capture denied, using camera only');
      }

      const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camVideo = document.createElement('video');
      camVideo.srcObject = cam;
      await camVideo.play();

      let screenVideo;
      if (screenStream) {
        screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        await screenVideo.play();
      }

      const canvas = combinedCanvasRef.current;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (screenVideo) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        else ctx.fillStyle = '#000', ctx.fillRect(0,0,canvas.width,canvas.height);

        const camW = canvas.width * 0.25;
        const camH = canvas.height * 0.25;
        ctx.drawImage(camVideo, canvas.width - camW - 10, canvas.height - camH - 10, camW, camH);

        ctx.fillStyle = 'rgba(255,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI*2);
        ctx.fill();

        requestAnimationFrame(draw);
      };
      draw();

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setClips(prev => [...prev, url]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setPaused(false);
    } catch (err) {
      console.error(err);
      setError('Recording failed. Check camera/mic permissions.');
    }
  };

  const stopStudio = () => { mediaRecorder?.stop(); setRecording(false); setPaused(false); };
  const pauseResume = () => {
    if (!mediaRecorder) return;
    if (paused) { mediaRecorder.resume(); setPaused(false); }
    else { mediaRecorder.pause(); setPaused(true); }
  };

  // --- Transcription ---
  const startTranscript = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech recognition not supported');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let text = '';
      for (let i=event.resultIndex;i<event.results.length;i++) text += event.results[i][0].transcript;
      setTranscript(prev => prev + ' ' + text);
    };
    recognition.start();
  };

  // --- Course outline ---
  const lessonPatterns = ['Introduction','Core Concepts','Deep Dive','Practical Application','Common Mistakes','Advanced Tips'];
  const generateCourse = () => {
    let weeks = [];
    for (let w=1; w<=course.weeks; w++) {
      let vids = [];
      for (let v=1; v<=course.videos; v++) {
        const pattern = lessonPatterns[(v-1)%lessonPatterns.length];
        vids.push({ label:`Lesson ${w}.${v}`, title: course.topic ? `${pattern}: ${course.topic}` : pattern });
      }
      weeks.push({ week:w, videos:vids });
    }
    setOutline(weeks);
    localStorage.setItem('outline', JSON.stringify(weeks)); // autosave
  };

  // --- Autosave outline ---
  useEffect(() => {
    const saved = localStorage.getItem('outline');
    if (saved) setOutline(JSON.parse(saved));
  }, []);

  // --- Thumbnail generator ---
  useEffect(() => {
    const canvas = thumbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#7F00FF');
    grad.addColorStop(1, '#E100FF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(thumbText || 'Thumbnail Preview', canvas.width / 2, canvas.height / 2);

    // Emoji/icon
    ctx.font = '48px serif';
    ctx.fillText('🎬', canvas.width/2, canvas.height/2 - 60);
  }, [thumbText]);

  const downloadThumbnail = () => {
    const canvas = thumbCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'thumbnail.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className='min-h-screen bg-white text-black p-6 font-sans'>
      <h1 className='text-3xl font-bold mb-6 bg-gradient-to-r from-purple-500 to-pink-500 text-transparent bg-clip-text'>
        🎬 Course Video Studio Pro
      </h1>

      <div className='flex gap-3 mb-6'>
        {['planner','studio','transcript','thumbnail','library'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1 rounded-lg font-semibold ${tab===t?'bg-purple-500 text-white':'bg-gray-200 text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className='border p-4 rounded shadow bg-gray-50 min-h-[400px]'>
        {/* --- Planner --- */}
        {tab==='planner' && (
          <div className='space-y-4'>
            <input
              type='text'
              placeholder='Course Topic'
              value={course.topic}
              onChange={e=>setCourse({...course,topic:e.target.value})}
              className='border px-3 py-2 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
            />
            <button
              onClick={generateCourse}
              className='px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition'
            >
              Generate Outline
            </button>

            {outline.length > 0 && (
              <div className='grid md:grid-cols-2 gap-4 mt-4'>
                {outline.map((week) => (
                  <div key={week.week} className='p-4 rounded-xl shadow-md bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100'>
                    <h2 className='text-lg font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500'>
                      Week {week.week}
                    </h2>
                    <ul className='space-y-1'>
                      {week.videos.map((vid) => (
                        <li key={vid.label} className='px-3 py-2 rounded-lg bg-white shadow-sm hover:bg-purple-50 transition'>
                          <span className='font-semibold'>{vid.label}:</span> {vid.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Studio --- */}
        {tab==='studio' && (
          <div className='space-y-4'>
            <div className='relative'>
              <canvas ref={combinedCanvasRef} width={1280} height={720} className='w-full bg-black rounded-xl shadow-lg' />
              {recording && <div className='absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded-lg font-semibold'>{paused?'PAUSED':'REC 🔴'}</div>}
            </div>
            {!recording ? (
              <button onClick={startStudio} className='px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700'>Start Recording</button>
            ) : (
              <div className='flex gap-2'>
                <button onClick={pauseResume} className='px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600'>{paused?'Resume':'Pause'}</button>
                <button onClick={stopStudio} className='px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700'>Stop</button>
              </div>
            )}
            {error && <p className='text-red-600'>{error}</p>}
          </div>
        )}

        {/* --- Transcript --- */}
        {tab==='transcript' && (
          <div>
            <button onClick={startTranscript} className='px-4 py-2 rounded-lg bg-purple-600 text-white mb-2 hover:bg-purple-700'>Start Transcription</button>
            <textarea value={transcript} readOnly className='w-full h-64 border p-2 rounded'></textarea>
          </div>
        )}

        {/* --- Thumbnail --- */}
        {tab==='thumbnail' && (
          <div className='space-y-4'>
            <input
              type='text'
              placeholder='Thumbnail Text'
              value={thumbText}
              onChange={e=>setThumbText(e.target.value)}
              className='border px-2 py-1 w-full rounded'
            />
            <canvas ref={thumbCanvasRef} width={640} height={360} className='border rounded shadow-lg w-full' />
            <button onClick={downloadThumbnail} className='px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700'>
              Download Thumbnail
            </button>
          </div>
        )}

        {/* --- Library --- */}
        {tab==='library' && (
          <div className='space-y-2'>
            {clips.length===0 ? <p>No clips yet</p> : clips.map((c,i)=><video key={i} src={c} controls className='w-full rounded'/>)}
          </div>
        )}
      </div>
    </div>
  );
}

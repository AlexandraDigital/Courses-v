
// App.jsx
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

  useEffect(() => {
    const handleMouse = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

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

  const startStudio = async () => {
    try {
      setError('');
      let screenStream = null;
      try { screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch { console.log('Screen capture denied, using camera only'); }
      const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camVideo = document.createElement('video'); camVideo.srcObject = cam; await camVideo.play();

      let screenVideo;
      if (screenStream) { screenVideo = document.createElement('video'); screenVideo.srcObject = screenStream; await screenVideo.play(); }

      const canvas = combinedCanvasRef.current;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (screenVideo) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        else { ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height); }
        const camW = canvas.width * 0.25; const camH = canvas.height * 0.25;
        ctx.drawImage(camVideo, canvas.width - camW - 10, canvas.height - camH - 10, camW, camH);
        ctx.fillStyle = 'rgba(255,0,0,0.7)'; ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI*2); ctx.fill();
        requestAnimationFrame(draw);
      };
      draw();

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => { const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); setClips(prev => [...prev, url]); };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true); setPaused(false);
    } catch (err) {
      console.error(err);
      setError('Recording failed. Check camera/mic permissions.');
    }
  };

  const stopStudio = () => { mediaRecorder?.stop(); setRecording(false); setPaused(false); };
  const pauseResume = () => { if (!mediaRecorder) return; if (paused) { mediaRecorder.resume(); setPaused(false); } else { mediaRecorder.pause(); setPaused(true); } };

  const startTranscript = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech recognition not supported');
    const recognition = new SpeechRecognition(); recognition.continuous = true;
    recognition.onresult = (event) => { let text = ''; for (let i=event.resultIndex;i<event.results.length;i++) text += event.results[i][0].transcript; setTranscript(prev => prev + ' ' + text); };
    recognition.start();
  };

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
  };

  return (
    <div className='min-h-screen bg-white text-black p-6 font-sans'>
      <h1 className='text-3xl font-bold mb-6 text-gradient'>🎬 Course Video Studio Pro</h1>

      <div className='flex gap-3 mb-6'>
        {['planner','studio','transcript','thumbnail','library'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`tab-btn ${tab===t?'tab-active':'tab-inactive'}`}>{t}</button>
        ))}
      </div>

      <div className='border p-4 rounded shadow bg-gray-50 min-h-[400px]'>
        {tab==='planner' && (
          <div className='space-y-4'>
            <input type='text' placeholder='Course Topic' value={course.topic} onChange={e=>setCourse({...course,topic:e.target.value})} />
            <button onClick={generateCourse} className='btn btn-primary'>Generate Outline</button>
            <pre>{JSON.stringify(outline,null,2)}</pre>
          </div>
        )}

        {tab==='studio' && (
          <div className='space-y-4'>
            <div className='relative'>
              <canvas ref={combinedCanvasRef} width={1280} height={720} className='w-full bg-black rounded-xl shadow-lg' />
              {recording && <div className='absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded-lg font-semibold'>{paused?'PAUSED':'REC 🔴'}</div>}
            </div>
            {!recording ? (
              <button onClick={startStudio} className='btn btn-success'>Start Recording</button>
            ) : (
              <div className='flex gap-2'>
                <button onClick={pauseResume} className='btn btn-warning'>{paused?'Resume':'Pause'}</button>
                <button onClick={stopStudio} className='btn btn-danger'>Stop</button>
              </div>
            )}
            {error && <p className='text-red-600'>{error}</p>}
          </div>
        )}

        {tab==='transcript' && (
          <div>
            <button onClick={startTranscript} className='btn btn-purple mb-2'>Start Transcription</button>
            <textarea value={transcript} readOnly className='w-full h-64 border p-2 rounded'></textarea>
          </div>
        )}

        {tab==='thumbnail' && (
          <div>
            <input type='text' placeholder='Thumbnail Text' value={thumbText} onChange={e=>setThumbText(e.target.value)} className='border px-2 py-1 w-full rounded mb-2'/>
            <div className='thumb-preview'>{thumbText || 'Thumbnail Preview'}</div>
          </div>
        )}

        {tab==='library' && (
          <div className='space-y-2'>
            {clips.length===0 ? <p>No clips yet</p> : clips.map((c,i)=><video key={i} src={c} controls className='w-full rounded'/>) }
          </div>
        )}
      </div>
    </div>
  );
}

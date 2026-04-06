import React, { useState, useRef, useEffect } from 'react';
import './index.css';

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

  // Load autosaved data
  useEffect(() => {
    const savedCourse = localStorage.getItem('course');
    const savedOutline = localStorage.getItem('outline');
    const savedTranscript = localStorage.getItem('transcript');
    const savedThumb = localStorage.getItem('thumbText');
    if (savedCourse) setCourse(JSON.parse(savedCourse));
    if (savedOutline) setOutline(JSON.parse(savedOutline));
    if (savedTranscript) setTranscript(savedTranscript);
    if (savedThumb) setThumbText(savedThumb);
  }, []);

  // Autosave
  useEffect(() => { localStorage.setItem('course', JSON.stringify(course)); }, [course]);
  useEffect(() => { localStorage.setItem('outline', JSON.stringify(outline)); }, [outline]);
  useEffect(() => { localStorage.setItem('transcript', transcript); }, [transcript]);
  useEffect(() => { localStorage.setItem('thumbText', thumbText); }, [thumbText]);

  // Cursor tracking
  useEffect(() => {
    const handleMouse = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  // Camera preview
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
        setError('Camera access denied. Allow camera and microphone permissions.');
      }
    };
    initCamera();
  }, []);

  // Studio recording
  const startStudio = async () => {
    try {
      setError('');
      let screenStream = null;
      try { screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true }); } 
      catch { console.log('Screen denied'); }

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
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if (screenVideo) ctx.drawImage(screenVideo,0,0,canvas.width,canvas.height);
        else { ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height); }

        const camW = canvas.width*0.25;
        const camH = canvas.height*0.25;
        ctx.drawImage(camVideo,canvas.width-camW-10,canvas.height-camH-10,camW,camH);

        ctx.fillStyle='rgba(255,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(cursorPos.x,cursorPos.y,10,0,Math.PI*2);
        ctx.fill();

        requestAnimationFrame(draw);
      };
      draw();

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks,{type:'video/webm'});
        const url = URL.createObjectURL(blob);
        setClips(prev=>[...prev,url]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setPaused(false);
    } catch (err) { setError('Recording failed. Check camera/mic permissions.'); }
  };

  const stopStudio = () => { mediaRecorder?.stop(); setRecording(false); setPaused(false); };
  const pauseResume = () => {
    if(!mediaRecorder) return;
    if(paused) { mediaRecorder.resume(); setPaused(false); } 
    else { mediaRecorder.pause(); setPaused(true); }
  };

  // Transcription
  const startTranscript = () => {
    const SpeechRecognition = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition) return alert('Speech recognition not supported');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.onresult = (event)=>{
      let text='';
      for(let i=event.resultIndex;i<event.results.length;i++)
        text+=event.results[i][0].transcript;
      setTranscript(prev=>prev+' '+text);
    };
    recognition.start();
  };

  const lessonPatterns=['Introduction','Core Concepts','Deep Dive','Practical Application','Common Mistakes','Advanced Tips'];
  const generateCourse=()=>{
    let weeks=[];
    for(let w=1;w<=course.weeks;w++){
      let vids=[];
      for(let v=1;v<=course.videos;v++){
        const pattern=lessonPatterns[(v-1)%lessonPatterns.length];
        vids.push({label:`Lesson ${w}.${v}`,title: course.topic?`${pattern}: ${course.topic}`:pattern});
      }
      weeks.push({week:w,videos:vids});
    }
    setOutline(weeks);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 p-6 font-sans">
      <h1 className="text-4xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500">
        🎬 Course Video Studio Pro
      </h1>
      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {['planner','studio','transcript','thumbnail','library'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 rounded-full font-semibold transition-all ${
              tab===t?'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md':'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div className="border p-6 rounded-2xl shadow bg-white min-h-[450px]">
        {tab==='planner' && <div className="space-y-4">
          <input type="text" placeholder="Course Topic" value={course.topic} onChange={e=>setCourse({...course,topic:e.target.value})} className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-indigo-400 outline-none"/>
          <button onClick={generateCourse} className="px-4 py-2 rounded-full bg-gradient-to-r from-green-400 to-teal-500 text-white font-semibold shadow hover:opacity-90 transition">Generate Outline</button>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto">{JSON.stringify(outline,null,2)}</pre>
        </div>}

        {tab==='studio' && <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden shadow-lg">
            <canvas ref={combinedCanvasRef} width={1280} height={720} className="w-full bg-black rounded-xl" />
            {recording && <div className="absolute top-3 left-3 bg-red-600 text-white px-4 py-1 rounded-full font-semibold shadow">{paused?'PAUSED':'REC 🔴'}</div>}
          </div>
          {!recording ? 
            <button onClick={startStudio} className="px-5 py-2 rounded-full bg-gradient-to-r from-green-400 to-teal-500 text-white font-semibold shadow hover:opacity-90 transition">Start Recording</button>:
            <div className="flex gap-3">
              <button onClick={pauseResume} className="px-5 py-2 rounded-full bg-yellow-400 text-white font-semibold shadow hover:opacity-90 transition">{paused?'Resume':'Pause'}</button>
              <button onClick={stopStudio} className="px-5 py-2 rounded-full bg-red-500 text-white font-semibold shadow hover:opacity-90 transition">Stop</button>
            </div>
          }
          {error && <p className="text-red-600">{error}</p>}
        </div>}

        {tab==='transcript' && <div className="space-y-3">
          <button onClick={startTranscript} className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow hover:opacity-90 transition">Start Transcription</button>
          <textarea value={transcript} readOnly className="w-full h-64 border p-3 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 outline-none"></textarea>
        </div>}

        {tab==='thumbnail' && <div className="space-y-3">
          <input type="text" placeholder="Thumbnail Text" value={thumbText} onChange={e=>setThumbText(e.target.value)} className="border px-3 py-2 w-full rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"/>
          <div className="h-32 flex items-center justify-center border-2 border-dashed rounded-lg text-gray-400 font-semibold bg-gradient-to-br from-gray-50 to-gray-100">{thumbText||'Thumbnail Preview'}</div>
        </div>}

        {tab==='library' && <div className="space-y-3">
          {clips.length===0?<p className="text-gray-500">No clips yet</p>:clips.map((c,i)=><video key={i} src={c} controls className="w-full rounded-xl shadow"/>)}
        </div>}
      </div>
    </div>
  );
}

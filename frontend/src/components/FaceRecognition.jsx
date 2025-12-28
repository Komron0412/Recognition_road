import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const FaceRecognition = () => {
  const webcamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [trafficState, setTrafficState] = useState({ light: 'GREEN', roadX: 0, violations: [] });
  const [isConnected, setIsConnected] = useState(false);
  const [mode, setMode] = useState('webcam'); // 'webcam' or 'video'
  const [videoFile, setVideoFile] = useState(null);

  // WebSocket URL - assuming backend runs on port 8000
  const WS_URL = 'ws://127.0.0.1:8000/ws/recognition/';

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    onOpen: () => setIsConnected(true),
    onClose: () => setIsConnected(false),
    shouldReconnect: (closeEvent) => true,
  });

  useEffect(() => {
    if (lastJsonMessage) {
      if (lastJsonMessage.faces) {
        setDetectedFaces(lastJsonMessage.faces);
      }
      // Update traffic state
      setTrafficState({
        light: lastJsonMessage.traffic_light || 'GREEN',
        roadX: lastJsonMessage.road_zone_x || 0,
        violations: lastJsonMessage.violations || []
      });
    }
  }, [lastJsonMessage]);

  // Capture frame logic (Shared for Webcam and Video)
  const captureFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let videoElement = null;
    if (mode === 'webcam' && webcamRef.current) {
      videoElement = webcamRef.current.video;
    } else if (mode === 'video' && videoRef.current) {
      videoElement = videoRef.current;
    }

    if (!videoElement || (videoElement.readyState < 2 && mode === 'video')) return; // Not ready

    const { videoWidth, videoHeight } = videoElement;
    if (videoWidth === 0 || videoHeight === 0) return;

    // Use a temporary canvas to capture the frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoWidth;
    tempCanvas.height = videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    const base64Data = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    if (readyState === ReadyState.OPEN) {
      sendJsonMessage({ image: base64Data });
    }

    // Resize main canvas to match video
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

  }, [mode, readyState, sendJsonMessage]);


  useEffect(() => {
    const interval = setInterval(() => {
      captureFrame();
    }, 200); // 5 FPS

    return () => clearInterval(interval);
  }, [captureFrame]);

  const drawOverlays = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (canvas.width === 0 || canvas.height === 0) return;

    // 1. Draw Traffic Light Status and ROI
    // use lastJsonMessage (from hook)

    if (lastJsonMessage) {
      // Draw ROI Box
      if (lastJsonMessage.roi) {
        const { x, y, w, h } = lastJsonMessage.roi;
        ctx.strokeStyle = '#00FFFF'; // Cyan for ROI
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#00FFFF';
        ctx.font = '12px Arial';
        ctx.fillText('Light ROI', x, y - 5);
      }

      const lightState = lastJsonMessage.traffic_light;
      ctx.beginPath();
      ctx.arc(50, 50, 20, 0, 2 * Math.PI);
      ctx.fillStyle = lightState === 'RED' ? '#FF0000' : (lightState === 'GREEN' ? '#00FF00' : 'gray');
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.fillText("SCAN", 10, 20);
      ctx.fillText(lightState || "WAIT", 20, 85);

      // 2. Draw Road Zone Line
      if (lastJsonMessage.road_zone_x) {
        const x = lastJsonMessage.road_zone_x;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.strokeStyle = lightState === 'RED' ? 'red' : 'yellow';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'white';
        ctx.fillText("ROAD ZONE", x + 10, 30);
      }

      // 3. Draw Detected Faces/Objects
      if (lastJsonMessage.faces) {
        lastJsonMessage.faces.forEach(face => {
          const [top, right, bottom, left] = face.box;
          const width = right - left;
          const height = bottom - top;

          ctx.strokeStyle = face.is_violation ? 'red' : 'blue';
          ctx.lineWidth = 3;
          ctx.strokeRect(left, top, width, height);

          ctx.fillStyle = face.is_violation ? 'red' : 'blue';
          ctx.fillRect(left, top - 20, width, 20);

          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.fillText(face.name, left + 5, top - 5);
        });
      }
    }
  };

  useEffect(() => {
    drawOverlays();
  }, [lastJsonMessage]);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(URL.createObjectURL(file));
      setMode('video');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => setMode('webcam')} disabled={mode === 'webcam'}>
          Live Webcam
        </button>
        <label className="custom-file-upload">
          <input type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <span style={{ cursor: 'pointer', background: mode === 'video' ? '#646cff' : '#444', padding: '8px 16px', borderRadius: '8px', color: 'white' }}>
            Upload Video
          </span>
        </label>
      </div>

      <div style={{ position: 'relative', width: 640, height: 480, margin: '0 auto', background: '#000' }}>

        {mode === 'webcam' && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}

        {mode === 'video' && videoFile && (
          <video
            ref={videoRef}
            src={videoFile}
            controls
            autoPlay
            loop
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}

        {mode === 'video' && !videoFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
            Select a video file to play
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'absolute', top: 10, right: 10, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px' }}>
          Status: {connectionStatus}
        </div>

        {trafficState.violations.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            zIndex: 100
          }}>
            VIOLATION!<br />
            {trafficState.violations.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

const connectionStatus = {
  [ReadyState.CONNECTING]: 'Connecting',
  [ReadyState.OPEN]: 'Open',
  [ReadyState.CLOSING]: 'Closing',
  [ReadyState.CLOSED]: 'Closed',
  [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
}[ReadyState.OPEN]; // Simplified for now

export default FaceRecognition;

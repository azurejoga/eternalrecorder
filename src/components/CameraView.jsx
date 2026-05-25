import React, { useEffect, useRef, useState } from 'react';

const CameraView = () => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [borderConfig, setBorderConfig] = useState({
        color1: '#00f2fe',
        color2: '#ff0055',
        isGradient: false,
        isNeon: false
    });

    // Load camera source
    const loadCamera = async (deviceId) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 640 },
                    height: { ideal: 640 },
                    aspectRatio: 1
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
        }
    };

    useEffect(() => {
        if (!window.electronAPI) return;
        loadCamera();

        const cleanupSource = window.electronAPI.onUpdateCameraSource((deviceId) => loadCamera(deviceId));
        const cleanupBorder = window.electronAPI.onUpdateBorderColor((config) => setBorderConfig(config));

        return () => {
            if (typeof cleanupSource === 'function') cleanupSource();
            if (typeof cleanupBorder === 'function') cleanupBorder();
        };
    }, []);

    // Resize Logic
    const handleMouseDown = (e) => {
        e.preventDefault();
        const startX = e.screenX;
        const startSize = window.outerWidth;

        let frameId = null;

        const handleMouseMove = (ev) => {
            if (frameId) return;

            frameId = requestAnimationFrame(() => {
                // Cálculo de delta simples para fluidez máxima
                const dx = ev.screenX - startX;

                // Em um handle no canto inferior direito:
                // Arrastar para a DIREITA (dx positivo) aumenta.
                // Arrastar para a ESQUERDA (dx negativo) diminui.
                let newSize = Math.round(startSize + dx);

                // Limites de segurança
                if (newSize < 120) newSize = 120;
                if (newSize > 800) newSize = 800;

                if (window.electronAPI) {
                    window.electronAPI.resizeCamera(newSize);
                }
                frameId = null;
            });
        };

        const handleMouseUp = () => {
            if (frameId) cancelAnimationFrame(frameId);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Drag Logic
    const handleDragMouseDown = (e) => {
        if (e.target.closest('.resize-handle')) return; // Prioritize resize

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const handleMouseMove = (ev) => {
            if (window.electronAPI) {
                window.electronAPI.dragWindow({ mouseX, mouseY });
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Construct styles dynamically
    const getContainerStyle = () => {
        const { color1, color2, isGradient, isNeon } = borderConfig;

        const style = {};

        if (isGradient) {
            style.background = `linear-gradient(black, black) padding-box, linear-gradient(135deg, ${color1}, ${color2}) border-box`;
            style.border = '4px solid transparent';
        } else {
            style.border = `3px solid ${color1}`;
            style.background = 'black';
        }

        if (isNeon) {
            const glowColor = isGradient ? color1 : color1;
            // Multi-layered shadow for a smoother, stronger neon effect
            style.boxShadow = `
                0 0 7px ${glowColor},
                0 0 14px ${glowColor},
                0 0 21px ${glowColor}
            `;
            // If neon, the border is less sharp
            if (!isGradient) {
                style.border = `2px solid #fff`; // White core for neon
            }
        }

        return style;
    };

    return (
        <div className="camera-wrapper" style={getContainerStyle()} onMouseDown={handleDragMouseDown}>
            <video ref={videoRef} autoPlay playsInline muted />

            <div className="resize-handle" onMouseDown={handleMouseDown}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M22 22H12v-2h10V10h2v12zM22 6h-2v2h2V6zM6 22h2v-2H6v2z" fill="white" />
                </svg>
            </div>

            <style>{`
        body, html, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: transparent !important; 
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .camera-wrapper {
          position: relative;
          width: 90%;    /* Space for glow */
          height: 90%;   /* Space for glow */
          border-radius: 50%;
          box-sizing: border-box;
          background: black;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-app-region: no-drag;
          margin: 0; 
          overflow: visible; 
          cursor: move;
          transition: border 0.3s, box-shadow 0.3s;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); 
          border-radius: 50%; /* Clip video */
          pointer-events: none;
        }
        
        .resize-handle {
            position: absolute;
            bottom: 5%; 
            right: 5%;
            width: 30px;
            height: 30px;
            background: rgba(0,0,0,0.5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: nwse-resize;
            opacity: 0;
            transition: opacity 0.2s;
            -webkit-app-region: no-drag;
            color: white;
            z-index: 9999;
        }

        .camera-wrapper:hover .resize-handle {
            opacity: 1;
        }
      `}</style>
        </div>
    );
};

export default CameraView;

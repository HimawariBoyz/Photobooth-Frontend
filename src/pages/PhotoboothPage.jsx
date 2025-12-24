import { useEffect, useRef, useState } from 'react'
import useSound from '../hooks/useSound'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/PhotoboothPage.css'
import { API_URL, ENABLE_DSLR } from '../config'
import { detectSlots, mergeImages, printImage, downloadImage } from '../utils/imageUtils'

// --- FILTER PRESETS ---
const FILTER_PRESETS = {
  normal: { id: 'normal', name: 'Original', filter: 'none', overlay: false },
  bright: { id: 'bright', name: 'Bright ☀️', filter: 'brightness(1.2) contrast(1.05) saturate(1.05)', overlay: false },
  peach: { id: 'peach', name: 'Peach 🍑', filter: 'brightness(1.15) contrast(1.0) saturate(1.1) hue-rotate(-10deg) sepia(0.1)', overlay: false },
  warm: { id: 'warm', name: 'Warm ☕', filter: 'brightness(1.1) sepia(0.25) contrast(1.0) saturate(1.1)', overlay: false },
  cool: { id: 'cool', name: 'Cool ❄️', filter: 'brightness(1.1) contrast(1.05) saturate(0.9) hue-rotate(10deg)', overlay: false },
  vintage: { id: 'vintage', name: 'Vintage 🎞️', filter: 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)', overlay: false },
  dreamy: { id: 'dreamy', name: 'Dreamy ✨', filter: 'brightness(1.1) contrast(0.95) saturate(1.1)', overlay: true, overlayMode: 'screen', overlayAlpha: 0.4, overlayBlur: 'blur(8px)' },
  vivid: { id: 'vivid', name: 'Vivid 🌈', filter: 'brightness(1.05) contrast(1.15) saturate(1.4)', overlay: false },
  fade: { id: 'fade', name: 'Fade 🌫️', filter: 'brightness(1.1) contrast(0.85) saturate(0.9)', overlay: false }
}

function PhotoboothPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { playClick, playSnap, playJingle, playBack, pauseBgm, startBgm } = useSound()

  // --- Config & State ---

  const TICK_RATE = 1500
  const selectedFrame = location.state?.selectedFrame

  const [finalPhoto, setFinalPhoto] = useState(null)

  const [countdown, setCountdown] = useState(null)
  const [currentShot, setCurrentShot] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [shotImgs, setShotImgs] = useState([])
  const [frameSlots, setFrameSlots] = useState([])
  const [triggerFlash, setTriggerFlash] = useState(false)
  const [activeFilter, setActiveFilter] = useState('bright')
  const [isFrameLoaded, setIsFrameLoaded] = useState(false)

  // --- Refs ---
  const videoRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const composeCanvasRef = useRef(null)
  const frameImgRef = useRef(null)
  const rafRef = useRef(null)

  // Use Ref to track shots to avoid stale closures in timeouts
  const shotImgsRef = useRef([])

  // Skip DSLR if it failed once to speed up subsequent shots
  const skipDslr = useRef(false)

  // 1. Check Access
  useEffect(() => {
    if (!selectedFrame) navigate('/')
  }, [selectedFrame, navigate])

  const frameUrl = selectedFrame?.url

  // 2. Load Frame Data (Detect Slots Locally)
  useEffect(() => {
    if (!frameUrl) return
    setIsFrameLoaded(false)

    // Detect slots from the image directly
    detectSlots(frameUrl).then(data => {
      setFrameSlots(data.slots || [])
      // Also pre-load image for drawing
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        frameImgRef.current = img
        setIsFrameLoaded(true)
      }
      img.src = frameUrl
    }).catch(err => {
      console.error("Failed to detect slots:", err)
      alert("Error loading frame. Please try again.")
      navigate('/select-frame')
    })

  }, [frameUrl, navigate])

  // 3. Init Camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
          audio: false
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              if (err.name !== 'AbortError') {
                console.error("Video play error:", err)
              }
            })
          }
        }
      } catch (err) {
        console.error("Camera Error:", err)
        // Don't alert here immediately, maybe just log. Fallback to DSLR might be intended?
        // But usually webcam is needed for live view regardless.
        alert("Camera (Webcam) access denied. Live view may not work.")
      }
    }
    initCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // 4. Audio & Cleanup
  useEffect(() => {
    pauseBgm()
    return () => {
      startBgm()
    }
  }, [pauseBgm, startBgm])


  // --- CORE LOGIC: SCALE TO COVER ---
  const drawCover = (ctx, img, cw, ch, preset, isMirror = true) => {
    const vw = img.videoWidth || img.width
    const vh = img.videoHeight || img.height
    // Avoid div by zero
    if (!vw || !vh) return

    const scale = Math.max(cw / vw, ch / vh)
    const dw = vw * scale
    const dh = vh * scale

    ctx.translate(cw / 2, ch / 2)
    if (isMirror) ctx.scale(-1, 1)

    if (preset) ctx.filter = preset.filter

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)

    if (preset && preset.overlay) {
      ctx.globalCompositeOperation = preset.overlayMode || 'screen'
      ctx.globalAlpha = preset.overlayAlpha
      ctx.filter = preset.overlayBlur
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1.0
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
  }

  // 5. Render Loop (Live View)
  useEffect(() => {
    const renderLoop = () => {
      if (mainCanvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        const cvs = mainCanvasRef.current
        const ctx = cvs.getContext('2d')
        const vid = videoRef.current

        if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
          cvs.width = cvs.clientWidth
          cvs.height = cvs.clientHeight
        }

        drawCover(ctx, vid, cvs.width, cvs.height, FILTER_PRESETS[activeFilter], true)
      }

      // Preview (Miniature frame view)
      if (composeCanvasRef.current) {
        const cvs = composeCanvasRef.current
        const ctx = cvs.getContext('2d')
        if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
          cvs.width = cvs.clientWidth
          cvs.height = cvs.clientHeight
        }

        const w = cvs.width
        const h = cvs.height

        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, w, h)

        // Draw shots in slots
        // Note: frameSlots are normalized (nx, ny, nw, nh) by my imageUtils update?
        // Wait, my imageUtils `detectSlots` returned normalized nx, ny, nw, nh as well as x,y,w,h.
        // Let's use normalized values for responsiveness.

        shotImgs.forEach((img, idx) => {
          const slotIndex = idx % frameSlots.length
          const s = frameSlots[slotIndex]
          if (img && s) {
            // Draw logic for preview (simple stretch for preview is ok, or fit)
            // But let's verify what `detectSlots` returns.
            // It returns { x, y, w, h, nx, ny, nw, nh }

            const dx = s.nx * w
            const dy = s.ny * h
            const dw = s.nw * w
            const dh = s.nh * h

            ctx.drawImage(img, dx, dy, dw, dh)
          }
        })

        // Draw frame over
        if (frameImgRef.current && isFrameLoaded) {
          ctx.drawImage(frameImgRef.current, 0, 0, w, h)
        }
      }
      rafRef.current = requestAnimationFrame(renderLoop)
    }

    rafRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [shotImgs, frameSlots, activeFilter, isFrameLoaded])

  // 6. Shooting Process
  const startSession = () => {
    playClick()
    setShotImgs([])
    shotImgsRef.current = [] // Reset Ref
    setCurrentShot(1)
    doCountdown(1, 5)
  }

  const doCountdown = (step, countNum) => {
    setCountdown(countNum)
    const timer = setInterval(() => {
      countNum--
      if (countNum <= 0) {
        clearInterval(timer)
        setCountdown(null)
        captureShot(step) // Replaces performSnap
      } else {
        setCountdown(countNum)
      }
    }, TICK_RATE)
  }

  const captureShot = async (step) => {
    playSnap()
    setTriggerFlash(true)
    setTimeout(() => setTriggerFlash(false), 200)

    // --- HYBRID STRATEGY ---
    // 1. Try DSLR Trigger via Backend
    // 2. If fail/timeout/disabled -> Fallback to Webcam

    let dslrSuccess = false

    if (ENABLE_DSLR && !skipDslr.current) {
      try {
        const formData = new FormData()
        formData.append('step', step)
        // Timeout 3s to not block too long if camera is off
        const res = await axios.post(`${API_URL}/trigger_dslr`, formData, { timeout: 3000 })

        if (res.data.status === 'success') {
          dslrSuccess = true
          const imgUrl = res.data.image_url // URL from backend

          // Load the high-res image
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            setShotImgs(prev => {
              const n = [...prev]
              n[step - 1] = img
              shotImgsRef.current = n // Update Ref
              return n
            })
            proceedToNext(step)
          }
          img.onerror = () => {
            console.error("DSLR Image load failed")
            // If image fails to load, fallback to webcam just in case
            fallbackWebcam(step)
          }
          img.src = imgUrl
        }
      } catch (e) {
        console.log("DSLR Trigger Failed/Timeout (Switching to Webcam):", e)
        skipDslr.current = true // Disable DSLR for rest of session
      }
    }

    if (!dslrSuccess) {
      fallbackWebcam(step)
    }
  }

  const fallbackWebcam = (step) => {
    if (!videoRef.current) return
    const vid = videoRef.current

    // Capture logic (Webcam)
    const tempCvs = document.createElement('canvas')
    tempCvs.width = 1920
    tempCvs.height = 1080
    const ctx = tempCvs.getContext('2d')
    drawCover(ctx, vid, tempCvs.width, tempCvs.height, FILTER_PRESETS[activeFilter], true)

    const url = tempCvs.toDataURL('image/jpeg', 0.95)
    const img = new Image()
    img.onload = () => {
      setShotImgs(prev => {
        const n = [...prev]
        n[step - 1] = img
        shotImgsRef.current = n // Update Ref
        return n
      })
      proceedToNext(step)
    }
    img.src = url
  }

  const proceedToNext = (step) => {
    setTimeout(() => {
      if (step < (frameSlots.length || 4)) {
        setCurrentShot(step + 1)
        doCountdown(step + 1, 3)
      } else {
        finishSession()
      }
    }, 2000)
  }

  const finishSession = async () => {
    if (!selectedFrame) return
    setIsProcessing(true)
    try {
      // Merge locally using REF (current state)
      // This prevents the 'stale closure' bug where shotImgs was empty
      const resultDataUrl = await mergeImages(frameUrl, shotImgsRef.current, frameSlots)
      playJingle()
      setFinalPhoto(resultDataUrl) // This is a data:image/jpeg;base64,... string
    } catch (e) {
      console.error("Merge error:", e)
      alert("Error creating final photo.")
    } finally {
      setIsProcessing(false)
      setCurrentShot(0)
    }
  }

  const handlePrint = () => {
    playClick()
    if (!finalPhoto) return

    // 1. Auto Save Locally (Keep this as requested)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadImage(finalPhoto, `photobooth-${timestamp}.jpg`)

    // 2. Frontend Print (Browser Dialog)
    // User can enable "Silent Printing" by launching Chrome/Edge with '--kiosk-printing'
    printImage(finalPhoto)
  }

  const handleSave = () => {
    playClick()
    if (!finalPhoto) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadImage(finalPhoto, `photobooth-${timestamp}.jpg`)
  }

  const handleBack = () => {
    playBack()
    navigate('/select-frame')
  }

  const reset = () => {
    playClick()
    setFinalPhoto(null)
    setShotImgs([])
    shotImgsRef.current = []
    setCurrentShot(0)
    setIsPrinting(false)
  }

  const goHome = () => {
    playBack()
    navigate('/')
  }

  return (
    <div className="pb-container">
      <button className="btn-back-floating" onClick={handleBack} title="ย้อนกลับ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className={`flash-overlay ${triggerFlash ? 'active' : ''}`}></div>
      <video ref={videoRef} className="hidden-video" playsInline muted autoPlay />

      {countdown && <div className="overlay-text countdown">{countdown}</div>}
      {isProcessing && <div className="overlay-text message processing">✓ กำลังประมวลผล...</div>}

      {finalPhoto ? (
        <div className="result-view">
          <img src={finalPhoto} className="final-img" alt="Result" />
          <div className="btn-group result-buttons">
            <button onClick={handlePrint} className="btn btn-primary btn-lg">🖨️ สั่งปริ้น (+Save)</button>
            <button onClick={handleSave} className="btn btn-secondary">💾 บันทึกรูป</button>
            <button onClick={reset} className="btn btn-secondary">🔄 ถ่ายใหม่</button>
            <button onClick={goHome} className="btn btn-tertiary">🏠 เสร็จสิ้น</button>
          </div>
        </div>
      ) : (
        <div className="capture-view">
          <div className="cam-section">
            <div className="cam-box">
              <canvas ref={mainCanvasRef} className="cam-canvas" />
              <div className="badge badge-live">LIVE CAMERA</div>

              {/* Bubble Filter Bar */}
              {currentShot === 0 && (
                <div className="filter-scroll-container">
                  <div className="filter-bar">
                    {Object.values(FILTER_PRESETS).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => { playClick(); setActiveFilter(preset.id) }}
                        className={`filter-item ${activeFilter === preset.id ? 'active' : ''}`}
                      >
                        <div className={`filter-bubble bubble-${preset.id}`}></div>
                        <span className="filter-name">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {currentShot === 0 ? (
              <button onClick={startSession} className="btn btn-primary btn-lg" style={{ marginTop: '20px' }}>
                📸 เริ่มถ่าย
              </button>
            ) : (
              <div className="status-text">
                <span className="shot-number">{currentShot}</span> / {frameSlots.length || 4}
              </div>
            )}
          </div>

          <div className="preview-section">
            <div className="preview-box">
              <canvas ref={composeCanvasRef} className="preview-canvas" />
              <div className="badge badge-preview">PREVIEW</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotoboothPage

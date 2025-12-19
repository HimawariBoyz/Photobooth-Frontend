import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/PhotoboothPage.css'

// --- 9 POPULAR FILTER PRESETS (สูตรแต่งภาพยอดฮิต) ---
const FILTER_PRESETS = {
  normal: {
    id: 'normal',
    name: 'Original',
    filter: 'none',
    overlay: false
  },
  bright: {
    id: 'bright',
    name: 'Bright ☀️', // สไตล์เกาหลี ยอดนิยม
    filter: 'brightness(1.2) contrast(1.05) saturate(1.05)',
    overlay: false
  },
  peach: {
    id: 'peach',
    name: 'Peach 🍑', // ผิวอมชมพู
    filter: 'brightness(1.15) contrast(1.0) saturate(1.1) hue-rotate(-10deg) sepia(0.1)',
    overlay: false
  },
  warm: {
    id: 'warm',
    name: 'Warm ☕', // โทนอุ่น คาเฟ่
    filter: 'brightness(1.1) sepia(0.25) contrast(1.0) saturate(1.1)',
    overlay: false
  },
  cool: {
    id: 'cool',
    name: 'Cool ❄️', // ผิวไบรท์ โทนเย็น
    filter: 'brightness(1.1) contrast(1.05) saturate(0.9) hue-rotate(10deg)',
    overlay: false
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage 🎞️', // ฟิล์มตุ่นๆ
    filter: 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)',
    overlay: false
  },
  dreamy: {
    id: 'dreamy',
    name: 'Dreamy ✨', // ฟุ้งๆ เบลอๆ เหมือนฝัน
    filter: 'brightness(1.1) contrast(0.95) saturate(1.1)',
    overlay: true,
    overlayMode: 'screen',
    overlayAlpha: 0.4,
    overlayBlur: 'blur(8px)'
  },
  vivid: {
    id: 'vivid',
    name: 'Vivid 🌈', // สีสด จัดจ้าน
    filter: 'brightness(1.05) contrast(1.15) saturate(1.4)',
    overlay: false
  },
  fade: {
    id: 'fade',
    name: 'Fade 🌫️', // แมทๆ ฮิปสเตอร์
    filter: 'brightness(1.1) contrast(0.85) saturate(0.9)',
    overlay: false
  }
}

function PhotoboothPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // --- State ---
  const [finalPhoto, setFinalPhoto] = useState(null)
  const [finalFilename, setFinalFilename] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [currentShot, setCurrentShot] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [shotImgs, setShotImgs] = useState([])
  const [frameSlots, setFrameSlots] = useState([])

  // State Flash & Filter
  const [triggerFlash, setTriggerFlash] = useState(false)
  const [activeFilter, setActiveFilter] = useState('bright') // เริ่มต้นที่ Bright

  const API_URL = 'http://localhost:8000'
  const selectedFrame = location.state?.selectedFrame

  // --- Refs ---
  const videoRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const composeCanvasRef = useRef(null)
  const frameImgRef = useRef(null)
  const rafRef = useRef(null)

  // --- Configuration ---
  const TICK_RATE = 1500

  const frameUrl = selectedFrame
    ? (selectedFrame.includes('http') ? selectedFrame : `${API_URL}/frames/${selectedFrame}`)
    : null

  // 1. Load Slots
  useEffect(() => {
    if (!selectedFrame) return
    axios.get(`${API_URL}/frame-props/${selectedFrame}`)
      .then(res => {
        if (res.data.slots) setFrameSlots(res.data.slots)
      })
      .catch(err => console.error(err))
  }, [selectedFrame])

  // 2. Init Camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(e => console.error(e))
        }
      } catch (err) {
        alert("Camera Error: " + err.message)
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

  // 3. Preload Frame
  useEffect(() => {
    if (!frameUrl) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => { frameImgRef.current = img }
    img.src = frameUrl
  }, [frameUrl])

  // 4. Render Loop (แสดงผลหน้าจอ)
  const renderLoop = () => {
    if (mainCanvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const cvs = mainCanvasRef.current
      const ctx = cvs.getContext('2d')
      const vid = videoRef.current
      const preset = FILTER_PRESETS[activeFilter]

      cvs.width = cvs.clientWidth
      cvs.height = cvs.clientHeight

      ctx.save()
      ctx.translate(cvs.width, 0)
      ctx.scale(-1, 1)

      // Apply Filter
      ctx.filter = preset.filter
      ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)

      // Apply Overlay (ถ้ามี)
      if (preset.overlay) {
        ctx.globalCompositeOperation = preset.overlayMode || 'screen'
        ctx.globalAlpha = preset.overlayAlpha
        ctx.filter = preset.overlayBlur
        ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)

        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1.0
      }

      ctx.filter = 'none'
      ctx.restore()
    }

    // ส่วน Preview ด้านขวา
    if (composeCanvasRef.current) {
      const cvs = composeCanvasRef.current
      const ctx = cvs.getContext('2d')
      cvs.width = cvs.clientWidth
      cvs.height = cvs.clientHeight
      const w = cvs.width
      const h = cvs.height

      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, w, h)

      shotImgs.forEach((img, idx) => {
        const slotIndex = idx % frameSlots.length
        const s = frameSlots[slotIndex]
        if (img && s) {
          ctx.drawImage(img, s.x * w, s.y * h, s.w * w, s.h * h)
        }
      })

      if (frameImgRef.current) {
        ctx.drawImage(frameImgRef.current, 0, 0, w, h)
      }
    }
    rafRef.current = requestAnimationFrame(renderLoop)
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [shotImgs, frameSlots, activeFilter])

  // 5. Shooting Logic
  const startSession = () => {
    setShotImgs([])
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
        performSnap(step)
      } else {
        setCountdown(countNum)
      }
    }, TICK_RATE)
  }

  // ฟังก์ชันถ่ายภาพ (High Resolution + Filter)
  const performSnap = (step) => {
    setTriggerFlash(true)
    setTimeout(() => setTriggerFlash(false), 200)

    if (!videoRef.current) return

    const vid = videoRef.current
    const preset = FILTER_PRESETS[activeFilter]

    // สร้าง Temp Canvas ขนาดเท่า Video จริง (HD/Full HD) เพื่อความชัด
    const tempCvs = document.createElement('canvas')
    tempCvs.width = vid.videoWidth
    tempCvs.height = vid.videoHeight
    const ctx = tempCvs.getContext('2d')

    ctx.translate(tempCvs.width, 0)
    ctx.scale(-1, 1)

    // 1. วาดภาพหลัก + Filter
    ctx.filter = preset.filter
    ctx.drawImage(vid, 0, 0)

    // 2. วาด Overlay (ถ้ามี)
    if (preset.overlay) {
      ctx.globalCompositeOperation = preset.overlayMode || 'screen'
      ctx.globalAlpha = preset.overlayAlpha
      ctx.filter = preset.overlayBlur
      ctx.drawImage(vid, 0, 0)

      // Reset
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1.0
    }

    // Save
    tempCvs.toBlob(async (blob) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        setShotImgs(prev => {
          const n = [...prev]
          n[step - 1] = img
          return n
        })
      }
      img.src = url

      const formData = new FormData()
      formData.append('step', step)
      formData.append('file', blob, `shot_${step}.jpg`)
      try { await axios.post(`${API_URL}/capture_step`, formData) }
      catch (e) { console.error(e) }

      setTimeout(() => {
        if (step < (frameSlots.length || 4)) {
          setCurrentShot(step + 1)
          doCountdown(step + 1, 3)
        } else {
          finishSession()
        }
      }, 2000)

    }, 'image/jpeg', 0.95)
  }

  const finishSession = async () => {
    setIsProcessing(true)
    try {
      const res = await axios.post(`${API_URL}/merge?frame_id=${selectedFrame}`)
      if (res.data.status === 'success') {
        setFinalPhoto(res.data.image_url)
        setFinalFilename(res.data.filename)
      }
    } catch (e) {
      alert("Error Merging")
    } finally {
      setIsProcessing(false)
      setCurrentShot(0)
    }
  }

  const handlePrint = async () => {
    if (!finalFilename) return
    setIsPrinting(true)
    try {
      const res = await axios.post(`${API_URL}/print/${finalFilename}`)
      if (res.data.status === 'success') {
        alert("กำลังส่งคำสั่งไปที่เครื่องปริ้น... 🖨️")
      } else {
        alert("ไม่สามารถสั่งปริ้นได้: " + res.data.message)
      }
    } catch (e) {
      alert("Print Error")
    } finally {
      setIsPrinting(false)
    }
  }

  const handleBack = async () => {
    try { await axios.delete(`${API_URL}/cleanup`) } catch (e) { }
    navigate('/select-frame')
  }

  const reset = async () => {
    await axios.delete(`${API_URL}/cleanup`)
    setFinalPhoto(null)
    setFinalFilename(null)
    setShotImgs([])
    setCurrentShot(0)
  }

  const goHome = async () => {
    await axios.delete(`${API_URL}/cleanup`)
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
      {isPrinting && <div className="overlay-text message printing">🖨️ ส่งคำสั่งไปปริ้น...</div>}

      {finalPhoto ? (
        <div className="result-view">
          <img src={finalPhoto} className="final-img" alt="Result" />
          <div className="btn-group result-buttons">
            <button onClick={handlePrint} className="btn btn-primary btn-lg">🖨️ สั่งปริ้น</button>
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

              {/* --- Filter Bar UI --- */}
              {currentShot === 0 && (
                <div className="filter-bar">
                  {Object.values(FILTER_PRESETS).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setActiveFilter(preset.id)}
                      className={`filter-btn ${activeFilter === preset.id ? 'active' : ''}`}
                    >
                      {preset.name}
                    </button>
                  ))}
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
import { useEffect, useRef, useState } from 'react'
import useSound from '../hooks/useSound'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/PhotoboothPage.css'
import { API_URL } from '../config'

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
  const [finalFilename, setFinalFilename] = useState(null)
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
  const skipDslr = useRef(false)

  // 1. Check Access
  useEffect(() => {
    if (!selectedFrame) navigate('/')
  }, [selectedFrame, navigate])

  // Extract ID and URL safely from selectedFrame (which should be an object)
  const frameId = selectedFrame?.id
  const rawUrl = selectedFrame?.url

  const frameUrl = rawUrl
    ? (rawUrl.includes('http') ? rawUrl : `${API_URL}/frames/${rawUrl}`)
    : null

  // 2. Load Frame Data
  useEffect(() => {
    if (!selectedFrame) return
    axios.get(`${API_URL}/frame-props/${frameId}`)
      .then(res => {
        if (res.data.slots) setFrameSlots(res.data.slots)
      })
      .catch(err => console.error(err))
  }, [selectedFrame])

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
          // ไม่ต้อง call play() เพราะมี autoPlay attribute แล้ว
          // รอให้ video พร้อมก่อน render
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              // Ignore AbortError
              if (err.name !== 'AbortError') {
                console.error("Video play error:", err)
              }
            })
          }
        }
      } catch (err) {
        console.error("Camera Error:", err)
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

  // 4. Preload Frame Image & Audio Logic
  useEffect(() => {
    // Pause BGM when entering booth
    pauseBgm()

    return () => {
      // Resume BGM when leaving booth (cleanup)
      startBgm()
    }
  }, []) // Run once on mount/unmount

  useEffect(() => {
    if (!frameUrl) return
    setIsFrameLoaded(false)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      frameImgRef.current = img
      setIsFrameLoaded(true)
    }
    img.src = frameUrl
  }, [frameUrl])

  // --- 🔥 CORE LOGIC: SCALE TO COVER (ตัดขอบดำทิ้ง) ---
  // ฟังก์ชันนี้ใช้สำหรับวาดภาพลง Canvas (ทั้ง Live View และตอน Snap)
  const drawCover = (ctx, img, cw, ch, preset, isMirror = true) => {
    const vw = img.videoWidth || img.width
    const vh = img.videoHeight || img.height

    // 1. คำนวณ Scale ที่มากที่สุด เพื่อให้ภาพขยายจนเต็มพื้นที่ (ส่วนเกินจะล้นออกไป)
    const scale = Math.max(cw / vw, ch / vh)

    // 2. คำนวณขนาดภาพใหม่
    const dw = vw * scale
    const dh = vh * scale

    // 3. ย้ายจุดวาดไปที่กึ่งกลางจอ
    ctx.translate(cw / 2, ch / 2)

    // 4. กลับด้าน (Mirror) ถ้าต้องการ
    if (isMirror) ctx.scale(-1, 1)

    // 5. Apply Filter
    if (preset) ctx.filter = preset.filter

    // 6. วาดภาพโดยให้จุดกึ่งกลางภาพอยู่ที่ (0,0)
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)

    // 7. Overlay Filter (ถ้ามี)
    if (preset && preset.overlay) {
      ctx.globalCompositeOperation = preset.overlayMode || 'screen'
      ctx.globalAlpha = preset.overlayAlpha
      ctx.filter = preset.overlayBlur
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1.0
    }

    // Reset Transformations
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

        // Sync Canvas size with Display size
        if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
          cvs.width = cvs.clientWidth
          cvs.height = cvs.clientHeight
        }

        // วาดภาพเต็มจอ (ใช้ฟังก์ชัน drawCover)
        drawCover(ctx, vid, cvs.width, cvs.height, FILTER_PRESETS[activeFilter], true)
      }

      // ส่วน Preview (แสดงผลรูปที่ถ่ายไปแล้ว)
      if (composeCanvasRef.current) {
        const cvs = composeCanvasRef.current
        const ctx = cvs.getContext('2d')
        // Sync size
        if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
          cvs.width = cvs.clientWidth
          cvs.height = cvs.clientHeight
        }

        const w = cvs.width
        const h = cvs.height

        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, w, h)

        // วาดรูปที่ถ่ายแล้วลงตาม Slot
        shotImgs.forEach((img, idx) => {
          const slotIndex = idx % frameSlots.length
          const s = frameSlots[slotIndex]
          if (img && s) {
            ctx.drawImage(img, s.x * w, s.y * h, s.w * w, s.h * h)
          }
        })

        // วาดเฟรมทับ
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

  const performSnap = async (step) => {
    playSnap()
    setTriggerFlash(true)
    setTimeout(() => setTriggerFlash(false), 200)

    // กลยุทธ์ Hybrid:
    // 1. ลองยิง DSLR ก่อน (เฉพาะถ้ายังไม่เคยล้มเหลวมาก่อน)
    // 2. ถ้า Fail -> Fallback มาใช้ Webcam (videoRef)

    let dslrSuccess = false

    // เช็คว่าเคย Fail มาก่อนไหม ถ้าเคยแล้ว ให้ข้ามไป Webcam เลยเพื่อความเร็ว
    // const skipDslr = useRef(false) // Moved to top level

    if (!skipDslr.current) {
      try {
        // ส่ง request ไป trigger DSLR
        const formData = new FormData()
        formData.append('step', step)
        // Time out สั้นๆ 3 วินาที เผื่อไม่ได้ต่อกล้องจะได้รีบตัดไป Webcam
        const res = await axios.post(`${API_URL}/trigger_dslr`, formData, { timeout: 3000 })

        if (res.data.status === 'success') {
          dslrSuccess = true
          const imgUrl = res.data.image_url

          // Preload รูปที่ได้จาก DSLR เพื่อความชัวร์
          const img = new Image()
          img.onload = () => {
            setShotImgs(prev => {
              const n = [...prev]
              n[step - 1] = img
              return n
            })
            proceedToNext(step)
          }
          img.onerror = () => {
            // รูปโหลดไม่ได้? แปลกมาก แต่กันเหนียว
            console.error("DSLR Image load failed")
            fallbackWebcam(step)
          }
          img.src = imgUrl
        }
      } catch (e) {
        console.log("DSLR Trigger Failed or Timeout (Switching to Webcam):", e)
        skipDslr.current = true // ครั้งหน้าไม่ต้องลองแล้ว
      }
    }

    if (!dslrSuccess) {
      fallbackWebcam(step)
    }
  }

  const fallbackWebcam = (step) => {
    if (!videoRef.current) return
    const vid = videoRef.current

    // สร้าง Canvas ชั่วคราวเพื่อ Capture
    const tempCvs = document.createElement('canvas')
    tempCvs.width = 1920
    tempCvs.height = 1080 // บังคับ 16:9
    const ctx = tempCvs.getContext('2d')

    // ใช้ logic เดียวกับ Live View เพื่อให้ภาพที่ได้เหมือนตาเห็นเป๊ะ
    drawCover(ctx, vid, tempCvs.width, tempCvs.height, FILTER_PRESETS[activeFilter], true)

    tempCvs.toBlob(async (blob) => {
      if (!blob) return

      // โชว์ Preview ทันที
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

      // อัปโหลดไป Server
      const formData = new FormData()
      formData.append('step', step)
      formData.append('file', blob, `shot_${step}.jpg`)

      try { await axios.post(`${API_URL}/capture_step`, formData) }
      catch (e) { console.error("Upload Failed:", e) }

      proceedToNext(step)

    }, 'image/jpeg', 0.95)
  }

  const proceedToNext = (step) => {
    // ไปช็อตต่อไป หรือ จบ
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
      const formData = new FormData()
      formData.append('frame_id', frameId)
      const res = await axios.post(`${API_URL}/merge`, formData)

      if (res.data.status === 'success') {
        playJingle()
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

  // ... (Print, Back, Reset, Home Logic เหมือนเดิม) ...
  const handlePrint = async () => {
    playClick()
    if (!finalFilename) return
    setIsPrinting(true)
    try {
      const res = await axios.post(`${API_URL}/print/${finalFilename}`)
      alert(res.data.status === 'success' ? "กำลังส่งคำสั่งไปที่เครื่องปริ้น... 🖨️" : "Print Error")
    } catch (e) { alert("Print Error") }
    finally { setIsPrinting(false) }
  }

  const handleBack = async () => {
    playBack()
    try { await axios.delete(`${API_URL}/cleanup`) } catch (e) { }
    navigate('/select-frame')
  }

  const reset = async () => {
    playClick()
    await axios.delete(`${API_URL}/cleanup`)
    setFinalPhoto(null)
    setFinalFilename(null)
    setShotImgs([])
    setCurrentShot(0)
  }

  const goHome = async () => {
    playBack()
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
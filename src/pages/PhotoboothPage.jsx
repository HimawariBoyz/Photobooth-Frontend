// import { useEffect, useRef, useState } from 'react'
// import axios from 'axios'
// import { useNavigate, useLocation } from 'react-router-dom'
// import '../styles/PhotoboothPage.css'

// function PhotoboothPage() {
//   const navigate = useNavigate()
//   const location = useLocation()

//   const [finalPhoto, setFinalPhoto] = useState(null)
//   const [finalFilename, setFinalFilename] = useState(null) // เก็บชื่อไฟล์ไว้สั่งปริ้น
//   const [countdown, setCountdown] = useState(null)
//   const [currentShot, setCurrentShot] = useState(0)
//   const [isProcessing, setIsProcessing] = useState(false)
//   const [isPrinting, setIsPrinting] = useState(false)
//   const [shotImgs, setShotImgs] = useState([])
//   const [frameSlots, setFrameSlots] = useState([])

//   const API_URL = 'http://localhost:8000'
//   const selectedFrame = location.state?.selectedFrame

//   const videoRef = useRef(null)
//   const mainCanvasRef = useRef(null)
//   const composeCanvasRef = useRef(null)
//   const frameImgRef = useRef(null)
//   const rafRef = useRef(null)

//   const frameUrl = selectedFrame
//     ? (selectedFrame.includes('http') ? selectedFrame : `${API_URL}/frames/${selectedFrame}`)
//     : null

//   // 1. Load Slots
//   useEffect(() => {
//     if (!selectedFrame) return
//     axios.get(`${API_URL}/frame-props/${selectedFrame}`)
//       .then(res => {
//         if (res.data.slots) setFrameSlots(res.data.slots)
//       })
//       .catch(err => console.error(err))
//   }, [selectedFrame])

//   // 2. Init Camera (ใช้ 720p เพื่อคุณภาพที่ดีขึ้นสำหรับงานพิมพ์)
//   useEffect(() => {
//     const initCamera = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { width: 1280, height: 720, facingMode: "user" },
//           audio: false
//         })
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream
//           videoRef.current.play().catch(e => console.error(e))
//         }
//       } catch (err) {
//         alert("Camera Error: " + err.message)
//       }
//     }
//     initCamera()
//     return () => {
//       if (videoRef.current?.srcObject) {
//         videoRef.current.srcObject.getTracks().forEach(t => t.stop())
//       }
//       cancelAnimationFrame(rafRef.current)
//     }
//   }, [])

//   // 3. Preload Frame
//   useEffect(() => {
//     if (!frameUrl) return
//     const img = new Image()
//     img.crossOrigin = "anonymous"
//     img.onload = () => { frameImgRef.current = img }
//     img.src = frameUrl
//   }, [frameUrl])

//   // 4. Render Loop
//   const renderLoop = () => {
//     // Left: Live Camera (แก้ไขให้ยืดเต็มกรอบ)
//     if (mainCanvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
//       const cvs = mainCanvasRef.current
//       const ctx = cvs.getContext('2d')
//       const vid = videoRef.current

//       // 1. ตั้งค่าความละเอียด Canvas ให้เท่ากับขนาดกรอบที่แสดงบนหน้าจอ
//       cvs.width = cvs.clientWidth
//       cvs.height = cvs.clientHeight

//       ctx.save()
//       // 2. กลับด้านกระจกเงา (Mirror)
//       ctx.translate(cvs.width, 0)
//       ctx.scale(-1, 1)

//       // 3. วาดภาพจากกล้องให้ "ยืดเต็ม" กรอบ (Stretch to fill)
//       // ไม่ต้องคำนวณ scale, dx, dy แบบเดิมแล้ว วาดให้เต็มความกว้าง/สูงเลย
//       ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)

//       ctx.restore()
//     }

//     // Right: Preview (ส่วนนี้เหมือนเดิม)
//     if (composeCanvasRef.current) {
//       const cvs = composeCanvasRef.current
//       const ctx = cvs.getContext('2d')
//       cvs.width = cvs.clientWidth
//       cvs.height = cvs.clientHeight
//       const w = cvs.width
//       const h = cvs.height

//       ctx.fillStyle = '#f0f0f0'
//       ctx.fillRect(0, 0, w, h)

//       shotImgs.forEach((img, idx) => {
//         const slotIndex = idx % frameSlots.length
//         const s = frameSlots[slotIndex]
//         if (img && s) {
//           ctx.drawImage(img, s.x * w, s.y * h, s.w * w, s.h * h)
//         }
//       })

//       if (frameImgRef.current) {
//         ctx.drawImage(frameImgRef.current, 0, 0, w, h)
//       }
//     }
//     rafRef.current = requestAnimationFrame(renderLoop)
//   }

//   useEffect(() => {
//     rafRef.current = requestAnimationFrame(renderLoop)
//     return () => cancelAnimationFrame(rafRef.current)
//   }, [shotImgs, frameSlots])

//   // 5. Shooting Logic
//   const startSession = () => {
//     setShotImgs([])
//     setCurrentShot(1)
//     doCountdown(1)
//   }

//   const doCountdown = (step) => {
//     let count = 3
//     setCountdown(count)
//     const timer = setInterval(() => {
//       count--
//       if (count === 0) {
//         clearInterval(timer)
//         setCountdown("📸")
//         snap(step)
//       } else {
//         setCountdown(count)
//       }
//     }, 1000)
//   }

//   const snap = (step) => {
//     if (!videoRef.current) return
//     const tempCvs = document.createElement('canvas')
//     tempCvs.width = videoRef.current.videoWidth
//     tempCvs.height = videoRef.current.videoHeight
//     const ctx = tempCvs.getContext('2d')
//     ctx.translate(tempCvs.width, 0)
//     ctx.scale(-1, 1)
//     ctx.drawImage(videoRef.current, 0, 0)

//     tempCvs.toBlob(async (blob) => {
//       const url = URL.createObjectURL(blob)
//       const img = new Image()
//       img.onload = () => {
//         setShotImgs(prev => {
//           const n = [...prev]
//           n[step - 1] = img
//           return n
//         })
//       }
//       img.src = url

//       const formData = new FormData()
//       formData.append('step', step)
//       formData.append('file', blob, `shot_${step}.jpg`)
//       try { await axios.post(`${API_URL}/capture_step`, formData) }
//       catch (e) { }

//       setTimeout(() => {
//         setCountdown(null)
//         if (step < (frameSlots.length || 4)) {
//           setCurrentShot(step + 1)
//           doCountdown(step + 1)
//         } else {
//           finishSession()
//         }
//       }, 800)
//     }, 'image/jpeg', 0.95)
//   }

//   const finishSession = async () => {
//     setIsProcessing(true)
//     try {
//       const res = await axios.post(`${API_URL}/merge?frame_id=${selectedFrame}`)
//       if (res.data.status === 'success') {
//         setFinalPhoto(res.data.image_url)
//         setFinalFilename(res.data.filename) // เก็บชื่อไฟล์ไว้ปริ้น
//       }
//     } catch (e) {
//       alert("Error Merging")
//     } finally {
//       setIsProcessing(false)
//       setCurrentShot(0)
//     }
//   }

//   // --- Print Logic ---
//   const handlePrint = async () => {
//     if (!finalFilename) return
//     setIsPrinting(true)
//     try {
//       const res = await axios.post(`${API_URL}/print/${finalFilename}`)
//       if (res.data.status === 'success') {
//         alert("กำลังส่งคำสั่งไปที่เครื่องปริ้น... 🖨️")
//       } else {
//         alert("ไม่สามารถสั่งปริ้นได้: " + res.data.message)
//       }
//     } catch (e) {
//       alert("Print Error")
//     } finally {
//       setIsPrinting(false)
//     }
//   }

//   const reset = async () => {
//     await axios.delete(`${API_URL}/cleanup`)
//     setFinalPhoto(null)
//     setFinalFilename(null)
//     setShotImgs([])
//     setCurrentShot(0)
//   }

//   const goHome = async () => {
//     await axios.delete(`${API_URL}/cleanup`)
//     navigate('/')
//   }

//   return (
//     <div className="pb-container">
//       <video ref={videoRef} className="hidden-video" playsInline muted autoPlay />

//       {countdown && <div className="overlay-text">{countdown}</div>}
//       {isProcessing && <div className="overlay-text">Processing...</div>}
//       {isPrinting && <div className="overlay-text">Printing... 🖨️</div>}

//       {finalPhoto ? (
//         <div className="result-view">
//           <img src={finalPhoto} className="final-img" alt="Result" />
//           <div className="btn-group">
//             <button onClick={handlePrint} className="btn btn-primary big-btn">สั่งปริ้น 🖨️</button>
//             <button onClick={reset} className="btn btn-secondary">ถ่ายใหม่ 🔄</button>
//             <button onClick={goHome} className="btn btn-secondary">จบงาน 🏠</button>
//           </div>
//         </div>
//       ) : (
//         <div className="capture-view">
//           <div className="cam-section">
//             <div className="cam-box">
//               <canvas ref={mainCanvasRef} className="cam-canvas" />
//               <div className="badge">LIVE CAMERA</div>
//             </div>
//             {currentShot === 0 ? (
//               <button onClick={startSession} className="btn btn-primary big-btn">
//                 เริ่มถ่าย 📸
//               </button>
//             ) : (
//               <div className="status-text">Shot {currentShot} / {frameSlots.length || 4}</div>
//             )}
//           </div>

//           <div className="preview-section">
//             <div className="preview-box">
//               <canvas ref={composeCanvasRef} className="preview-canvas" />
//               <div className="badge">PREVIEW</div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default PhotoboothPage


import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/PhotoboothPage.css'

function PhotoboothPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [finalPhoto, setFinalPhoto] = useState(null)
  const [finalFilename, setFinalFilename] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [currentShot, setCurrentShot] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [shotImgs, setShotImgs] = useState([])
  const [frameSlots, setFrameSlots] = useState([])

  const API_URL = 'http://localhost:8000'
  const selectedFrame = location.state?.selectedFrame

  const videoRef = useRef(null)
  const mainCanvasRef = useRef(null)
  const composeCanvasRef = useRef(null)
  const frameImgRef = useRef(null)
  const rafRef = useRef(null)

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

  // 4. Render Loop
  const renderLoop = () => {
    // Left: Live Camera (ยืดเต็มกรอบ)
    if (mainCanvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const cvs = mainCanvasRef.current
      const ctx = cvs.getContext('2d')
      const vid = videoRef.current

      cvs.width = cvs.clientWidth
      cvs.height = cvs.clientHeight

      ctx.save()
      ctx.translate(cvs.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(vid, 0, 0, cvs.width, cvs.height)
      ctx.restore()
    }

    // Right: Preview
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
  }, [shotImgs, frameSlots])

  // 5. Shooting Logic (ปรับแก้ตรงนี้)
  const startSession = () => {
    setShotImgs([])
    setCurrentShot(1)

    // ช็อตแรกเริ่มที่ 8 วินาที
    doCountdown(1, 8)
  }

  const doCountdown = (step, seconds) => {
    let count = seconds
    setCountdown(count)

    const timer = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(timer)
        setCountdown("📸") // ถ่ายจริงที่วินาทีที่ 0 (คือหลังจากจบวิที่ 1)
        snap(step)
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  const snap = (step) => {
    if (!videoRef.current) return
    const tempCvs = document.createElement('canvas')
    tempCvs.width = videoRef.current.videoWidth
    tempCvs.height = videoRef.current.videoHeight
    const ctx = tempCvs.getContext('2d')
    ctx.translate(tempCvs.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(videoRef.current, 0, 0)

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
      catch (e) { }

      // พัก 2 วินาที ก่อนไปรูปถัดไป
      setTimeout(() => {
        setCountdown(null)
        if (step < (frameSlots.length || 4)) {
          setCurrentShot(step + 1)
          // รูปต่อไปนับถอยหลัง 3 วินาที
          doCountdown(step + 1, 3)
        } else {
          finishSession()
        }
      }, 2000) // <-- แก้เป็น 2000ms (2 วินาที)
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
      <video ref={videoRef} className="hidden-video" playsInline muted autoPlay />

      {countdown && <div className="overlay-text">{countdown}</div>}
      {isProcessing && <div className="overlay-text">Processing...</div>}
      {isPrinting && <div className="overlay-text">Printing... 🖨️</div>}

      {finalPhoto ? (
        <div className="result-view">
          <img src={finalPhoto} className="final-img" alt="Result" />
          <div className="btn-group">
            <button onClick={handlePrint} className="btn btn-primary big-btn">สั่งปริ้น 🖨️</button>
            <button onClick={reset} className="btn btn-secondary">ถ่ายใหม่ 🔄</button>
            <button onClick={goHome} className="btn btn-secondary">จบงาน 🏠</button>
          </div>
        </div>
      ) : (
        <div className="capture-view">
          <div className="cam-section">
            <div className="cam-box">
              <canvas ref={mainCanvasRef} className="cam-canvas" />
              <div className="badge">LIVE CAMERA</div>
            </div>
            {currentShot === 0 ? (
              <button onClick={startSession} className="btn btn-primary big-btn">
                เริ่มถ่าย ({frameSlots.length || 4} แอค) 📸
              </button>
            ) : (
              <div className="status-text">Shot {currentShot} / {frameSlots.length || 4}</div>
            )}
          </div>

          <div className="preview-section">
            <div className="preview-box">
              <canvas ref={composeCanvasRef} className="preview-canvas" />
              <div className="badge">PREVIEW</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotoboothPage
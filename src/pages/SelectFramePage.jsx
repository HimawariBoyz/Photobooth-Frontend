import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSound from '../hooks/useSound'
import '../styles/SelectFramePage.css'

function SelectFramePage() {
  const navigate = useNavigate()
  const { playClick, playSelect, playBack } = useSound()

  const ITEMS_PER_PAGE = 20

  // Use eager import to get URL/paths directly
  const frameModules = import.meta.glob('../assets/frames/*.png', { eager: true })

  // Convert to array
  const STATIC_FRAMES = Object.entries(frameModules).map(([path, mod], index) => {
    // path is like "../assets/frames/Frame1.png"
    const filename = path.split('/').pop()
    return {
      id: filename,
      name: filename,
      url: mod.default // The resolved URL (e.g. /assets/Frame1.png)
    }
  }).sort((a, b) => {
    // Natural sort order for frames (Frame1, Frame2, ... Frame10)
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })

  // State
  const [frames, setFrames] = useState(STATIC_FRAMES)
  const [selectedId, setSelectedId] = useState(null)

  // No loading needed for local assets
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const selectedFrame = useMemo(
    () => frames.find(f => f.id === selectedId) || null,
    [frames, selectedId]
  )

  const totalPages = Math.ceil(frames.length / ITEMS_PER_PAGE)

  const currentFrames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return frames.slice(start, start + ITEMS_PER_PAGE)
  }, [frames, currentPage, ITEMS_PER_PAGE])

  const fetchFrames = () => {
    // Just fake refresh effect
    setLoading(true)
    setTimeout(() => {
      setFrames(STATIC_FRAMES)
      setLoading(false)
    }, 300)
  }

  // Effect not strictly needed if we init state directly, but good for consistency
  useEffect(() => {
    setFrames(STATIC_FRAMES)
  }, [])

  const confirm = () => {
    playClick()
    if (!selectedId) return
    navigate('/booth', { state: { selectedFrame } })
  }

  const handleSelect = (id) => {
    playSelect()
    setSelectedId(id)
  }

  const handlePageChange = (pageNum) => {
    setCurrentPage(pageNum)
  }

  const removeExtension = (filename) => {
    if (!filename) return ''
    return filename.replace(/\.[^/.]+$/, "")
  }

  return (
    <div className="sf-page">

      {/* --- Decoration Layers (Background/Overlay) --- */}

      {/* 1. หิมะตก */}
      <div className="sf-snow-overlay"></div>

      {/* 2. ของประดับห้อย (Hanging Ornaments) */}
      <div className="sf-hanging-decor decor-top-left">
        <div className="sf-string" style={{ height: '100px' }}></div>
        <div className="sf-ball"></div>
      </div>
      <div className="sf-hanging-decor decor-top-right">
        <div className="sf-string" style={{ height: '140px' }}></div>
        <div className="sf-ball bg-gold"></div>
      </div>

      {/* 3. พร็อพด้านข้าง (Side Props) */}
      <div className="sf-side-decor decor-left">
        {/* ต้นคริสต์มาส SVG */}
        <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 L10 90 H90 L50 10Z" fill="#198754" stroke="#0f5132" strokeWidth="2" />
          <path d="M50 30 L20 90 H80 L50 30Z" fill="#20c997" />
          <rect x="42" y="90" width="16" height="20" fill="#8B4513" />
          <path d="M50 0 L53 7 L60 7 L55 12 L57 18 L50 14 L43 18 L45 12 L40 7 H47 Z" fill="#FFD700" />
        </svg>
      </div>
      <div className="sf-side-decor decor-right">
        {/* กล่องของขวัญ SVG */}
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="30" width="80" height="70" rx="4" fill="#D42426" />
          <rect x="40" y="30" width="20" height="70" fill="#FFD700" />
          <rect x="10" y="55" width="80" height="20" fill="#FFD700" />
          <path d="M50 30 C50 10 30 10 30 30 H50 Z" fill="#D42426" stroke="#fff" strokeWidth="2" />
          <path d="M50 30 C50 10 70 10 70 30 H50 Z" fill="#D42426" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>

      {/* --- Main Content Card --- */}
      <div className="sf-card" role="main">
        {/* --- Top Bar --- */}
        <div className="sf-topbar">
          <button
            className="sf-icon-btn sf-btn-back"
            onClick={() => { playBack(); navigate('/'); }}
            title="ย้อนกลับ"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="sf-head">
            <div className="sf-kicker">🎄 Merry Christmas</div>
            <div className="sf-title">เลือกกรอบรูป</div>
          </div>

          <div className="sf-actions">
            <button
              className={`sf-icon-btn sf-btn-refresh ${loading ? 'is-loading' : ''}`}
              onClick={() => { playClick(); fetchFrames(); }}
              disabled={loading}
              title="รีเฟรชข้อมูล"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Debug Info if no frames found */}
        {!loading && frames.length === 0 && (
          <div className="sf-banner sf-banner--warning">
            <span>ไม่พบกรอบรูปภาพในโฟลเดอร์ src/assets/frames/</span>
            <button className="sf-link" onClick={() => { playClick(); fetchFrames(); }}>รีเฟรช</button>
          </div>
        )}

        {/* --- Main Body: Grid Area --- */}
        <div className="sf-body">
          {loading ? (
            <div className="sf-loading-state">
              <div className="sf-spinner"></div>
              <span>กำลังโหลด...</span>
            </div>
          ) : (
            <>
              <div className="sf-grid-container">
                {currentFrames.map(frame => {
                  const active = frame.id === selectedId
                  const displayName = removeExtension(frame.name)

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      className={`sf-item ${active ? 'is-active' : ''}`}
                      onClick={() => handleSelect(frame.id)}
                    >
                      <div className="sf-thumb">
                        <img src={frame.url} alt={displayName} />
                      </div>
                      <div className="sf-name">{displayName}</div>
                      {active && <div className="sf-check-icon">✓</div>}
                    </button>
                  )
                })}
              </div>

              {/* --- Pagination Controls --- */}
              {totalPages > 1 && (
                <div className="sf-pagination">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      className={`sf-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => { playClick(); handlePageChange(pageNum); }}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* --- Footer --- */}
        <div className="sf-footer">
          <div className="sf-selected">
            {selectedFrame ? (
              <>
                <span className="sf-dot" />
                <span>เลือก: </span>
                <b>{removeExtension(selectedFrame.name)}</b>
              </>
            ) : (
              <span className="sf-muted">กรุณาเลือกกรอบเพื่อดำเนินการต่อ</span>
            )}
          </div>

          <button className="sf-primary" onClick={confirm} disabled={!selectedId || loading}>
            ยืนยันและเริ่มถ่าย 📸
          </button>
        </div>
      </div>
    </div>
  )
}

export default SelectFramePage
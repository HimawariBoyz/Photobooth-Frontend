import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import '../styles/SelectFramePage.css'

function SelectFramePage() {
  const navigate = useNavigate()
  const API_URL = 'http://localhost:8000'

  const [frames, setFrames] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showPopup, setShowPopup] = useState(false)

  const selectedFrame = useMemo(
    () => frames.find(f => f.id === selectedId) || null,
    [frames, selectedId]
  )

  const fetchFrames = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get(`${API_URL}/frames-list`)
      setFrames(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError('ไม่สามารถเชื่อมต่อ Server ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFrames()
  }, [])

  const confirm = () => {
    if (!selectedId) return
    navigate('/booth', { state: { selectedFrame: selectedId } })
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    setShowPopup(false)
  }

  return (
    <div className="sf-page">
      <div className="sf-card" role="main">
        <div className="sf-topbar">
          <button className="sf-back" onClick={() => navigate('/')}>
            ← กลับ
          </button>

          <div className="sf-head">
            <div className="sf-kicker">🎄 Merry Christmas</div>
            <div className="sf-title">เลือกกรอบรูป</div>
          </div>

          <div className="sf-actions">
             <button className="sf-ghost" onClick={fetchFrames} disabled={loading}>
              รีเฟรช
            </button>
          </div>
        </div>

        {error && (
          <div className="sf-banner sf-banner--error">
            <span>{error}</span>
            <button className="sf-link" onClick={fetchFrames}>
              ลองใหม่
            </button>
          </div>
        )}

        <div className="sf-body">
            <div className="sf-preview-area">
                {selectedFrame ? (
                    <img 
                        src={selectedFrame.url} 
                        alt="Selected" 
                        className="sf-preview-img"
                    />
                ) : (
                    <div className="sf-empty-state">
                        <span style={{fontSize: '3rem'}}>🖼️</span>
                        <p>ยังไม่ได้เลือกกรอบรูป</p>
                    </div>
                )}

                <button className="sf-btn-choose" onClick={() => setShowPopup(true)}>
                    {selectedFrame ? '🔄 เปลี่ยนกรอบรูป' : '🔍 เลือกกรอบรูป'}
                </button>
            </div>

            <div className="sf-footer">
                <div className="sf-selected">
                {selectedFrame ? (
                    <>
                    <span className="sf-dot" />
                    <span>กรอบ: </span>
                    <b>{selectedFrame.name}</b>
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

      {showPopup && (
        <div className="sf-modal-overlay" onClick={() => setShowPopup(false)}>
            <div className="sf-modal-content" onClick={e => e.stopPropagation()}>
                <div className="sf-modal-header">
                    <div className="sf-modal-title">เลือกกรอบที่คุณชอบ</div>
                    <button className="sf-btn-close" onClick={() => setShowPopup(false)}>✕</button>
                </div>

                <div className="sf-modal-body">
                    <div className="sf-grid">
                        {loading && <div style={{textAlign:'center', width:'100%'}}>กำลังโหลด...</div>}
                        
                        {!loading && frames.map(frame => {
                            const active = frame.id === selectedId
                            return (
                                <button
                                    key={frame.id}
                                    type="button"
                                    className={`sf-item ${active ? 'is-active' : ''}`}
                                    onClick={() => handleSelect(frame.id)}
                                >
                                    <div className="sf-thumb">
                                        <img src={frame.url} alt={frame.name} />
                                    </div>
                                    <div className="sf-name">{frame.name}</div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

export default SelectFramePage
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from '../hooks/useSound';
import { gsap } from 'gsap';
import '../styles/WelcomePage.css';
import bgImage from '../assets/background/Photobooth2.png';

function WelcomePage() {
  const navigate = useNavigate();
  const { playClick } = useSound();
  const comp = useRef(null);

  // สร้างหิมะ 50 ก้อน
  const snowflakes = React.useMemo(() => [...Array(50)].map((_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    animationDuration: Math.random() * 4 + 3 + 's',
    animationDelay: Math.random() * 5 + 's',
    size: Math.random() * 4 + 4 + 'px'
  })), []);

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".home__bg", { scale: 1.2, duration: 2.5, ease: "power2.out" });

      const tl = gsap.timeline();
      tl.from(".home__kicker", { y: -20, opacity: 0, duration: 0.8, ease: "back.out" })
        .from(".home__title-main", { scale: 0.5, opacity: 0, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.4")
        .from(".home__subtitle", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".btn-start-wrapper", { y: 30, opacity: 0, duration: 0.8, ease: "back.out(1.7)" }, "-=0.4")
        .from(".footer-text", { opacity: 0, duration: 1, delay: 0.5 });

    }, comp);

    return () => ctx.revert();
  }, []);

  return (
    <div className="home" ref={comp}>
      <img src={bgImage} alt="Christmas Background" className="home__bg" />

      {/* Snow Container */}
      <div className="snow-container">
        {snowflakes.map(flake => (
          <div key={flake.id} className="snowflake" style={{
            left: flake.left,
            animationDuration: flake.animationDuration,
            animationDelay: flake.animationDelay,
            width: flake.size,
            height: flake.size
          }} />
        ))}
      </div>

      <div className="home__container">
        {/* UI Layer ตรงกลาง */}
        <div className="ui-layer">
          <div className="home__header-group">
            <div className="home__kicker">PHOTOBOOTH</div>
            <h1 className="home__title-main">CHRISTMAS</h1>
            <div className="home__subtitle">@SATTHASAMUT</div>
          </div>

          <div className="btn-start-wrapper">
            <button className="btn-start" onClick={() => {
              playClick();
              navigate('/select-frame');
            }}>
              START 📸
            </button>
          </div>
        </div>

        <div className="footer-text">Created by Himawariboyz</div>
      </div>
    </div>
  );
}

export default WelcomePage;
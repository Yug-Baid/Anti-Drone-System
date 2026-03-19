import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";

export default function GlassCard({ children, className = "", delay = 0, ...props }) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          delay,
          ease: "power3.out",
        }
      );
    }
  }, [delay]);

  return (
    <div ref={cardRef} className={`glass-card ${className}`} {...props}>
      {children}
    </div>
  );
}

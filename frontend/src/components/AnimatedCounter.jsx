import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";

export default function AnimatedCounter({ end, suffix = "", prefix = "", decimals = 0, duration = 2 }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !triggered.current) {
          triggered.current = true;
          const obj = { val: 0 };
          gsap.to(obj, {
            val: end,
            duration,
            ease: "power2.out",
            onUpdate: () => {
              setDisplay(obj.val.toFixed(decimals));
            },
          });
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration, decimals]);

  return (
    <span ref={ref} className="animated-counter">
      {prefix}{display}{suffix}
    </span>
  );
}

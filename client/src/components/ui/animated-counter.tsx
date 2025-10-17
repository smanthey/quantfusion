import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ 
  value, 
  decimals = 0, 
  prefix = "", 
  suffix = "",
  className = "" 
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const spring = useSpring(value, { 
    stiffness: 100, 
    damping: 30,
    mass: 0.8
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplayValue(latest);
    });

    return () => unsubscribe();
  }, [spring]);

  return (
    <span className={className}>
      {prefix}
      {Number(displayValue ?? 0).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      {suffix}
    </span>
  );
}

interface AnimatedPriceProps {
  value: number;
  className?: string;
  showChange?: boolean;
  previousValue?: number;
}

export function AnimatedPrice({ 
  value, 
  className = "",
  showChange = false,
  previousValue 
}: AnimatedPriceProps) {
  const [flash, setFlash] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  const isIncrease = previousValue ? value > previousValue : false;
  const isDecrease = previousValue ? value < previousValue : false;

  return (
    <motion.span
      className={`inline-block ${className}`}
      animate={{
        scale: flash ? [1, 1.05, 1] : 1,
        color: flash 
          ? isIncrease 
            ? ["inherit", "#10b981", "inherit"]
            : isDecrease 
            ? ["inherit", "#ef4444", "inherit"]
            : "inherit"
          : "inherit"
      }}
      transition={{ duration: 0.3 }}
    >
      <AnimatedCounter value={value} decimals={2} prefix="$" />
    </motion.span>
  );
}

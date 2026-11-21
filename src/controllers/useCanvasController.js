import { useRef, useState, useCallback } from "react";

export function useCanvasController() {
  const canvasRef = useRef(null);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [drawing, setDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const isEraser = color === "#ffffff";

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  const start = useCallback((e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = isEraser ? 20 : size;
    ctx.lineCap = "round";
    setDrawing(true);
    // save snapshot for undo
    setHistory((h) => [...h, canvas.toDataURL()]);
  }, [color, size, isEraser, getPos]);

  const move = useCallback((e) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [drawing, getPos]);

  const end = useCallback(() => { setDrawing(false); }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      const img = new Image();
      img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0); };
      img.src = prev;
      return h.slice(0, -1);
    });
  }, []);

  const exportPNG = useCallback(() => {
    return canvasRef.current.toDataURL("image/png");
  }, []);

  return { canvasRef, color, setColor, size, setSize, drawing, start, move, end, clear, undo, exportPNG, isEraser };
}
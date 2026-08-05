import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface UseQrCodeScannerOptions {
  onDetected: (value: string) => void;
}

interface UseQrCodeScannerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  isScanning: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useQrCodeScanner({ onDetected }: UseQrCodeScannerOptions): UseQrCodeScannerResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (result?.data) {
      onDetected(result.data);
      stop();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [onDetected, stop]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);
      animationFrameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Could not access the camera. Check permissions and try again.');
    }
  }, [tick]);

  useEffect(() => stop, [stop]);

  return { videoRef, isScanning, error, start, stop };
}

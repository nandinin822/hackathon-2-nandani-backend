import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import cv2

# Local backend root and vendor fallback
BACKEND_ROOT = Path(__file__).resolve().parent
VENDOR_DIR = Path('/home/pc/.gemini/antigravity-ide/scratch/vendor/ai-fall-detection-system')

if (BACKEND_ROOT / "src").exists():
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))
elif VENDOR_DIR.exists():
    if str(VENDOR_DIR) not in sys.path:
        sys.path.insert(0, str(VENDOR_DIR))

from src.webapp.pipeline import process_video
from src.webapp.server import _load_config

class VideoFallPipelineAdapter:
    """
    Adapter bridging video uploads to the pretrained BiLSTM ensemble
    and MediaPipe BlazePose pipeline with zero CPU lag.
    """
    def __init__(self):
        self.config = _load_config()
        self.config["pose"]["model_complexity"] = 0  # BlazePose Lite for CPU performance
        self.config["pose"]["backend"] = "mediapipe"
        
        # Locate model checkpoints
        if (BACKEND_ROOT / "models" / "run5_stride2_aug").exists():
            models_base = BACKEND_ROOT / "models"
        elif (VENDOR_DIR / "models").exists():
            models_base = VENDOR_DIR / "models"
        else:
            models_base = BACKEND_ROOT / "models"
            
        self.model_paths = [
            str(models_base / "run5_stride2_aug" / "fold_0" / "best_model.pth"),
            str(models_base / "urfd" / "fold_0" / "best_model.pth")
        ]
        
        # Anti-spam alert tracking
        self.last_alert_time = 0.0
        self.alert_cooldown_sec = 15.0

    def analyze_video(
        self,
        video_path: Path,
        output_video_path: Path,
        confidence_threshold: float = 0.65
    ) -> Dict[str, Any]:
        """
        Executes sequential frame analysis, writes annotated video preview,
        evaluates BiLSTM temporal features, and extracts peak JPEG snapshot.
        """
        output_video_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Run core inference pipeline
        pipeline_result = process_video(
            video_path=video_path,
            output_video_path=output_video_path,
            config=self.config,
            model_paths=self.model_paths,
            use_vlm=False
        )
        
        # Identify peak fall likelihood and timestamp
        max_p_fall = 0.0
        peak_frame_idx = 1
        peak_time_sec = 0.0
        
        for p in pipeline_result.probabilities:
            if p.p_fall > max_p_fall:
                max_p_fall = p.p_fall
                peak_frame_idx = p.frame
                peak_time_sec = p.time_sec

        # Extract snapshot image of the peak frame for Telegram notification
        peak_snapshot_jpeg = None
        if output_video_path.exists():
            cap = cv2.VideoCapture(str(output_video_path))
            cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, peak_frame_idx - 1))
            ret, frame = cap.read()
            cap.release()
            if ret and frame is not None:
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                peak_snapshot_jpeg = buf.tobytes()

        # Classify event status
        has_fall = len(pipeline_result.events) > 0 or max_p_fall >= confidence_threshold
        if has_fall:
            status = "EMERGENCY_FALL"
            details = f"Fall hazard identified with peak model confidence of {max_p_fall*100:.1f}% at {peak_time_sec:.2f}s."
            rec_action = "Immediate family check-in and caregiver assistance required."
        elif max_p_fall >= 0.40:
            status = "WARNING_INACTIVITY"
            details = f"Abnormal posture or rapid shift detected (Peak likelihood: {max_p_fall*100:.1f}%)."
            rec_action = "Routine check-in recommended to verify patient comfort."
        else:
            status = "SAFE"
            details = "Normal mobility and posture detected throughout the video. No fall indicators found."
            rec_action = "Routine monitoring active."

        events_data = [
            {
                "frame": e.frame,
                "time_sec": round(e.time_sec, 2),
                "confidence": round(e.confidence, 4),
                "status": "EMERGENCY_FALL",
                "description": f"Fall event identified at {e.time_sec:.2f}s (Confidence: {e.confidence*100:.1f}%)"
            }
            for e in pipeline_result.events
        ]
        
        if has_fall and not events_data:
            events_data.append({
                "frame": peak_frame_idx,
                "time_sec": round(peak_time_sec, 2),
                "confidence": round(max_p_fall, 4),
                "status": "EMERGENCY_FALL",
                "description": f"Peak fall impact detected at {peak_time_sec:.2f}s (Likelihood: {max_p_fall*100:.1f}%)"
            })

        fps_speed = round(pipeline_result.processed_frames / max(pipeline_result.elapsed_sec, 0.001), 1)

        return {
            "status": status,
            "max_fall_probability": round(max_p_fall, 4),
            "peak_timestamp": round(peak_time_sec, 2),
            "events": events_data,
            "probabilities": [
                {"time_sec": round(p.time_sec, 2), "p_fall": round(p.p_fall, 4)}
                for p in pipeline_result.probabilities[::2]  # Subsampled for lightweight payload
            ],
            "total_frames": pipeline_result.total_frames,
            "processed_frames": pipeline_result.processed_frames,
            "duration_sec": round(pipeline_result.duration_sec, 2),
            "elapsed_sec": round(pipeline_result.elapsed_sec, 2),
            "processing_fps": fps_speed,
            "details": details,
            "recommended_action": rec_action,
            "peak_frame_jpeg": peak_snapshot_jpeg,
            "model_info": "Pretrained BiLSTM Ensemble (URFD + Run5 Augmented) with MediaPipe BlazePose Lite (CPU)",
            "disclaimer": "Heuristic model prediction for eldercare assistance; not a calibrated medical diagnostic tool."
        }

# Global singleton
fall_detector = VideoFallPipelineAdapter()

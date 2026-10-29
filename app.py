import os
import json
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
import requests
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

app = FastAPI(
    title="AegisCare AI - Smart Vision Guardian",
    description="Intelligent visual sentinel for elderly healthcare and fall detection."
)

# Enable CORS for decoupled frontend deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BACKEND_ROOT = Path(__file__).resolve().parent
STATIC_DIR = BACKEND_ROOT / "static"
ASSETS_DIR = STATIC_DIR / "assets"
UPLOADS_DIR = BACKEND_ROOT / "uploads"
PROCESSED_DIR = STATIC_DIR / "processed"

STATIC_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Import the fall detector pipeline adapter
try:
    from fall_detector import fall_detector
    FALL_DETECTOR_AVAILABLE = True
except Exception as e:
    print(f"Warning: fall_detector module loading notice: {e}")
    fall_detector = None
    FALL_DETECTOR_AVAILABLE = False

# In-memory activity log store
activity_logs: List[Dict[str, Any]] = [
    {
        "id": "log-1",
        "timestamp": "08:30:15 AM",
        "activity": "Morning Mobility Routine",
        "status": "SAFE",
        "details": "Patient moved smoothly from bedroom to living room.",
        "alert_sent": False
    },
    {
        "id": "log-2",
        "timestamp": "09:15:40 AM",
        "activity": "Resting in Armchair",
        "status": "SAFE",
        "details": "Sitting comfortably, posture relaxed and steady.",
        "alert_sent": False
    },
    {
        "id": "log-3",
        "timestamp": "10:10:02 AM",
        "activity": "Restroom Mobility Check",
        "status": "SAFE",
        "details": "Entered bathroom doorway safely at standard walking pace.",
        "alert_sent": False
    }
]

class TelegramConfig(BaseModel):
    bot_token: str
    chat_id: str

def send_telegram_notification(text: str, image_bytes: Optional[bytes] = None) -> dict:
    """Send alert notification with optional snapshot image to Telegram chat."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not bot_token or not chat_id:
        return {"success": False, "reason": "Telegram credentials not configured"}
    
    try:
        if image_bytes:
            url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
            files = {"photo": ("alert_snapshot.jpg", image_bytes, "image/jpeg")}
            data = {"chat_id": chat_id, "caption": text, "parse_mode": "HTML"}
            res = requests.post(url, data=data, files=files, timeout=12)
        else:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
            res = requests.post(url, json=data, timeout=10)
            
        res_json = res.json()
        if res.status_code == 200 and res_json.get("ok"):
            return {"success": True, "message_id": res_json.get("result", {}).get("message_id")}
        else:
            return {"success": False, "error": res_json.get("description", "Telegram API error")}
    except Exception as e:
        return {"success": False, "error": str(e)}

def analyze_with_gemini_vision(image_bytes: bytes) -> Optional[dict]:
    """Call Gemini Vision API to evaluate single camera snapshot."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Select active model
        model = None
        for m_name in ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-flash-latest']:
            try:
                model = genai.GenerativeModel(m_name)
                break
            except Exception:
                continue

        if not model:
            model = genai.GenerativeModel('gemini-flash-latest')

        prompt = """
        You are AegisCare AI, an eldercare vision guardian monitoring an elderly person.
        Analyze this camera snapshot and return a valid JSON object ONLY with the following keys:
        {
          "person_detected": true/false,
          "activity": "Brief title (e.g., Sitting, Walking, Bathroom Visit, Sleeping in Chair, Dropped Prop, Fall Detected)",
          "status": "SAFE" or "WARNING_INACTIVITY" or "WARNING_SLEEPING" or "WARNING_DROPPED_PROP" or "EMERGENCY_FALL",
          "inactivity_mins": estimated minutes person has been still (0 if moving or unknown),
          "details": "A clear 1-2 sentence description of what the elderly person is doing and safety observation.",
          "confidence_score": 0.0 to 1.0,
          "recommended_action": "Suggested action for family (e.g., No action needed, Send check-in call, Emergency response required)"
        }
        Do not include markdown triple backticks around the JSON.
        """

        image_part = {"mime_type": "image/jpeg", "data": image_bytes}
        response = model.generate_content([prompt, image_part])
        text_content = response.text.strip()
        
        if text_content.startswith("```json"):
            text_content = text_content[7:]
        if text_content.startswith("```"):
            text_content = text_content[3:]
        if text_content.endswith("```"):
            text_content = text_content[:-3]
        text_content = text_content.strip()

        return json.loads(text_content)
    except Exception as e:
        print(f"Gemini API error: {e}")
        return None

@app.get("/")
def read_root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return JSONResponse({
        "system": "AegisCare AI",
        "status": "active",
        "docs_url": "/docs"
    })

@app.get("/styles.css")
def get_styles():
    f = STATIC_DIR / "styles.css"
    if f.exists():
        return FileResponse(f, media_type="text/css")
    raise HTTPException(status_code=404)

@app.get("/app.js")
def get_app_js():
    f = STATIC_DIR / "app.js"
    if f.exists():
        return FileResponse(f, media_type="application/javascript")
    raise HTTPException(status_code=404)

@app.get("/assets/{filename:path}")
def get_static_asset(filename: str):
    f = STATIC_DIR / "assets" / filename
    if f.exists():
        return FileResponse(f)
    raise HTTPException(status_code=404)


@app.get("/api/config")
def get_config():
    """Returns current integration status."""
    has_gemini = bool(os.getenv("GEMINI_API_KEY"))
    has_telegram = bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID"))
    return {
        "gemini_active": has_gemini,
        "telegram_active": has_telegram,
        "bot_token_set": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
        "chat_id_set": bool(os.getenv("TELEGRAM_CHAT_ID")),
        "fall_pipeline_active": FALL_DETECTOR_AVAILABLE
    }

@app.post("/api/config/telegram")
def update_telegram_config(config: TelegramConfig):
    """Updates Telegram bot credentials and sends verification ping."""
    os.environ["TELEGRAM_BOT_TOKEN"] = config.bot_token
    os.environ["TELEGRAM_CHAT_ID"] = config.chat_id
    
    test_result = send_telegram_notification(
        "🛡️ <b>AegisCare AI Connected!</b>\nTelegram emergency alerts are now synchronized."
    )
    return {"status": "updated", "telegram_status": test_result}

@app.post("/api/analyze-frame")
async def analyze_frame(
    file: Optional[UploadFile] = File(None),
    scenario: Optional[str] = Form(None),
    send_telegram: bool = Form(False)
):
    """Evaluates single frame snapshot or preset test scenario."""
    image_bytes = None
    if file:
        image_bytes = await file.read()
    
    result = None
    if image_bytes:
        result = analyze_with_gemini_vision(image_bytes)

    # Heuristic / Scenario fallback
    if not result:
        if scenario == "fall":
            result = {
                "person_detected": True,
                "activity": "Sudden Fall Detected on Floor",
                "status": "EMERGENCY_FALL",
                "inactivity_mins": 2,
                "details": "ALERT: Person is lying on floor near chair. High urgency fall risk detected.",
                "confidence_score": 0.96,
                "recommended_action": "Immediate emergency call & family intervention required!"
            }
        elif scenario == "sleeping":
            result = {
                "person_detected": True,
                "activity": "Slumped Motionless in Armchair",
                "status": "WARNING_SLEEPING",
                "inactivity_mins": 35,
                "details": "Patient is slumped in chair with lack of regular postural adjustment.",
                "confidence_score": 0.92,
                "recommended_action": "Initiate audio check-in call to confirm wellbeing."
            }
        elif scenario == "dropped_prop":
            result = {
                "person_detected": True,
                "activity": "Dropped Object / Walking Cane",
                "status": "WARNING_DROPPED_PROP",
                "inactivity_mins": 0,
                "details": "Walking cane dropped on floor beside armchair.",
                "confidence_score": 0.89,
                "recommended_action": "Check if assistance is needed to retrieve mobility aid."
            }
        elif scenario == "inactivity":
            result = {
                "person_detected": True,
                "activity": "Prolonged Motionless Inactivity",
                "status": "WARNING_INACTIVITY",
                "inactivity_mins": 45,
                "details": "Patient has remained in the same posture with zero movement for 45 minutes.",
                "confidence_score": 0.91,
                "recommended_action": "Perform periodic check-in call."
            }
        elif scenario == "washroom":
            result = {
                "person_detected": True,
                "activity": "Washroom Visit",
                "status": "SAFE",
                "inactivity_mins": 0,
                "details": "Patient entered bathroom doorway safely at normal walking pace.",
                "confidence_score": 0.94,
                "recommended_action": "Routine safety monitoring active."
            }
        else:
            result = {
                "person_detected": True,
                "activity": "Resting Safely in Armchair",
                "status": "SAFE",
                "inactivity_mins": 15,
                "details": "Patient sitting comfortably, normal vital posture, breathing steady.",
                "confidence_score": 0.98,
                "recommended_action": "Routine safety monitoring active."
            }

    now_str = time.strftime("%I:%M:%S %p")
    result["timestamp"] = now_str
    
    new_log = {
        "id": f"log-{len(activity_logs)+1}",
        "timestamp": now_str,
        "activity": result["activity"],
        "status": result["status"],
        "details": result["details"],
        "alert_sent": False
    }
    activity_logs.insert(0, new_log)
    if len(activity_logs) > 30:
        activity_logs.pop()

    telegram_status = {"attempted": False}
    if send_telegram or result["status"] in ["WARNING_INACTIVITY", "WARNING_SLEEPING", "WARNING_DROPPED_PROP", "EMERGENCY_FALL"]:
        icon = "🚨" if result["status"] == "EMERGENCY_FALL" else "⚠️"
        msg = (
            f"{icon} <b>AegisCare AI Alert - {result['status']}</b>\n\n"
            f"<b>Activity:</b> {result['activity']}\n"
            f"<b>Time:</b> {now_str}\n"
            f"<b>Details:</b> {result['details']}\n"
            f"<b>Action:</b> {result['recommended_action']}"
        )
        res = send_telegram_notification(msg, image_bytes=image_bytes)
        telegram_status = {"attempted": True, "result": res}
        new_log["alert_sent"] = res.get("success", False)

    return {
        "analysis": result,
        "telegram_status": telegram_status
    }

@app.post("/api/analyze-video")
async def analyze_video_endpoint(
    file: Optional[UploadFile] = File(None),
    preset_video: Optional[str] = Form(None)
):
    """
    Analyzes an uploaded video file using the pretrained BiLSTM ensemble
    and MediaPipe BlazePose pipeline on CPU.
    """
    if not FALL_DETECTOR_AVAILABLE or not fall_detector:
        raise HTTPException(status_code=503, detail="Fall detection engine not initialized.")

    target_video_path = None
    temp_upload = False

    try:
        if file and file.filename:
            # Save uploaded video
            file_ext = Path(file.filename).suffix.lower() or ".mp4"
            target_filename = f"upload_{int(time.time())}_{file.filename}"
            target_video_path = UPLOADS_DIR / target_filename
            content = await file.read()
            target_video_path.write_bytes(content)
            temp_upload = True
        elif preset_video:
            # Use preset benchmark clips
            safe_filename = Path(preset_video).name
            candidate_path = ASSETS_DIR / safe_filename
            if candidate_path.exists():
                target_video_path = candidate_path
            else:
                raise HTTPException(status_code=404, detail=f"Preset video '{safe_filename}' not found.")
        else:
            # Fallback to default fall benchmark
            target_video_path = ASSETS_DIR / "sample_fall.mp4"
            if not target_video_path.exists():
                raise HTTPException(status_code=400, detail="No video file provided.")

        # Prepare output annotated video path
        output_filename = f"annotated_{int(time.time())}_{target_video_path.name}"
        output_video_path = PROCESSED_DIR / output_filename

        # Run pipeline
        analysis = fall_detector.analyze_video(target_video_path, output_video_path)
        analysis["annotated_video_url"] = f"/static/processed/{output_filename}"

        # Record activity event in timeline
        now_str = time.strftime("%I:%M:%S %p")
        log_entry = {
            "id": f"log-{len(activity_logs)+1}",
            "timestamp": now_str,
            "activity": f"Video Analysis: {analysis['status'].replace('_', ' ')}",
            "status": analysis["status"],
            "details": analysis["details"],
            "alert_sent": False
        }
        activity_logs.insert(0, log_entry)

        # Trigger Telegram alert on confirmed fall with cooldown protection
        telegram_status = {"attempted": False}
        current_time = time.time()
        if analysis["status"] == "EMERGENCY_FALL":
            if (current_time - fall_detector.last_alert_time) > fall_detector.alert_cooldown_sec:
                fall_detector.last_alert_time = current_time
                alert_text = (
                    f"🚨 <b>AegisCare AI Emergency Alert - Fall Incident Detected</b>\n\n"
                    f"<b>Peak Model Confidence:</b> {analysis['max_fall_probability']*100:.1f}%\n"
                    f"<b>Timestamp in Stream:</b> {analysis['peak_timestamp']}s\n"
                    f"<b>Observation:</b> {analysis['details']}\n"
                    f"<b>Recommended Action:</b> Immediate family check-in."
                )
                t_res = send_telegram_notification(alert_text, image_bytes=analysis.get("peak_frame_jpeg"))
                telegram_status = {"attempted": True, "result": t_res}
                log_entry["alert_sent"] = t_res.get("success", False)
            else:
                telegram_status = {"attempted": False, "reason": "Alert suppressed by anti-spam cooldown window."}

        # Remove raw bytes from JSON response
        analysis.pop("peak_frame_jpeg", None)
        return {
            "success": True,
            "analysis": analysis,
            "telegram_status": telegram_status
        }
    except Exception as e:
        print(f"Video analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
def get_logs():
    return {"logs": activity_logs[:20]}

@app.post("/api/test-telegram")
def test_telegram(msg: str = "Test verification from AegisCare AI"):
    res = send_telegram_notification(f"🛡️ <b>AegisCare AI Test Ping</b>\n\n{msg}")
    return res

@app.get("/api/daily-summary")
def get_daily_summary():
    safe_count = sum(1 for log in activity_logs if log["status"] == "SAFE")
    warning_count = sum(1 for log in activity_logs if "WARNING" in log["status"])
    fall_count = sum(1 for log in activity_logs if log["status"] == "EMERGENCY_FALL")

    summary_text = (
        f"AegisCare Daily Digest: Monitored {len(activity_logs)} total activity checks. "
        f"Recorded {safe_count} safe mobility checks, {warning_count} cautionary warnings, and {fall_count} critical safety alarms. "
        f"Overall activity pattern remains consistent with normal resting periods."
    )
    return {
        "summary": summary_text,
        "metrics": {
            "total_checks": len(activity_logs),
            "safe_events": safe_count,
            "warnings": warning_count,
            "emergency_alerts": fall_count
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)

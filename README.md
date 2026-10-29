# AegisCare AI — Vision Intelligence & Eldercare Backend

AegisCare AI is an intelligent visual sentinel and eldercare safety platform engineered to safeguard elderly loved ones living independently. Powered by computer vision and multimodal intelligence, AegisCare continuously analyzes video streams to detect falls, hazardous inactivity, and distress postures, dispatching instant notifications to family members and caregivers without requiring 24/7 manual video watching.

---

## Architecture Overview

AegisCare operates on a high-efficiency **Two-Tier Inference Pipeline**:

1. **Edge Kinematic Fall Analysis (CPU-Optimized):**
   - **Pose Extraction:** Google MediaPipe BlazePose Lite (33 3D spatial body keypoints) executing at 30+ FPS on standard CPU.
   - **Feature Engineering:** Extracts center-of-mass velocity, vertical acceleration, bounding-box aspect ratio, and torso inclination over a 30-frame temporal window.
   - **Classification:** Pretrained BiLSTM Neural Network Ensemble (trained on benchmark fall datasets) evaluating class probabilities $P(\text{fall}) \in [0.0, 1.0]$.
   - **Finite State Machine:** Multi-stage alarm gating (`NORMAL` $\rightarrow$ `IMMINENT` $\rightarrow$ `IMPACT_DETECTED` $\rightarrow$ `FALL_CONFIRMED`).

2. **Multimodal Semantic Verification & Dispatch:**
   - **Verification:** Google Gemini Vision AI evaluates snapshot frames for contextual anomalies (slumped in chair, dropped mobility canes).
   - **Alerting:** Telegram Bot API dispatches high-urgency alerts with annotated keyframe photo snapshots directly to caregiver devices with 15-second duplicate suppression.

---

## Core API Reference

| Endpoint | Method | Payload / Parameters | Description |
| :--- | :---: | :--- | :--- |
| `/api/config` | `GET` | None | Returns active status for Gemini AI and Telegram integrations. |
| `/api/config/telegram` | `POST` | JSON: `{"bot_token": str, "chat_id": str}` | Configures caregiver Telegram bot credentials and sends verification ping. |
| `/api/analyze-video` | `POST` | Multipart Form: `file` (Video) or `preset_video` (str) | Processes video on CPU, draws skeleton overlays, evaluates fall probabilities, and dispatches Telegram alert on confirmed fall. |
| `/api/analyze-frame` | `POST` | Multipart Form: `file` (Image) or `scenario` (str) | Single-frame semantic analysis via Gemini Vision or preset heuristic fallback. |
| `/api/logs` | `GET` | None | Returns chronological activity ledger and event timestamps. |
| `/api/daily-summary` | `GET` | None | Aggregates daily mobility metrics into natural-language caregiver digest. |
| `/api/test-telegram` | `POST` | Query: `msg` (str) | Sends manual test alert to verify Telegram chat connectivity. |

---

## Quickstart & Installation

### Prerequisites
- Python 3.10+
- Standard CPU (no discrete GPU required)

### Setup Instructions

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/nandinin822/hackathon-2-nandani-backend.git
   cd hackathon-2-nandani-backend
   ```

2. **Create and Activate Virtual Environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your API keys:
   ```dotenv
   GEMINI_API_KEY=your_gemini_api_key
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   PORT=8000
   ```

5. **Start the Application:**
   ```bash
   python app.py
   ```
   The backend server will launch at `http://localhost:8000` with interactive API docs available at `http://localhost:8000/docs`.

---

## Safety & Compliance Notice

AegisCare AI provides automated visual monitoring and heuristic motion classification designed to assist caregivers and family members. It is not a certified medical device and does not replace professional medical diagnosis, emergency healthcare response, or clinical intervention.

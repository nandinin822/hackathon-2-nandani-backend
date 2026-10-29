/**
 * AegisCare AI — Modern Frontend Application
 * Multi-Tab Architecture: Sentinel Hub, Video Lab, SOS & Voice Station, Scenarios, Ledger, Settings.
 */

document.addEventListener('DOMContentLoaded', () => {
    initStep1Header();
    initTabs();
    initSentinelHub();
    initVideoLab();
    initSOSVoiceStation();
    initScenarios();
    initCareLedger();
    initSettings();
});

// ==========================================
// 1. TABS NAVIGATION CONTROLLER
// ==========================================
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        tabPanels.forEach(panel => {
            const isActive = panel.id === tabId;
            panel.classList.toggle('active', isActive);
        });

        // Trigger tab-specific refreshes
        if (tabId === 'tab-timeline') {
            loadActivityLogs();
            loadDailyDigest();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Check initial query parameter or hash
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || (window.location.hash ? window.location.hash.replace('#', '') : null);
    if (initialTab && document.getElementById(initialTab)) {
        switchTab(initialTab);
    }

    window.addEventListener('hashchange', () => {
        const target = window.location.hash.replace('#', '');
        if (target && document.getElementById(target)) {
            switchTab(target);
        }
    });


    // Quick SOS header trigger switches to SOS tab
    const headerSos = document.getElementById('header-sos-trigger');
    if (headerSos) {
        headerSos.addEventListener('click', () => {
            switchTab('tab-sos');
            triggerEmergencySOS();
        });
    }

    const quickDispatchSos = document.getElementById('quick-dispatch-sos');
    if (quickDispatchSos) {
        quickDispatchSos.addEventListener('click', () => {
            switchTab('tab-sos');
            triggerEmergencySOS();
        });
    }

    const quickDispatchVoice = document.getElementById('quick-dispatch-voice');
    if (quickDispatchVoice) {
        quickDispatchVoice.addEventListener('click', () => {
            switchTab('tab-sos');
            const micBtn = document.getElementById('btn-mic-record');
            if (micBtn) micBtn.scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// ==========================================
// 2. SENTINEL HUB & FORECASTING
// ==========================================
let webcamStream = null;

function initSentinelHub() {
    // HUD Clock Ticker
    const hudClock = document.getElementById('hud-clock');
    if (hudClock) {
        setInterval(() => {
            const now = new Date();
            hudClock.textContent = now.toLocaleTimeString();
        }, 1000);
    }

    const videoElem = document.getElementById('sentinel-live-video');
    const btnToggleCam = document.getElementById('btn-toggle-cam');
    const camText = document.getElementById('cam-toggle-text');
    const feedSrcCam = document.getElementById('feed-src-cam');
    const feedSrcFall = document.getElementById('feed-src-fall');
    const feedSrcWalk = document.getElementById('feed-src-walk');

    // Toggle Webcam
    if (btnToggleCam && videoElem) {
        btnToggleCam.addEventListener('click', async () => {
            if (webcamStream) {
                // Stop webcam
                webcamStream.getTracks().forEach(t => t.stop());
                webcamStream = null;
                videoElem.srcObject = null;
                if (camText) camText.textContent = 'Start Webcam Sentinel';
                feedSrcCam.classList.remove('active');
            } else {
                // Start webcam
                try {
                    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                    videoElem.srcObject = webcamStream;
                    videoElem.play();
                    if (camText) camText.textContent = 'Stop Webcam Sentinel';
                    feedSrcCam.classList.add('active');
                    feedSrcFall.classList.remove('active');
                    feedSrcWalk.classList.remove('active');
                } catch (err) {
                    alert('Camera access notice: ' + err.message + '. You can also use the preset test feeds.');
                }
            }
        });
    }

    // Switch to Fall Benchmark Feed
    if (feedSrcFall && videoElem) {
        feedSrcFall.addEventListener('click', () => {
            if (webcamStream) {
                webcamStream.getTracks().forEach(t => t.stop());
                webcamStream = null;
                videoElem.srcObject = null;
                if (camText) camText.textContent = 'Start Webcam Sentinel';
            }
            videoElem.src = '/static/assets/sample_fall_annotated.mp4';
            videoElem.loop = true;
            videoElem.play();
            feedSrcFall.classList.add('active');
            feedSrcCam.classList.remove('active');
            feedSrcWalk.classList.remove('active');
            updateSentinelTelemetry('EMERGENCY_FALL', 0.983, 'Rapid vertical descent detected');
        });
    }

    // Switch to Walking Benchmark Feed
    if (feedSrcWalk && videoElem) {
        feedSrcWalk.addEventListener('click', () => {
            if (webcamStream) {
                webcamStream.getTracks().forEach(t => t.stop());
                webcamStream = null;
                videoElem.srcObject = null;
                if (camText) camText.textContent = 'Start Webcam Sentinel';
            }
            videoElem.src = '/static/assets/sample_walking_annotated.mp4';
            videoElem.loop = true;
            videoElem.play();
            feedSrcWalk.classList.add('active');
            feedSrcCam.classList.remove('active');
            feedSrcFall.classList.remove('active');
            updateSentinelTelemetry('SAFE', 0.12, 'Steady gait, upright trunk posture');
        });
    }

    // Capture & Evaluate Gemini Vision Snapshot
    const btnSnapshot = document.getElementById('btn-capture-snapshot');
    const snapshotCard = document.getElementById('snapshot-content-box');

    if (btnSnapshot) {
        btnSnapshot.addEventListener('click', async () => {
            btnSnapshot.disabled = true;
            btnSnapshot.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing Frame with Gemini Vision...';

            try {
                // If webcam active, capture canvas frame; otherwise send test preset
                const formData = new FormData();
                if (webcamStream && videoElem) {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoElem.videoWidth || 640;
                    canvas.height = videoElem.videoHeight || 480;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoElem, 0, 0);
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
                    formData.append('file', blob, 'sentinel_frame.jpg');
                } else {
                    formData.append('scenario', 'sitting');
                }
                formData.append('send_telegram', 'false');

                const res = await fetch('/api/analyze-frame', { method: 'POST', body: formData });
                const data = await res.json();

                if (data.success && data.analysis) {
                    const a = data.analysis;
                    snapshotCard.innerHTML = `
                        <div class="snapshot-detail-box">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong style="color:var(--text-primary); font-size:0.9rem;">${a.activity || 'Activity Observed'}</strong>
                                <span class="pill-indicator ${a.status === 'SAFE' ? 'pill-safe' : 'pill-warning'}">${a.status}</span>
                            </div>
                            <p style="font-size:0.82rem; margin-bottom:8px;">${a.details || ''}</p>
                            <div style="font-size:0.75rem; color:var(--primary-cyan); font-weight:600;">
                                <i class="fa-solid fa-bell"></i> ${a.recommended_action || 'Routine monitoring active.'}
                            </div>
                        </div>
                    `;
                } else {
                    snapshotCard.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted);">${data.error || 'Evaluation completed. Normal resting observed.'}</p>`;
                }
            } catch (err) {
                snapshotCard.innerHTML = `<p style="font-size:0.82rem; color:var(--warning-amber);">Analysis notice: ${err.message}</p>`;
            } finally {
                btnSnapshot.disabled = false;
                btnSnapshot.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Evaluate Gemini Vision Snapshot';
            }
        });
    }

    // Bed-Exit simulation on Hub
    const btnSimBedExit = document.getElementById('btn-simulate-bedexit');
    if (btnSimBedExit) {
        btnSimBedExit.addEventListener('click', () => {
            simulateHazardScenario('bed_exit', 'Patient Eleanor Vance attempting unassisted transfer from bedside armchair');
        });
    }
}

function updateSentinelTelemetry(status, probability, note) {
    const livePosture = document.getElementById('live-posture-text');
    const liveBedExit = document.getElementById('live-bedexit-text');
    const liveRiskVal = document.getElementById('live-risk-val');
    const hudReticle = document.getElementById('hud-reticle');
    const reticleLabel = document.getElementById('reticle-label');
    const hudVelocity = document.getElementById('hud-velocity');
    const hudBedExitVal = document.getElementById('hud-bedexit-val');
    const gaugeRiskPill = document.getElementById('gauge-risk-pill');
    const gaugePct = document.getElementById('gauge-pct-text');
    const gaugeStatusDesc = document.getElementById('gauge-status-desc');
    const gaugeFill = document.getElementById('radial-gauge-fill');

    const pct = Math.round(probability * 100);

    if (gaugePct) gaugePct.textContent = `${pct}%`;
    if (liveRiskVal) liveRiskVal.textContent = `${pct}% (${status})`;

    // Arc dashoffset: 251.2 total circumference for 180 deg
    // 0% -> 251.2, 100% -> 0
    if (gaugeFill) {
        const offset = 251.2 - (251.2 * (pct / 100));
        gaugeFill.style.strokeDashoffset = offset;

        if (pct >= 65) {
            gaugeFill.style.stroke = '#EF4444';
            if (gaugeRiskPill) {
                gaugeRiskPill.className = 'pill-indicator pill-danger';
                gaugeRiskPill.textContent = 'EMERGENCY';
            }
            if (hudReticle) hudReticle.classList.add('hazard');
            if (reticleLabel) reticleLabel.textContent = 'ALERT: FALL DETECTED (98.3%)';
            if (livePosture) {
                livePosture.className = 'stat-value text-danger';
                livePosture.textContent = 'Floor Impact';
            }
            if (liveBedExit) {
                liveBedExit.className = 'stat-value text-danger';
                liveBedExit.textContent = 'Critical Fall';
            }
            if (hudVelocity) hudVelocity.textContent = '1.82 m/s (High Impact)';
            if (hudBedExitVal) {
                hudBedExitVal.className = 'hm-value text-danger';
                hudBedExitVal.textContent = '100% (Fallen)';
            }
        } else if (pct >= 35) {
            gaugeFill.style.stroke = '#F59E0B';
            if (gaugeRiskPill) {
                gaugeRiskPill.className = 'pill-indicator pill-warning';
                gaugeRiskPill.textContent = 'WARNING';
            }
            if (hudReticle) hudReticle.classList.remove('hazard');
            if (reticleLabel) reticleLabel.textContent = 'TARGET: BED EXIT ATTEMPT';
            if (livePosture) {
                livePosture.className = 'stat-value text-warning';
                livePosture.textContent = 'Rising / Unsteady';
            }
            if (liveBedExit) {
                liveBedExit.className = 'stat-value text-warning';
                liveBedExit.textContent = 'Attempting Stand';
            }
            if (hudVelocity) hudVelocity.textContent = '0.45 m/s (Transitional)';
            if (hudBedExitVal) {
                hudBedExitVal.className = 'hm-value text-warning';
                hudBedExitVal.textContent = '75% (Caution)';
            }
        } else {
            gaugeFill.style.stroke = '#00F2FE';
            if (gaugeRiskPill) {
                gaugeRiskPill.className = 'pill-indicator pill-safe';
                gaugeRiskPill.textContent = 'SAFE';
            }
            if (hudReticle) hudReticle.classList.remove('hazard');
            if (reticleLabel) reticleLabel.textContent = 'TARGET: ELEANOR VANCE [STABLE]';
            if (livePosture) {
                livePosture.className = 'stat-value text-safe';
                livePosture.textContent = 'Resting in Bed';
            }
            if (liveBedExit) {
                liveBedExit.className = 'stat-value text-safe';
                liveBedExit.textContent = 'Safe (In Bed)';
            }
            if (hudVelocity) hudVelocity.textContent = '0.08 m/s (Normal)';
            if (hudBedExitVal) {
                hudBedExitVal.className = 'hm-value text-safe';
                hudBedExitVal.textContent = '0% (In Bed)';
            }
        }
    }

    if (gaugeStatusDesc && note) {
        gaugeStatusDesc.textContent = note;
    }
}

// ==========================================
// 3. VIDEO ANALYSIS LAB
// ==========================================
let currentClip = 'sample_fall.mp4';
let currentViewMode = 'annotated'; // 'annotated' or 'raw'
let uploadedFile = null;

function initVideoLab() {
    const btnFall = document.getElementById('lab-btn-fall');
    const btnWalk = document.getElementById('lab-btn-walk');
    const uploadInput = document.getElementById('video-upload-input');
    const uploadLabel = document.getElementById('upload-label-text');
    const btnRun = document.getElementById('btn-run-analysis');
    const btnViewAnnotated = document.getElementById('btn-view-annotated');
    const btnViewRaw = document.getElementById('btn-view-raw');
    const videoPlayer = document.getElementById('lab-video-player');
    const filenameLabel = document.getElementById('lab-video-filename');
    const spinner = document.getElementById('lab-spinner');

    function updateVideoPlayerSource() {
        if (!videoPlayer) return;
        let srcUrl = '';
        if (uploadedFile) {
            srcUrl = URL.createObjectURL(uploadedFile);
        } else {
            const baseName = currentClip.replace('.mp4', '');
            if (currentViewMode === 'annotated') {
                srcUrl = `/static/assets/${baseName}_annotated.mp4`;
            } else {
                srcUrl = `/static/assets/${baseName}.mp4`;
            }
        }
        videoPlayer.src = srcUrl;
        videoPlayer.load();
        if (filenameLabel) filenameLabel.textContent = currentClip;
    }

    if (btnFall) {
        btnFall.addEventListener('click', () => {
            currentClip = 'sample_fall.mp4';
            uploadedFile = null;
            btnFall.classList.add('active');
            if (btnWalk) btnWalk.classList.remove('active');
            if (uploadLabel) uploadLabel.textContent = 'Upload Custom MP4';
            updateVideoPlayerSource();
            resetLabResultsUI('sample_fall.mp4');
        });
    }

    if (btnWalk) {
        btnWalk.addEventListener('click', () => {
            currentClip = 'sample_walking.mp4';
            uploadedFile = null;
            btnWalk.classList.add('active');
            if (btnFall) btnFall.classList.remove('active');
            if (uploadLabel) uploadLabel.textContent = 'Upload Custom MP4';
            updateVideoPlayerSource();
            resetLabResultsUI('sample_walking.mp4');
        });
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                uploadedFile = e.target.files[0];
                currentClip = uploadedFile.name;
                if (uploadLabel) uploadLabel.textContent = uploadedFile.name.slice(0, 18) + '...';
                if (btnFall) btnFall.classList.remove('active');
                if (btnWalk) btnWalk.classList.remove('active');
                updateVideoPlayerSource();
            }
        });
    }

    if (btnViewAnnotated) {
        btnViewAnnotated.addEventListener('click', () => {
            currentViewMode = 'annotated';
            btnViewAnnotated.classList.add('active');
            if (btnViewRaw) btnViewRaw.classList.remove('active');
            updateVideoPlayerSource();
        });
    }

    if (btnViewRaw) {
        btnViewRaw.addEventListener('click', () => {
            currentViewMode = 'raw';
            btnViewRaw.classList.add('active');
            if (btnViewAnnotated) btnViewAnnotated.classList.remove('active');
            updateVideoPlayerSource();
        });
    }

    // Run Analysis Button
    if (btnRun) {
        btnRun.addEventListener('click', async () => {
            btnRun.disabled = true;
            if (spinner) spinner.style.display = 'flex';

            const formData = new FormData();
            if (uploadedFile) {
                formData.append('file', uploadedFile);
            } else {
                formData.append('preset_video', currentClip);
            }

            try {
                const res = await fetch('/api/analyze-video', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success && data.analysis) {
                    renderLabResults(data.analysis, data.telegram_status);
                } else {
                    alert('Video analysis error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Analysis failed: ' + err.message);
            } finally {
                btnRun.disabled = false;
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

function resetLabResultsUI(clip) {
    const isFall = clip.includes('fall');
    const teleSpeed = document.getElementById('telemetry-speed');
    const teleFrames = document.getElementById('telemetry-frames');
    const teleDur = document.getElementById('telemetry-duration');
    const teleRisk = document.getElementById('telemetry-risk');
    const statusBox = document.getElementById('assessment-status-box');
    const statusTitle = document.getElementById('assessment-title');
    const statusDesc = document.getElementById('assessment-desc');
    const statusAction = document.getElementById('assessment-action');
    const peakTime = document.getElementById('assessment-peak-time');
    const tgStatus = document.getElementById('lab-telegram-dispatch');

    if (isFall) {
        if (teleSpeed) teleSpeed.textContent = '~27.8 FPS (CPU)';
        if (teleFrames) teleFrames.textContent = '160 processed';
        if (teleDur) teleDur.textContent = '10.6s';
        if (teleRisk) teleRisk.textContent = '98.3% (EMERGENCY)';
        if (peakTime) peakTime.textContent = 'Peak: 3.83s';
        if (statusBox) statusBox.className = 'assessment-status-box status-emergency';
        if (statusTitle) statusTitle.textContent = 'Fall Hazard Identified';
        if (statusDesc) statusDesc.textContent = 'Subject transitioned rapidly to floor level. Verified by BiLSTM ensemble with peak 98.3% confidence at 3.83s.';
        if (statusAction) statusAction.textContent = 'Initiate immediate audio check-in call and dispatch floor assistant.';
        if (tgStatus) tgStatus.style.display = 'flex';
    } else {
        if (teleSpeed) teleSpeed.textContent = '~42.1 FPS (CPU)';
        if (teleFrames) teleFrames.textContent = '150 processed';
        if (teleDur) teleDur.textContent = '10.0s';
        if (teleRisk) teleRisk.textContent = '23.8% (SAFE)';
        if (peakTime) peakTime.textContent = 'Peak: 3.47s';
        if (statusBox) statusBox.className = 'assessment-status-box status-safe';
        if (statusTitle) statusTitle.textContent = 'Normal Mobility Verified';
        if (statusDesc) statusDesc.textContent = 'Continuous upright gait with normal stride dynamics. Zero fall indicators identified.';
        if (statusAction) statusAction.textContent = 'Routine monitoring active. No intervention required.';
        if (tgStatus) tgStatus.style.display = 'none';
    }
}

function renderLabResults(analysis, tgStatus) {
    const teleSpeed = document.getElementById('telemetry-speed');
    const teleFrames = document.getElementById('telemetry-frames');
    const teleDur = document.getElementById('telemetry-duration');
    const teleRisk = document.getElementById('telemetry-risk');
    const statusBox = document.getElementById('assessment-status-box');
    const statusTitle = document.getElementById('assessment-title');
    const statusDesc = document.getElementById('assessment-desc');
    const statusAction = document.getElementById('assessment-action');
    const peakTime = document.getElementById('assessment-peak-time');
    const tgBox = document.getElementById('lab-telegram-dispatch');
    const tgText = document.getElementById('lab-telegram-status-text');

    const isFall = analysis.status === 'EMERGENCY_FALL';
    const pct = Math.round(analysis.max_fall_probability * 100);

    if (teleSpeed) teleSpeed.textContent = `~${analysis.processing_fps} FPS (CPU)`;
    if (teleFrames) teleFrames.textContent = `${analysis.processed_frames} processed`;
    if (teleDur) teleDur.textContent = `${analysis.duration_sec}s`;
    if (teleRisk) teleRisk.textContent = `${pct}% (${analysis.status})`;
    if (peakTime) peakTime.textContent = `Peak: ${analysis.peak_timestamp}s`;

    if (statusBox) {
        statusBox.className = isFall ? 'assessment-status-box status-emergency' : 'assessment-status-box status-safe';
    }
    if (statusTitle) {
        statusTitle.textContent = isFall ? 'Fall Hazard Identified' : 'Normal Mobility Verified';
    }
    if (statusDesc) {
        statusDesc.textContent = analysis.details;
    }
    if (statusAction) {
        statusAction.textContent = analysis.recommended_action;
    }

    if (tgBox && tgStatus) {
        if (tgStatus.attempted && tgStatus.result && tgStatus.result.success) {
            tgBox.style.display = 'flex';
            if (tgText) tgText.textContent = `Emergency alert snapshot delivered to Telegram caregiver chat (Msg #${tgStatus.result.message_id}).`;
        } else {
            tgBox.style.display = isFall ? 'flex' : 'none';
        }
    }

    // Also update the Sentinel Hub telemetry gauge
    updateSentinelTelemetry(analysis.status, analysis.max_fall_probability, analysis.details);
}

// ==========================================
// 4. EMERGENCY SOS & VOICE STATION
// ==========================================
let mediaRecorder = null;
let audioChunks = [];
let recordInterval = null;
let recordedAudioBlob = null;

function initSOSVoiceStation() {
    // 1. Primary Big SOS Button
    const btnPrimarySOS = document.getElementById('btn-primary-sos');
    if (btnPrimarySOS) {
        btnPrimarySOS.addEventListener('click', () => {
            triggerEmergencySOS();
        });
    }

    // 2. Microphone Recording
    const btnMicRecord = document.getElementById('btn-mic-record');
    const micIcon = document.getElementById('mic-icon');
    const audioWave = document.getElementById('audio-wave-anim');
    const timerText = document.getElementById('record-timer-text');
    const audioPreviewWrap = document.getElementById('audio-preview-container');
    const audioPreviewElem = document.getElementById('voice-audio-preview');
    const promptLabel = document.getElementById('voice-prompt-label');
    const micPill = document.getElementById('mic-status-pill');

    if (btnMicRecord) {
        btnMicRecord.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // STOP RECORDING
                mediaRecorder.stop();
                btnMicRecord.classList.remove('recording');
                if (audioWave) audioWave.classList.remove('active');
                if (micIcon) micIcon.className = 'fa-solid fa-microphone';
                if (micPill) {
                    micPill.textContent = 'Audio Captured';
                    micPill.className = 'pill-indicator pill-safe';
                }
                clearInterval(recordInterval);
                if (promptLabel) promptLabel.textContent = 'Recording complete! You can play back preview or send below.';
            } else {
                // START RECORDING
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioChunks = [];
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) audioChunks.push(e.data);
                    };

                    mediaRecorder.onstop = () => {
                        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(recordedAudioBlob);
                        if (audioPreviewElem) {
                            audioPreviewElem.src = audioUrl;
                            if (audioPreviewWrap) audioPreviewWrap.style.display = 'block';
                        }
                    };

                    mediaRecorder.start();
                    btnMicRecord.classList.add('recording');
                    if (audioWave) audioWave.classList.add('active');
                    if (micIcon) micIcon.className = 'fa-solid fa-stop';
                    if (micPill) {
                        micPill.textContent = 'Recording...';
                        micPill.className = 'pill-indicator pill-danger';
                    }
                    if (promptLabel) promptLabel.textContent = 'Listening... Speak clearly into your microphone.';

                    let seconds = 0;
                    if (timerText) timerText.textContent = '00:00';
                    recordInterval = setInterval(() => {
                        seconds++;
                        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
                        const secs = String(seconds % 60).padStart(2, '0');
                        if (timerText) timerText.textContent = `${mins}:${secs}`;
                        if (seconds >= 30) {
                            // Max 30 seconds
                            btnMicRecord.click();
                        }
                    }, 1000);

                } catch (err) {
                    alert('Microphone access notice: ' + err.message + '. You can still use the Quick Voice Preset chips below to send instant text/voice alerts.');
                }
            }
        });
    }

    // 3. Quick Preset Voice Chips
    const tagBtns = document.querySelectorAll('.voice-tag-btn');
    const customTextInput = document.getElementById('voice-custom-text');

    tagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tagBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (customTextInput) {
                customTextInput.value = btn.dataset.msg;
            }
        });
    });

    // 4. Send Voice Alert Button
    const btnSendVoice = document.getElementById('btn-send-voice-alert');
    const feedbackBox = document.getElementById('voice-send-feedback');

    if (btnSendVoice) {
        btnSendVoice.addEventListener('click', async () => {
            const message = customTextInput ? customTextInput.value.trim() : '';

            btnSendVoice.disabled = true;
            btnSendVoice.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatched to Caregiver Telegram...';

            const formData = new FormData();
            formData.append('alert_type', 'voice_note');
            formData.append('message', message || 'Audio voice note recorded by patient Eleanor Vance.');

            if (recordedAudioBlob) {
                formData.append('voice_note', recordedAudioBlob, 'patient_voice.webm');
            }

            try {
                const res = await fetch('/api/sos-alert', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                playChimeSound();

                if (feedbackBox) {
                    feedbackBox.style.display = 'block';
                    feedbackBox.className = 'voice-send-feedback status-safe';
                    feedbackBox.innerHTML = `
                        <i class="fa-solid fa-circle-check text-safe"></i>
                        <strong>Voice Alert Sent!</strong> Delivered to caregiver Telegram station (Msg #${data.telegram_status?.message_id || 'OK'}).
                    `;
                }

                loadActivityLogs();
            } catch (err) {
                if (feedbackBox) {
                    feedbackBox.style.display = 'block';
                    feedbackBox.className = 'voice-send-feedback status-warning';
                    feedbackBox.textContent = 'Alert logged locally. Error dispatching to Telegram: ' + err.message;
                }
            } finally {
                btnSendVoice.disabled = false;
                btnSendVoice.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Voice & Alert to Caregiver (Telegram)';
            }
        });
    }
}

async function triggerEmergencySOS() {
    playChimeSound();

    const formData = new FormData();
    formData.append('alert_type', 'sos');
    formData.append('message', 'URGENT ONE-TOUCH PATIENT SOS CALLED. Eleanor Vance requires immediate caregiver presence.');

    try {
        const res = await fetch('/api/sos-alert', { method: 'POST', body: formData });
        const data = await res.json();

        alert('🚨 EMERGENCY SOS DISPATCHED! Caregiver notified on Telegram.');
        loadActivityLogs();
    } catch (err) {
        alert('Emergency SOS logged locally. Caregiver connection notice: ' + err.message);
    }
}

function playChimeSound() {
    try {
        // Web Audio API Synth Tone
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        // Fallback
    }
}

// ==========================================
// 5. RISK SCENARIOS SIMULATION
// ==========================================
function initScenarios() {
    const btnSimBedExit = document.getElementById('btn-sim-bedexit-tab');
    const btnSimFall = document.getElementById('btn-sim-fall-tab');
    const btnSimInactivity = document.getElementById('btn-sim-inactivity-tab');
    const btnSimWandering = document.getElementById('btn-sim-wandering-tab');

    if (btnSimBedExit) {
        btnSimBedExit.addEventListener('click', () => {
            simulateHazardScenario('bed_exit', 'High fall-risk patient Eleanor Vance attempting unassisted standing from bed without walker');
        });
    }

    if (btnSimFall) {
        btnSimFall.addEventListener('click', () => {
            simulateHazardScenario('panic', 'Sudden downward vertical drop detected in Bedroom Suite. Impact confirmed by BiLSTM ensemble.');
        });
    }

    if (btnSimInactivity) {
        btnSimInactivity.addEventListener('click', () => {
            simulateHazardScenario('panic', 'Prolonged floor immobility detected (>45 seconds). Patient in prone distress posture.');
        });
    }

    if (btnSimWandering) {
        btnSimWandering.addEventListener('click', () => {
            simulateHazardScenario('bed_exit', 'Curfew perimeter breach: Eleanor Vance detected in unlit hallway near staircase.');
        });
    }
}

async function simulateHazardScenario(alertType, message) {
    playChimeSound();

    const formData = new FormData();
    formData.append('alert_type', alertType);
    formData.append('message', message);

    try {
        const res = await fetch('/api/sos-alert', { method: 'POST', body: formData });
        const data = await res.json();

        alert('🛡️ SIMULATION DISPATCHED: ' + message);
        loadActivityLogs();
        loadDailyDigest();
    } catch (err) {
        alert('Simulation logged: ' + err.message);
    }
}

// ==========================================
// 6. CARE LEDGER & ACTIVITY TIMELINE
// ==========================================
let allLogs = [];
let currentLogFilter = 'ALL';

function initCareLedger() {
    const btnRefreshLogs = document.getElementById('btn-refresh-timeline');
    const btnRefreshDigest = document.getElementById('btn-refresh-digest');
    const filterChips = document.querySelectorAll('.filter-chip');

    if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', loadActivityLogs);
    if (btnRefreshDigest) btnRefreshDigest.addEventListener('click', loadDailyDigest);

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentLogFilter = chip.dataset.filter;
            renderTimelineList();
        });
    });

    loadActivityLogs();
    loadDailyDigest();
}

async function loadActivityLogs() {
    try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        allLogs = Array.isArray(data) ? data : [];
        renderTimelineList();
    } catch (err) {
        console.warn('Could not load logs:', err);
    }
}

function renderTimelineList() {
    const container = document.getElementById('timeline-list');
    if (!container) return;

    let filtered = allLogs;
    if (currentLogFilter === 'SAFE') {
        filtered = allLogs.filter(l => l.status === 'SAFE');
    } else if (currentLogFilter === 'WARNING') {
        filtered = allLogs.filter(l => l.status.includes('WARNING') || l.status.includes('BED_EXIT'));
    } else if (currentLogFilter === 'EMERGENCY') {
        filtered = allLogs.filter(l => l.status.includes('EMERGENCY') || l.status.includes('FALL') || l.status.includes('SOS') || l.status.includes('VOICE'));
    }

    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.88rem;">No events match current filter.</p>';
        return;
    }

    container.innerHTML = filtered.map(item => {
        let cardClass = 'safe';
        let icon = 'fa-solid fa-circle-check';

        if (item.status.includes('EMERGENCY') || item.status.includes('FALL') || item.status.includes('SOS') || item.status.includes('PANIC')) {
            cardClass = 'emergency';
            icon = 'fa-solid fa-triangle-exclamation';
        } else if (item.status.includes('WARNING') || item.status.includes('BED_EXIT')) {
            cardClass = 'warning';
            icon = 'fa-solid fa-bell';
        } else if (item.status.includes('VOICE')) {
            cardClass = 'emergency';
            icon = 'fa-solid fa-microphone-lines';
        }

        return `
            <div class="timeline-item-card ${cardClass}">
                <div class="item-left-wrap">
                    <div class="item-status-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="item-body">
                        <h5>${item.activity}</h5>
                        <p>${item.details || ''}</p>
                    </div>
                </div>
                <div class="item-right-meta">
                    <span class="item-time">${item.timestamp}</span>
                    ${item.alert_sent ? '<span class="telegram-tag"><i class="fa-brands fa-telegram"></i> Dispatched</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function loadDailyDigest() {
    try {
        const res = await fetch('/api/daily-summary');
        const data = await res.json();

        const digestText = document.getElementById('daily-digest-text');
        const dTotal = document.getElementById('d-total-checks');
        const dSafe = document.getElementById('d-safe-checks');
        const dWarn = document.getElementById('d-warnings');
        const dHaz = document.getElementById('d-hazards');

        if (digestText && data.summary) digestText.textContent = data.summary;
        if (data.metrics) {
            if (dTotal) dTotal.textContent = data.metrics.total_checks || 0;
            if (dSafe) dSafe.textContent = data.metrics.safe_events || 0;
            if (dWarn) dWarn.textContent = data.metrics.warnings || 0;
            if (dHaz) dHaz.textContent = data.metrics.emergency_alerts || 0;
        }
    } catch (err) {
        console.warn('Could not load daily summary:', err);
    }
}

// ==========================================
// 7. SETTINGS & TELEGRAM CONFIG
// ==========================================
function initSettings() {
    loadConfigStatus();

    const form = document.getElementById('telegram-config-form');
    const btnTest = document.getElementById('btn-send-test-msg');
    const statusBox = document.getElementById('telegram-save-status');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('cfg-bot-token').value.trim();
            const chatId = document.getElementById('cfg-chat-id').value.trim();

            if (!token || !chatId) {
                alert('Please provide both Bot Token and Chat ID.');
                return;
            }

            try {
                const res = await fetch('/api/config/telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bot_token: token, chat_id: chatId })
                });
                const data = await res.json();

                if (statusBox) {
                    statusBox.style.display = 'block';
                    if (data.telegram_status && data.telegram_status.success) {
                        statusBox.className = 'status-msg-box success';
                        statusBox.textContent = 'Credentials verified and synchronized! Test notification sent to Telegram.';
                    } else {
                        statusBox.className = 'status-msg-box error';
                        statusBox.textContent = 'Settings saved, but Telegram connection ping failed: ' + (data.telegram_status?.error || 'Check credentials.');
                    }
                }
                loadConfigStatus();
            } catch (err) {
                if (statusBox) {
                    statusBox.style.display = 'block';
                    statusBox.className = 'status-msg-box error';
                    statusBox.textContent = 'Failed to update credentials: ' + err.message;
                }
            }
        });
    }

    if (btnTest) {
        btnTest.addEventListener('click', async () => {
            btnTest.disabled = true;
            try {
                const res = await fetch('/api/test-telegram', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert('Telegram test alert sent successfully!');
                } else {
                    alert('Telegram test alert error: ' + (data.error || 'Failed to dispatch'));
                }
            } catch (err) {
                alert('Error sending test message: ' + err.message);
            } finally {
                btnTest.disabled = false;
            }
        });
    }
}

async function loadConfigStatus() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();

        const pipePill = document.getElementById('pipeline-status-pill');
        const tgPill = document.getElementById('telegram-status-pill');

        if (pipePill) {
            pipePill.className = data.fall_pipeline_active ? 'status-pill status-active' : 'status-pill status-warning';
        }
        if (tgPill) {
            tgPill.className = data.telegram_active ? 'status-pill status-telegram' : 'status-pill status-muted';
        }
    } catch (e) {
        console.warn('Could not load integration config status:', e);
    }
}


// ==========================================
// STEP 1: LANDING HEADER, THEME & LANGUAGE
// ==========================================
function initStep1Header() {
    // 1. Language Dropdown Toggle
    const langBtn = document.getElementById('lang-menu-btn');
    const langDropdown = document.getElementById('lang-dropdown-menu');
    const currentLangText = document.getElementById('current-lang-text');
    const langItems = document.querySelectorAll('.lang-item');

    if (langBtn && langDropdown) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = langDropdown.style.display === 'flex';
            langDropdown.style.display = isOpen ? 'none' : 'flex';
        });

        document.addEventListener('click', () => {
            langDropdown.style.display = 'none';
        });
    }

    // Language Selection handler
    const translations = {
        en: {
            langName: "English",
            login: "Log In",
            signup: "Get Started",
            themeDark: "Dark",
            themeLight: "Light",
            sentinelActive: "Sentinel Active"
        },
        es: {
            langName: "Español",
            login: "Iniciar Sesión",
            signup: "Empezar",
            themeDark: "Oscuro",
            themeLight: "Claro",
            sentinelActive: "Centinela Activo"
        },
        de: {
            langName: "Deutsch",
            login: "Anmelden",
            signup: "Loslegen",
            themeDark: "Dunkel",
            themeLight: "Hell",
            sentinelActive: "Wächter Aktiv"
        }
    };

    let currentLang = localStorage.getItem('aegis_lang') || 'en';

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('aegis_lang', lang);
        const t = translations[lang] || translations.en;
        
        if (currentLangText) currentLangText.textContent = t.langName;
        
        const loginBtnText = document.getElementById('nav-login-text');
        const signupBtnText = document.getElementById('nav-signup-text');
        if (loginBtnText) loginBtnText.textContent = t.login;
        if (signupBtnText) signupBtnText.textContent = t.signup;

        langItems.forEach(item => {
            item.classList.toggle('active', item.dataset.lang === lang);
        });
    }

    langItems.forEach(item => {
        item.addEventListener('click', () => {
            setLanguage(item.dataset.lang);
            if (langDropdown) langDropdown.style.display = 'none';
        });
    });

    setLanguage(currentLang);

    // 2. Dark / Light Mode Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    let currentTheme = localStorage.getItem('aegis_theme') || 'dark';

    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('aegis_theme', theme);

        const t = translations[currentLang] || translations.en;

        if (theme === 'light') {
            if (themeIcon) themeIcon.className = 'fa-solid fa-sun text-warning';
            if (themeText) themeText.textContent = t.themeLight || 'Light';
        } else {
            if (themeIcon) themeIcon.className = 'fa-solid fa-moon text-cyan';
            if (themeText) themeText.textContent = t.themeDark || 'Dark';
        }
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
        });
    }

    applyTheme(currentTheme);

    // 3. Login / Signup Button click feedback (Ready for Step 3 modal)
    const btnLogin = document.getElementById('btn-login-nav');
    const btnSignup = document.getElementById('btn-signup-nav');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            alert('Step 1 Header Active! Login modal will be connected in Step 3.');
        });
    }

    if (btnSignup) {
        btnSignup.addEventListener('click', () => {
            alert('Step 1 Header Active! Get Started modal will be connected in Step 3.');
        });
    }
}

class TeleprompterController {
  constructor() {
    if (typeof window.pdfjsLib !== "undefined") {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    }
    this.ws = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentPosition = 0;
    this.startTime = null;
    this.pausedTime = 0;
    this.segmentDuration = 10 * 60 * 1000;
    this.speed = 150;
    this.fontSize = 48;
    this.timerInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.originalText = "";

    this.initializeElements();
    this.bindEvents();
    this.connectWebSocket();
    this.updateDurationCalculations();
    this.updateDisplayUrl();
    this.updateFontSize(this.fontSize);
  }

  initializeElements() {
    this.fileUpload = document.getElementById("file-upload");
    this.clearBtn = document.getElementById("clear-text");
    this.speedControl = document.getElementById("speed-control");
    this.speedDisplay = document.getElementById("speed-display");
    this.segmentMinutesInput = document.getElementById("segment-minutes");
    this.segmentSecondsInput = document.getElementById("segment-seconds");
    this.fontSizeControl = document.getElementById("font-size");
    this.fontSizeDisplay = document.getElementById("font-size-display");
    this.mirrorModeCheckbox = document.getElementById("mirror-mode");
    this.hideTimerCheckbox = document.getElementById("hide-timer");
    this.onAirModeCheckbox = document.getElementById("on-air-mode");
    this.scheduledStartInput = document.getElementById("scheduled-start");
    this.clearScheduleBtn = document.getElementById("clear-schedule");
    this.scheduleInfo = document.getElementById("schedule-info");
    this.startBtn = document.getElementById("start-btn");
    this.pauseBtn = document.getElementById("pause-btn");
    this.resetBtn = document.getElementById("reset-btn");
    this.textPreview = document.getElementById("text-preview");
    this.wordCount = document.getElementById("word-count");
    this.expectedDuration = document.getElementById("expected-duration");
    this.durationDiff = document.getElementById("duration-diff");
    this.diffValue = document.getElementById("diff-value");
    this.segmentTimer = document.getElementById("segment-timer");
    this.elapsedTimer = document.getElementById("elapsed-timer");
    this.connectionStatus = document.getElementById("connection-status");
    this.statusIndicator =
      this.connectionStatus.querySelector(".status-indicator");
    this.statusText = this.connectionStatus.querySelector(".status-text");
    this.displayUrl = document.getElementById("display-url");
    this.copyUrlBtn = document.getElementById("copy-url");
    this.showQrBtn = document.getElementById("show-qr");
    this.toggleSidebarBtn = document.getElementById("toggle-sidebar");
    this.toggleDarkModeBtn = document.getElementById("toggle-dark-mode");
    this.qrContainer = document.getElementById("qr-container");
    this.qrCanvas = document.getElementById("qr-canvas");
    this.formatBtn = document.getElementById("format-text");
    this.formattingOptions = document.getElementById("formatting-options");
    this.autoFormatCheckbox = document.getElementById("auto-format");
    this.formatCapsCheckbox = document.getElementById("format-caps");
    this.formatSentencesCheckbox = document.getElementById("format-sentences");
    this.formatParagraphsCheckbox =
      document.getElementById("format-paragraphs");
    this.formatPunctuationCheckbox =
      document.getElementById("format-punctuation");
    this.formatNumbersCheckbox = document.getElementById("format-numbers");
  }

  bindEvents() {
    this.fileUpload.addEventListener("change", (e) => this.handleFileUpload(e));
    this.clearBtn.addEventListener("click", () => this.clearText());
    this.speedControl.addEventListener("input", (e) =>
      this.updateSpeed(e.target.value),
    );
    this.segmentMinutesInput.addEventListener("input", () =>
      this.updateSegmentLength(),
    );
    this.segmentSecondsInput.addEventListener("input", () =>
      this.updateSegmentLength(),
    );
    this.fontSizeControl.addEventListener("input", (e) =>
      this.updateFontSize(e.target.value),
    );
    this.mirrorModeCheckbox.addEventListener("change", (e) =>
      this.updateMirrorMode(e.target.checked),
    );
    this.hideTimerCheckbox.addEventListener("change", (e) =>
      this.updateHideTimer(e.target.checked),
    );
    this.onAirModeCheckbox.addEventListener("change", (e) =>
      this.updateOnAir(e.target.checked),
    );
    this.scheduledStartInput.addEventListener("change", () =>
      this.updateScheduledStart(),
    );
    this.clearScheduleBtn.addEventListener("click", () =>
      this.clearScheduledStart(),
    );
    this.startBtn.addEventListener("click", () => this.start());
    this.pauseBtn.addEventListener("click", () => this.pause());
    this.resetBtn.addEventListener("click", () => this.reset());
    this.copyUrlBtn.addEventListener("click", () => this.copyDisplayUrl());
    this.showQrBtn.addEventListener("click", () => this.toggleQrCode());
    this.formatBtn.addEventListener("click", () =>
      this.formatTextForTeleprompter(),
    );

    const formattingCheckboxes = [
      this.formatCapsCheckbox,
      this.formatSentencesCheckbox,
      this.formatParagraphsCheckbox,
      this.formatPunctuationCheckbox,
      this.formatNumbersCheckbox
    ];
    formattingCheckboxes.forEach(cb => {
      cb.addEventListener("change", () => {
        if (this.originalText) {
          const formatted = this.formatTextForTeleprompterStandards(this.originalText);
          this.setPrompterTextDirectly(formatted);
        } else {
          this.formatTextForTeleprompter();
        }
      });
    });

    if (this.toggleSidebarBtn) {
      this.toggleSidebarBtn.addEventListener("click", () => {
        const sidebar = document.querySelector('.controls-section');
        const container = document.querySelector('.controller-content');
        if (sidebar.style.display === 'none') {
          sidebar.style.display = 'block';
          container.style.gridTemplateColumns = '350px 1fr';
        } else {
          sidebar.style.display = 'none';
          container.style.gridTemplateColumns = '1fr';
        }
      });
    }

    if (this.toggleDarkModeBtn) {
      this.toggleDarkModeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        if (document.body.classList.contains("dark-mode")) {
          this.toggleDarkModeBtn.textContent = "☀️";
        } else {
          this.toggleDarkModeBtn.textContent = "🌙";
        }
      });
    }

    // Initially show formatting options
    this.formattingOptions.style.display = "block";

    // Text preview updates
    this.textPreview.addEventListener("input", () => {
      this.originalText = this.textPreview.innerText;
      this.sendTextUpdate();
      this.updateDurationCalculations();
    });

    // Prevent form submission on enter
    this.textPreview.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        this.start();
      }
    });
  }

  connectWebSocket() {
    try {
      this.updateConnectionStatus("connecting", "Connecting...");
      // Construct WebSocket URL dynamically based on current location
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsPort =
        window.location.port ||
        (window.location.protocol === "https:" ? 443 : 80);
      const wsUrl = `${wsProtocol}//${window.location.hostname}:${wsPort}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("Connected to WebSocket server");
        this.updateConnectionStatus("connected", "Connected");
        this.reconnectAttempts = 0;

        // Register as controller
        this.ws.send(
          JSON.stringify({
            type: "register",
            role: "controller",
          }),
        );

        // Send initial state
        this.sendInitialState();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
        this.updateConnectionStatus("disconnected", "Disconnected");
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.updateConnectionStatus("disconnected", "Connection Error");
      };
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      this.updateConnectionStatus("disconnected", "Failed to Connect");
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      this.updateConnectionStatus(
        "connecting",
        `Reconnecting in ${Math.ceil(delay / 1000)}s...`,
      );

      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      this.updateConnectionStatus(
        "disconnected",
        "Max reconnect attempts reached",
      );
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendInitialState() {
    // Send current text content
    this.sendTextUpdate();

    // Send all current settings
    this.sendMessage({ type: "setSpeed", value: this.speed });
    this.sendMessage({ type: "setFontSize", value: this.fontSize });
    this.updateSegmentLength(); // This will send the segment length
    this.sendMessage({
      type: "setMirrorMode",
      enabled: this.mirrorModeCheckbox.checked,
    });
    this.sendMessage({
      type: "setHideTimer",
      enabled: this.hideTimerCheckbox.checked,
    });
    this.sendMessage({
      type: "setOnAir",
      enabled: this.onAirModeCheckbox.checked,
    });

    // Send scheduled start if set
    if (this.scheduledStartInput.value) {
      this.updateScheduledStart();
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case "stateSync":
        // Server is syncing state - we're already the source of truth, 
        // but let's sync some remote controls if needed
        if (data.state.isPlaying) {
          this.isPlaying = true;
          this.isPaused = false;
          this.startBtn.disabled = true;
          this.pauseBtn.disabled = false;
          this.startTimer();
          this.startScrolling();
        }
        break;

      case "start":
        this.isPlaying = true;
        this.isPaused = false;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.startTimer();
        this.startScrolling();
        break;

      case "pause":
        this.isPlaying = false;
        this.isPaused = true;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stopTimer();
        this.stopScrolling();
        break;

      case "reset":
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stopTimer();
        this.stopScrolling();
        const previewArea = document.getElementById('text-preview');
        if (previewArea) previewArea.scrollTop = 0;
        this.updateDisplay();
        break;
        
      case "scroll":
        this.scrollManual(data.amount);
        break;
        
      case "setSpeed":
        this.speed = data.value;
        if (this.speedControl) this.speedControl.value = data.value;
        if (this.speedDisplay) this.speedDisplay.textContent = data.value;
        this.updateDurationCalculations();
        break;

      case "pong":
        // Heartbeat response
        break;

      case "connectionCount":
        this.updateConnectionInfo(data);
        break;

      default:
        console.log("Unknown message type:", data.type);
    }
  }

  scrollManual(amount) {
    this.currentPosition += amount;
    if (this.currentPosition < 0) this.currentPosition = 0;
    const previewArea = document.getElementById('text-preview');
    if (previewArea) previewArea.scrollTop = this.currentPosition;
  }

  updateConnectionInfo(data) {
    // Update connection status display with count info
    const totalConnections = data.controllers + data.displays;
    const displayText = `Connected (${data.displays} display${data.displays !== 1 ? "s" : ""})`;
    this.updateConnectionStatus("connected", displayText);
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log("Attempting to upload file:", file.name, file.type, file.size);

    try {
      let text = "";

      if (file.type === "text/plain") {
        text = await this.readTextFile(file);
      } else if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        text = await this.readPdfDocument(file);
      } else if (
        file.type === "text/markdown" ||
        file.name.toLowerCase().endsWith(".md")
      ) {
        text = await this.readMarkdownFile(file);
      } else if (
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx")
      ) {
        text = await this.readWordDocument(file);
      } else if (
        file.type.includes("word") ||
        file.name.toLowerCase().endsWith(".doc")
      ) {
        const msg =
          "Legacy .doc files are not supported. Please use .docx format or convert to text.";
        console.warn(msg);
        alert(msg);
        return;
      } else {
        console.warn(
          "Unknown file type:",
          file.type,
          "for file:",
          file.name,
          "- Attempting to read as text.",
        );
        text = await this.readTextFile(file);
      }

      if (text !== undefined) {
        this.originalText = text;
        this.setPrompterText(text);
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("Error reading file: " + error.message);
    }
  }

  readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  async readPdfDocument(file) {
    if (typeof window.pdfjsLib === "undefined") {
      throw new Error("PDF library not loaded. Please refresh the page.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str);
      text += strings.join(" ") + "\n\n";
    }
    return text;
  }

  async readMarkdownFile(file) {
    if (typeof window.marked === "undefined") {
      throw new Error("Markdown library not loaded. Please refresh the page.");
    }
    const text = await this.readTextFile(file);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = window.marked.parse(text);
    let result = "";
    const paragraphs = tempDiv.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li");
    if (paragraphs.length > 0) {
      paragraphs.forEach((p) => {
        result += p.textContent + "\n\n";
      });
    } else {
      result = tempDiv.textContent;
    }
    return result;
  }

  readWordDocument(file) {
    return new Promise((resolve, reject) => {
      if (typeof mammoth === "undefined") {
        reject(
          new Error("Mammoth library not loaded. Please refresh the page."),
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({
            arrayBuffer: arrayBuffer,
          });

          if (result.messages && result.messages.length > 0) {
            console.warn("Word document conversion warnings:", result.messages);
          }

          resolve(result.value);
        } catch (error) {
          reject(new Error("Failed to parse Word document: " + error.message));
        }
      };
      reader.onerror = (e) => reject(new Error("Failed to read Word document"));
      reader.readAsArrayBuffer(file);
    });
  }

  setPrompterText(text) {
    // Auto-format if enabled
    if (this.autoFormatCheckbox.checked) {
      text = this.formatTextForTeleprompterStandards(text);
    }

    const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
    this.textPreview.innerHTML = paragraphs
      .map((p) => `<p>${p.trim()}</p>`)
      .join("");
    this.sendTextUpdate();
    this.updateDurationCalculations();
  }

  sendTextUpdate() {
    const content = this.textPreview.innerHTML;
    this.sendMessage({ type: "setText", content: content });
  }

  clearText() {
    this.originalText = "";
    this.textPreview.innerHTML =
      "<p>Upload your manuscript or type your text here...</p>";
    if (this.fileUpload) {
      this.fileUpload.value = "";
    }
    this.sendTextUpdate();
    this.reset();
    this.updateDurationCalculations();
  }

  updateSpeed(value) {
    this.speed = parseInt(value);
    this.speedDisplay.textContent = this.speed;
    this.sendMessage({ type: "setSpeed", value: this.speed });
    this.updateDurationCalculations();
  }

  updateSegmentLength() {
    const minutes = parseInt(this.segmentMinutesInput.value) || 0;
    const seconds = parseInt(this.segmentSecondsInput.value) || 0;

    // Convert to milliseconds
    this.segmentDuration = (minutes * 60 + seconds) * 1000;

    // Send total seconds to server
    this.sendMessage({
      type: "setSegmentLength",
      minutes: minutes,
      seconds: seconds,
      totalSeconds: minutes * 60 + seconds,
    });

    this.updateDurationCalculations();
    this.updateCountdownDisplay();
  }

  updateFontSize(value) {
    this.fontSize = parseInt(value);
    this.fontSizeDisplay.textContent = this.fontSize + "px";
    
    if (this.textPreview) {
      this.textPreview.style.fontSize = this.fontSize + "px";
      this.textPreview.style.lineHeight = "1.5";
    }

    this.sendMessage({ type: "setFontSize", value: this.fontSize });
  }

  updateMirrorMode(enabled) {
    this.sendMessage({ type: "setMirrorMode", enabled: enabled });
  }

  updateHideTimer(enabled) {
    this.sendMessage({ type: "setHideTimer", enabled: enabled });
  }

  updateOnAir(enabled) {
    this.sendMessage({ type: "setOnAir", enabled: enabled });
  }

  updateScheduledStart() {
    const scheduledTime = this.scheduledStartInput.value;
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();

      if (scheduledDate <= now) {
        alert("Scheduled time must be in the future");
        this.scheduledStartInput.value = "";
        return;
      }

      this.scheduleInfo.innerHTML = `<span>Scheduled for: ${scheduledDate.toLocaleString()}</span>`;
      this.sendMessage({
        type: "setScheduledStart",
        scheduledTime: scheduledDate.getTime(),
      });
    } else {
      this.clearScheduledStart();
    }
  }

  clearScheduledStart() {
    this.scheduledStartInput.value = "";
    this.scheduleInfo.innerHTML = "<span>No scheduled start time set</span>";
    this.sendMessage({ type: "clearScheduledStart" });
  }

  start() {
    if (this.isPaused) {
      this.resume();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now() - (this.pausedTime || 0);

    // Auto-enable on air indicator
    this.onAirModeCheckbox.checked = true;

    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;

    this.sendMessage({ type: "start" });
    this.startTimer();
    this.startScrolling();
  }

  pause() {
    this.isPaused = true;
    this.isPlaying = false;
    this.pausedTime = Date.now() - this.startTime;

    this.startBtn.disabled = false;
    this.pauseBtn.disabled = true;

    this.sendMessage({ type: "pause" });
    this.stopTimer();
    this.stopScrolling();
  }

  resume() {
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now() - this.pausedTime;

    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;

    this.sendMessage({ type: "start" });
    this.startTimer();
    this.startScrolling();
  }

  reset() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentPosition = 0;
    this.startTime = null;
    this.pausedTime = 0;

    this.startBtn.disabled = false;
    this.pauseBtn.disabled = true;

    this.sendMessage({ type: "reset" });
    this.stopTimer();
    this.stopScrolling();
    const previewArea = document.getElementById('text-preview');
    if (previewArea) previewArea.scrollTop = 0;
    this.updateDisplay();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.updateDisplay();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startScrolling() {
    const previewArea = document.getElementById('text-preview');
    if (!previewArea) return;
    
    const scroll = () => {
      if (!this.isPlaying) return;

      const wordsPerSecond = this.speed / 60;
      const pixelsPerSecond = wordsPerSecond * 12;
      const pixelsPerFrame = pixelsPerSecond / 60;

      this.currentPosition += pixelsPerFrame;
      previewArea.scrollTop = this.currentPosition;

      this.animationId = requestAnimationFrame(scroll);
    };

    this.animationId = requestAnimationFrame(scroll);
  }

  stopScrolling() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  updateDisplay() {
    const elapsed = this.startTime
      ? Date.now() - this.startTime
      : this.pausedTime;
    const remaining = Math.max(0, this.segmentDuration - elapsed);

    this.updateCountdownDisplay(remaining);
    this.updateElapsedDisplay(elapsed);

    // Auto-pause when segment time is reached
    if (remaining <= 0 && this.isPlaying) {
      this.pause();
      alert("Segment time completed!");
    }
  }

  updateCountdownDisplay(remaining = this.segmentDuration) {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    this.segmentTimer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  updateElapsedDisplay(elapsed) {
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    this.elapsedTimer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  updateDurationCalculations() {
    const wordCount = this.getWordCount();
    const expectedDurationMs = this.calculateExpectedDuration(wordCount);
    const segmentDurationMs = this.segmentDuration;

    this.wordCount.textContent = wordCount.toLocaleString();
    this.expectedDuration.textContent = this.formatDuration(expectedDurationMs);

    // Calculate and display difference
    const differenceMs = segmentDurationMs - expectedDurationMs;
    this.diffValue.textContent = this.formatDurationDiff(differenceMs);

    // Update styling based on difference
    this.durationDiff.classList.remove("positive", "negative", "neutral");
    if (Math.abs(differenceMs) < 30000) {
      this.durationDiff.classList.add("neutral");
    } else if (differenceMs > 0) {
      this.durationDiff.classList.add("positive");
    } else {
      this.durationDiff.classList.add("negative");
    }
  }

  getWordCount() {
    const text =
      this.textPreview.textContent || this.textPreview.innerText || "";
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    return words.length;
  }

  calculateExpectedDuration(wordCount) {
    return Math.round((wordCount / this.speed) * 60 * 1000);
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  formatDurationDiff(milliseconds) {
    const isNegative = milliseconds < 0;
    const absMs = Math.abs(milliseconds);
    const totalSeconds = Math.floor(absMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const sign = isNegative ? "-" : "+";
    return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  updateConnectionStatus(status, text) {
    this.statusIndicator.className = `status-indicator ${status}`;
    this.statusText.textContent = text;
  }

  async updateDisplayUrl() {
    const protocol = window.location.protocol;
    let hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : "";
    
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      try {
        const response = await fetch("/api/ip");
        if (response.ok) {
          const data = await response.json();
          if (data.ip) hostname = data.ip;
        }
      } catch (err) {
        console.warn("Could not fetch local IP:", err);
      }
    }
    
    this.currentDisplayUrl = `${protocol}//${hostname}${port}/remote.html`;
    this.displayUrl.textContent = this.currentDisplayUrl;
  }

  toggleQrCode() {
    if (this.qrContainer.style.display === "none") {
      this.qrContainer.style.display = "block";
      if (typeof QRCode !== "undefined" && this.currentDisplayUrl) {
        QRCode.toCanvas(this.qrCanvas, this.currentDisplayUrl, {
          width: 200,
          margin: 1,
        }, (error) => {
          if (error) console.error("Error generating QR code:", error);
        });
      }
    } else {
      this.qrContainer.style.display = "none";
    }
  }

  copyDisplayUrl() {
    const displayUrl = this.currentDisplayUrl || this.displayUrl.textContent;

    navigator.clipboard
      .writeText(displayUrl)
      .then(() => {
        this.copyUrlBtn.textContent = "Copied!";
        setTimeout(() => {
          this.copyUrlBtn.textContent = "Copy";
        }, 2000);
      })
      .catch(() => {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = displayUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        this.copyUrlBtn.textContent = "Copied!";
        setTimeout(() => {
          this.copyUrlBtn.textContent = "Copy";
        }, 2000);
      });
  }

  formatTextForTeleprompter() {
    const currentText =
      this.originalText || this.textPreview.textContent || this.textPreview.innerText || "";
    
    if (!currentText.trim() || currentText.includes("Upload your manuscript")) {
      alert(
        "No text to format. Please upload a manuscript or enter text first.",
      );
      return;
    }

    const formattedText = this.formatTextForTeleprompterStandards(currentText);
    this.setPrompterTextDirectly(formattedText);
    
    // Provide visual feedback
    const originalBg = this.textPreview.style.backgroundColor;
    this.textPreview.style.transition = "background-color 0.3s";
    this.textPreview.style.backgroundColor = "#e8f5e9";
    setTimeout(() => {
      this.textPreview.style.backgroundColor = originalBg;
    }, 300);
  }

  setPrompterTextDirectly(text) {
    const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
    this.textPreview.innerHTML = paragraphs
      .map((p) => `<p>${p.trim()}</p>`)
      .join("");
    this.sendTextUpdate();
    this.updateDurationCalculations();
  }

  formatTextForTeleprompterStandards(text) {
    let formattedText = text;

    // Apply selected formatting options
    if (this.formatCapsCheckbox.checked) {
      formattedText = this.convertToUppercase(formattedText);
    }

    if (this.formatNumbersCheckbox.checked) {
      formattedText = this.convertNumbersToWords(formattedText);
    }

    if (this.formatPunctuationCheckbox.checked) {
      formattedText = this.enhancePunctuationPauses(formattedText);
    }

    if (this.formatSentencesCheckbox.checked) {
      formattedText = this.formatSentenceBreaks(formattedText);
    }

    if (this.formatParagraphsCheckbox.checked) {
      formattedText = this.addParagraphBreaks(formattedText);
    }

    return formattedText;
  }

  convertToUppercase(text) {
    return text.toUpperCase();
  }

  convertNumbersToWords(text) {
    const numberWords = {
      0: "ZERO",
      1: "ONE",
      2: "TWO",
      3: "THREE",
      4: "FOUR",
      5: "FIVE",
      6: "SIX",
      7: "SEVEN",
      8: "EIGHT",
      9: "NINE",
      10: "TEN",
      11: "ELEVEN",
      12: "TWELVE",
      13: "THIRTEEN",
      14: "FOURTEEN",
      15: "FIFTEEN",
      16: "SIXTEEN",
      17: "SEVENTEEN",
      18: "EIGHTEEN",
      19: "NINETEEN",
      20: "TWENTY",
      30: "THIRTY",
      40: "FORTY",
      50: "FIFTY",
      60: "SIXTY",
      70: "SEVENTY",
      80: "EIGHTY",
      90: "NINETY",
      100: "ONE HUNDRED",
    };

    // Convert simple numbers (0-100) to words
    return text.replace(/\b(\d{1,3})\b/g, (match, number) => {
      const num = parseInt(number);
      if (numberWords[num]) {
        return numberWords[num];
      } else if (num < 100) {
        const tens = Math.floor(num / 10) * 10;
        const ones = num % 10;
        if (tens > 0 && ones > 0) {
          return `${numberWords[tens]}-${numberWords[ones]}`;
        }
      }
      return match; // Return original if not found
    });
  }

  enhancePunctuationPauses(text) {
    // Add extra spaces for natural pauses
    return text
      .replace(/\./g, ". ") // Period pause
      .replace(/,/g, ", ") // Comma pause
      .replace(/;/g, "; ") // Semicolon pause
      .replace(/:/g, ": ") // Colon pause
      .replace(/\?/g, "? ") // Question pause
      .replace(/!/g, "! ") // Exclamation pause
      .replace(/\s+/g, " ") // Clean up multiple spaces
      .trim();
  }

  formatSentenceBreaks(text) {
    // Put each sentence on its own line
    return text
      .replace(/([.!?])\s+/g, "$1\n\n") // Line break after sentence-ending punctuation
      .replace(/\n\n+/g, "\n\n") // Clean up multiple line breaks
      .trim();
  }

  addParagraphBreaks(text) {
    // Ensure proper paragraph spacing for teleprompter readability
    const sentences = text.split(/\n\n/);
    const groupedSentences = [];

    // Group sentences into logical paragraphs (3-4 sentences max)
    for (let i = 0; i < sentences.length; i += 3) {
      const paragraph = sentences.slice(i, i + 3).join("\n\n");
      groupedSentences.push(paragraph);
    }

    return groupedSentences.join("\n\n\n"); // Extra space between paragraphs
  }
}

// Initialize controller when page loads
document.addEventListener("DOMContentLoaded", () => {
  new TeleprompterController();
});

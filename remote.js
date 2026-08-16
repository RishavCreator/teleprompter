class TeleprompterRemote {
  constructor() {
    this.ws = null;
    this.isPlaying = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.btnPlay = document.getElementById('btn-play');
    this.btnPause = document.getElementById('btn-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.btnUp = document.getElementById('btn-up');
    this.btnDown = document.getElementById('btn-down');
    this.speedSlider = document.getElementById('speed');
    this.speedVal = document.getElementById('speed-val');
    this.statusEl = document.getElementById('status');
    
    this.bindEvents();
    this.connectWebSocket();
  }

  bindEvents() {
    this.btnPlay.addEventListener('click', () => {
      this.sendMessage({ type: "start" });
    });
    
    this.btnPause.addEventListener('click', () => {
      this.sendMessage({ type: "pause" });
    });
    
    this.btnReset.addEventListener('click', () => {
      this.sendMessage({ type: "reset" });
    });
    
    this.btnUp.addEventListener('click', () => {
      this.sendMessage({ type: "scroll", amount: -150 });
    });
    
    this.btnDown.addEventListener('click', () => {
      this.sendMessage({ type: "scroll", amount: 150 });
    });
    
    this.speedSlider.addEventListener('input', (e) => {
      this.speedVal.textContent = e.target.value + ' wpm';
      this.sendMessage({ type: "setSpeed", value: parseInt(e.target.value) });
    });
  }

  connectWebSocket() {
    try {
      this.updateStatus('connecting', 'Connecting...');
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsPort = window.location.port || (window.location.protocol === "https:" ? 443 : 80);
      const wsUrl = `${wsProtocol}//${window.location.hostname}:${wsPort}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.updateStatus('connected', 'Connected');
        this.reconnectAttempts = 0;
        this.ws.send(JSON.stringify({ type: "register", role: "controller" }));
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
        this.updateStatus('disconnected', 'Disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      this.updateStatus('disconnected', 'Failed to Connect');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connectWebSocket(), 2000);
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  updateStatus(status, text) {
    this.statusEl.className = `status ${status}`;
    this.statusEl.textContent = text;
  }

  handleMessage(data) {
    if (data.type === "stateSync") {
      this.syncState(data.state);
    } else if (data.type === "start") {
      this.setPlaying(true);
    } else if (data.type === "pause" || data.type === "reset") {
      this.setPlaying(false);
    } else if (data.type === "setSpeed") {
      this.speedSlider.value = data.value;
      this.speedVal.textContent = data.value + ' wpm';
    }
  }

  syncState(state) {
    this.setPlaying(state.isPlaying);
    if (state.speed) {
      this.speedSlider.value = state.speed;
      this.speedVal.textContent = state.speed + ' wpm';
    }
  }

  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    if (isPlaying) {
      this.btnPlay.style.display = 'none';
      this.btnPause.style.display = 'flex';
    } else {
      this.btnPlay.style.display = 'flex';
      this.btnPause.style.display = 'none';
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new TeleprompterRemote();
});

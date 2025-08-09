// C:\code\moradafish\src\services\balancaService.js

const balancaManager = {
  port: null,
  reader: null,
  writer: null,
  keepReading: false,
  textDecoder: new TextDecoder(),
  buffer: '',
  resolveCurrentRead: null,
  timeout: 8000, // 8 segundos

  async connect() {
    if (this.port) {
      console.log("A balança já está conectada.");
      return true;
    }
    try {
      console.log("Solicitando porta serial para balança...");
      this.port = await navigator.serial.requestPort();

      const correctConfig = { baudRate: 9600, dataBits: 8, parity: 'none' };
      console.log("[Balança] Conectando com a configuração correta:", correctConfig);
      await this.port.open(correctConfig);

      console.log("[Balança] Conexão bem-sucedida!");

      this.writer = this.port.writable.getWriter();

      await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
      console.log("[Balança] Sinais DTR e RTS ativados.");

      this.keepReading = true;
      this.startReadingLoop();
      return true;

    } catch (err) {
      console.error("Erro final ao conectar com a balança:", err.message);
      if (err.name !== 'NotFoundError') {
        alert("Não foi possível conectar à balança. Verifique o cabo, driver CH34x e se não está sendo usada por outro programa.");
      }
      this.port = null;
      return false;
    }
  },

  async solicitarPeso() {
    const comando = 'P';
    if (!this.writer) {
      console.error("[Balança] O escritor da porta serial não está disponível.");
      return;
    }
    try {
      console.log(`[Balança] Enviando comando de solicitação de peso ('${comando}')...`);
      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode(comando));
    } catch (error) {
      console.error("[Balança] Erro ao enviar comando para a balança:", error);
    }
  },

  // MÉTODO PRINCIPAL DE LEITURA COM DEBUG
  async startReadingLoop() {
    if (!this.port) return;
    this.reader = this.port.readable.getReader();

    while (this.port && this.keepReading) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;

        const arr = Array.from(value);
        console.log('[Balança] Bytes brutos recebidos (Uint8Array):', arr);

        // NOVO PARSER TESTE
        const b10 = arr[10];
        const b11 = arr[11];
        const b9 = arr[9];
        const b8 = arr[8];
        const b7 = arr[7];

        const peso_le = ((b11 << 8) | b10) / 1000;
        const peso_be = ((b10 << 8) | b11) / 1000;
        const peso_1 = b10 / 1000;
        const peso_3 = ((b9 << 16) | (b10 << 8) | b11) / 1000;

        console.log(`[PARSER TESTE] Peso só b10: ${peso_1} kg`);
        console.log(`[PARSER TESTE] Peso b10/b11 little-endian: ${peso_le} kg`);
        console.log(`[PARSER TESTE] Peso b10/b11 big-endian: ${peso_be} kg`);
        console.log(`[PARSER TESTE] Peso b9,b10,b11: ${peso_3} kg`);

        if (this.resolveCurrentRead) {
          if (peso_le > 0 && peso_le < 100) {
            this.resolveCurrentRead(peso_le);
            this.resolveCurrentRead = null;
          } else if (peso_be > 0 && peso_be < 100) {
            this.resolveCurrentRead(peso_be);
            this.resolveCurrentRead = null;
          } else if (peso_1 > 0 && peso_1 < 5) {
            this.resolveCurrentRead(peso_1);
            this.resolveCurrentRead = null;
          }
        }

        if (this.buffer.length > 200) {
          this.buffer = this.buffer.slice(this.buffer.length - 100);
        }
      } catch (error) {
        if (error.message && error.message.includes('device has been lost')) {
          alert("A balança foi desconectada do computador. Verifique o cabo USB e conecte novamente.");
        } else {
          console.error("[Balança] Erro no loop de leitura da balança:", error);
        }
        this.keepReading = false;
        await this.disconnect();
        break;
      }
    }

    if (this.reader) {
      try { await this.reader.releaseLock(); } catch {}
      this.reader = null;
    }
    console.log("Loop de leitura da balança encerrado.");
  },

  readOnce() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.resolveCurrentRead = null;
        reject(new Error("Tempo de leitura da balança esgotado."));
      }, this.timeout);

      this.resolveCurrentRead = (weight) => {
        clearTimeout(timeoutId);
        resolve(weight);
      };
    });
  },

  async disconnect() {
    this.keepReading = false;
    if (this.writer) {
      try { await this.writer.releaseLock(); } catch {}
      this.writer = null;
    }
    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
    }
    if (this.port) {
      try { await this.port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch {}
      try { await this.port.close(); } catch {}
      this.port = null;
      console.log("[Balança] Desconectada.");
    }
  },

  async reconnect() {
    await this.disconnect();
    return await this.connect();
  }
};

export const lerPesoDaBalanca = async () => {
  if (!navigator.serial) {
    alert("Seu navegador não suporta conexão com porta serial! Use o Chrome ou Edge mais recente.");
    return null;
  }
  if (!balancaManager.port) {
    const connected = await balancaManager.connect();
    if (!connected) return null;
  }
  try {
    await balancaManager.solicitarPeso();
    console.log("[Balança] Aguardando leitura...");
    return await balancaManager.readOnce();
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('device')) {
      await balancaManager.disconnect();
      alert("Balança desconectada. Reconecte o cabo e tente novamente.");
    } else {
      alert(error.message + "\nVerifique se a balança está conectada e se o item está estável.");
    }
    return null;
  }
};

export default balancaManager;

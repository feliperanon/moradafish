// src/services/balancaService.js

/**
 * Objeto para gerenciar a conexão com a balança de forma persistente.
 * Ele abre a porta e inicia um loop de leitura para interpretar os dados da balança.
 */
const balancaManager = {
  port: null,
  reader: null,
  keepReading: true,
  textDecoder: new TextDecoder(),
  buffer: '',
  resolveCurrentRead: null,

  async connect() {
    if (this.port) {
      console.log("A balança já está conectada.");
      return true;
    }
    try {
      console.log("Solicitando porta serial...");
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      console.log("Balança conectada com sucesso!");

      this.keepReading = true;
      this.startReadingLoop();

      return true;
    } catch (err) {
      console.error("Erro ao conectar com a balança:", err.message);
      if (err.name !== 'NotFoundError') {
        alert("Não foi possível conectar à balança. Verifique se ela está conectada e se não está sendo usada por outro programa.");
      }
      this.port = null;
      return false;
    }
  },

  async startReadingLoop() {
    this.reader = this.port.readable.getReader();

    while (this.port && this.keepReading) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;

        this.buffer += this.textDecoder.decode(value, { stream: true });

        // *** LÓGICA ATUALIZADA PARA O FORMATO REAL DA BALANÇA ***
        // Procura pelo padrão "=ph" seguido por 12 dígitos. Ex: "=ph000125000000"
        const match = this.buffer.match(/=ph(\d{12})/);
        
        if (match && match[1]) {
          const capturedString = match[1]; // Ex: "000125000000"
          
          // Interpreta a string como um peso no formato XXXX.XXX kg
          // Pega os 4 primeiros dígitos para a parte inteira e os 3 seguintes para a decimal.
          const integerPart = capturedString.substring(0, 4);
          const fractionalPart = capturedString.substring(4, 7);
          const weightString = `${integerPart}.${fractionalPart}`; // Ex: "0001.250"
          
          const weight = parseFloat(weightString); // Converte para número: 1.25
          
          console.log(`Peso interpretado: ${weight} kg`);

          if (this.resolveCurrentRead) {
            this.resolveCurrentRead(weight);
            this.resolveCurrentRead = null;
          }
          // Limpa o buffer para aguardar o próximo pacote de dados completo
          this.buffer = ''; 
        }

        // Medida de segurança para não deixar o buffer crescer infinitamente
        if (this.buffer.length > 200) {
            this.buffer = this.buffer.slice(this.buffer.length - 100);
        }
      } catch (error) {
        console.error("Erro no loop de leitura da balança:", error);
        this.keepReading = false; // Para o loop em caso de erro
      }
    }
    
    if(this.reader) {
        this.reader.releaseLock();
        this.reader = null;
    }
    console.log("Loop de leitura da balança encerrado.");
  },

  readOnce() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.resolveCurrentRead = null;
        reject(new Error("Tempo de leitura da balança esgotado."));
      }, 5000); // Timeout de 5 segundos

      this.resolveCurrentRead = (weight) => {
        clearTimeout(timeoutId);
        resolve(weight);
      };
    });
  },

  async disconnect() {
    if (this.reader) {
      this.keepReading = false;
      await this.reader.cancel();
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
      console.log("Balança desconectada.");
    }
  }
};

export const lerPesoDaBalanca = async () => {
  if (!balancaManager.port) {
    const connected = await balancaManager.connect();
    if (!connected) return null;
  }

  try {
    console.log("Aguardando peso da balança...");
    const peso = await balancaManager.readOnce();
    return peso;
  } catch (error) {
    console.error(error.message);
    alert("Não foi possível ler o peso. Tente novamente ou verifique a conexão da balança.");
    return null;
  }
};

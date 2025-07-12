// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do seu projeto Firebase existente (versão corrigida)
const firebaseConfig = {
  apiKey: "AIzaSyAHfit46TkZaOgEHVX3knmUnqUIVIXDmCI",
  authDomain: "painel-filetadores.firebaseapp.com",
  projectId: "painel-filetadores",
  storageBucket: "painel-filetadores.firebasestorage.app",
  messagingSenderId: "536826620604",
  appId: "1:536826620604:web:89930f02e9c91930cc7eb9",
  measurementId: "G-TFGJQKF1W6"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços para serem usados em outras partes do app
export const auth = getAuth(app);
export const db = getFirestore(app);
// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  // Se sua versão suportar, dá para usar cache offline:
  // persistentLocalCache,
  // persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAHfit46TkZaOgEHVX3knmUnqUIVIXDmCI",
  authDomain: "painel-filetadores.firebaseapp.com",
  projectId: "painel-filetadores",
  storageBucket: "painel-filetadores.firebasestorage.app",
  messagingSenderId: "536826620604",
  appId: "1:536826620604:web:89930f02e9c91930cc7eb9",
  measurementId: "G-TFGJQKF1W6",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ✅ Evita QUIC/HTTP3 e proxies bloqueando o canal de escuta.
// 1) Tenta auto‑detectar e cair para long‑polling se necessário.
// 2) Se ainda der problema, troque 'experimentalAutoDetectLongPolling' por 'experimentalForceLongPolling: true'.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false, // garante compatibilidade com alguns proxies
  // Se quiser forçar de vez:
  // experimentalForceLongPolling: true,
});

// Se quiser ativar cache offline (opcional; requer versão recente do SDK):
// initializeFirestore(app, {
//   experimentalAutoDetectLongPolling: true,
//   localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
// });

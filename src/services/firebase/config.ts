import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
/**
 * `experimentalAutoDetectLongPolling` evita o erro "Could not reach Cloud Firestore backend" em
 * redes que bloqueiam o streaming WebChannel (proxies corporativos, alguns VPNs/Wi-Fi público):
 * o SDK detecta isso e cai para long polling automaticamente. `persistentLocalCache` mantém um
 * cache em IndexedDB para que leituras já feitas sobrevivam a quedas momentâneas de conexão.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  experimentalAutoDetectLongPolling: true,
})

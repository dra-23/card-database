import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  deleteField,
  query,
  where,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyCl_v7yBddGdkldYyiKFoR8wQ73R5LdAN0',
  authDomain: 'sleevd-7214c.firebaseapp.com',
  projectId: 'sleevd-7214c',
  storageBucket: 'sleevd-7214c.firebasestorage.app',
  messagingSenderId: '176444568903',
  appId: '1:176444568903:web:0acce08ab1f18b8fe30862',
  measurementId: 'G-67S1G9KPJM',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const storage = getStorage(app)

export const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (e) {
    console.error('Sign-in error:', e)
  }
}

export async function signOutUser() {
  await signOut(auth)
}

export { onAuthStateChanged, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, deleteField, query, where, ref, uploadBytes, getDownloadURL }

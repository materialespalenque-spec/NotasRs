// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDa8_CYaLLzI9xwvAyx_OkgWLZ-rqfhTQk",
  authDomain: "notasrapidasrs.firebaseapp.com",
  projectId: "notasrapidasrs",
  storageBucket: "notasrapidasrs.firebasestorage.app",
  messagingSenderId: "218766427490",
  appId: "1:218766427490:web:7a0f4e8b70fb197bfd183b",
  measurementId: "G-JQE5WZJ3KL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
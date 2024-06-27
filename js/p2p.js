// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";
import { getFirestore, collection, updateDoc, addDoc, setDoc, getDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { Event } from "./index.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDIEPUVHWY-gvyjlJ78xVO4aXPgxa6bD3Y",
  authDomain: "greatkindom-4c782.firebaseapp.com",
  projectId: "greatkindom-4c782",
  storageBucket: "greatkindom-4c782.appspot.com",
  messagingSenderId: "948275518632",
  appId: "1:948275518632:web:bb37a1aa59f95da217f69d",
  measurementId: "G-EEZWYHJMW4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let channel = null;
let channel_handler = null;
let iscaller = false;

export async function createRoom() {
  const roomDoc = doc(collection(db, "room"));
  const offerCandidates = collection(roomDoc, "offerCandidates");
  const answerCandidates = collection(roomDoc, "answerCandidates");

  pc.addEventListener("icecandidate", (event) => {
    if (!event.candidate) {
      console.log("Got final candidate!");
      return;
    }
    console.log("Got candidate:", event.candidate);
    addDoc(offerCandidates, event.candidate.toJSON());
  });

  channel = pc.createDataChannel("control");
  channel.addEventListener("message", channel_handler);
  channel.addEventListener("open", (event) => {
    console.log("[RTC] Connection opened");
  });
  channel.addEventListener("close", (event) => {
    channel = null;
    iscaller = false;
  });

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await setDoc(roomDoc, { offer });

  onSnapshot(roomDoc, (snapshot) => {
    const data = snapshot.data();

    if (!pc.currentRemoteDescription && data.answer) {
      console.log("Got answer:", data.answer);
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        console.log("Got answer candidate:", candidate);
        pc.addIceCandidate(candidate);
      }
    });
  });

  iscaller = true;
  return roomDoc.id;
}

export async function joinRoom(id) {
  const roomDoc = doc(collection(db, "room"), id);
  const offerCandidates = collection(roomDoc, "offerCandidates");
  const answerCandidates = collection(roomDoc, "answerCandidates");

  pc.addEventListener("icecandidate", (event) => {
    if (!event.candidate) {
      console.log("Got final candidate!");
      return;
    }
    console.log("Got candidate:", event.candidate);
    addDoc(answerCandidates, event.candidate.toJSON());
  });

  pc.addEventListener("datachannel", (event) => {
    channel = event.channel;
    channel.addEventListener("message", channel_handler);
    channel.addEventListener("open", (event) => {
      console.log("[RTC] Connection opened");
    });
    channel.addEventListener("close", (event) => {
      channel = null;
      iscaller = false;
    });
  });

  const callData = (await getDoc(roomDoc)).data();

  const offerDescription = callData.offer;
  console.log("Got offer:", offerDescription);
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(new RTCSessionDescription(answerDescription));

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
  };

  await updateDoc(roomDoc, { answer });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        console.log("Got offer candidate:", candidate);
        pc.addIceCandidate(candidate);
      }
    });
  });
  iscaller = false;
}

export function send(message) {
  if (channel === null) return;
  channel.send(JSON.stringify(message));
}

export function register(handler) {
  channel_handler = handler;
}

export function leave() {
  channel = null;
  iscaller = false;
  pc.close();
  pc.onicecandidate = null;
}

export function isCaller() {
  return iscaller;
}

export function isConnected() {
  return channel !== null;
}

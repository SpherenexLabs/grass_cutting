import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBzXzocbdytm4N8vlrT-V2JY78pgdWrbCQ",
  authDomain: "self-balancing-7a9fe.firebaseapp.com",
  databaseURL: "https://self-balancing-7a9fe-default-rtdb.firebaseio.com",
  projectId: "self-balancing-7a9fe",
  storageBucket: "self-balancing-7a9fe.firebasestorage.app",
  messagingSenderId: "1044959372723",
  appId: "1:1044959372723:web:7e1f73307107cf91ba97c6",
  measurementId: "G-357J7ZXYED"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Main root path
const ROOT = "91_Grass_Cutting_Robot_18_04_2026";

// Refs
const robotMovementRef = ref(database, `${ROOT}/1_Robot_Movements`);
const sensorDataRef = ref(database, `${ROOT}/2_Sensor_Data`);
const motorCommandsRef = ref(database, `${ROOT}/3_Motor_Commands`);
const emergencyRef = ref(database, `${ROOT}/4_Emergency_Stop`);

// Write helpers
export const setRobotDirection = async (value) => {
  await set(ref(database, `${ROOT}/1_Robot_Movements/1_Robot_Direction`), value);
};

export const setRobotSpeed = async (value) => {
  await set(ref(database, `${ROOT}/1_Robot_Movements/4_Robot_Speed`), String(value));
};

export const setBlade = async (value) => {
  await set(ref(database, `${ROOT}/3_Motor_Commands/1_Blade`), value);
};

export const setBladePosition = async (value) => {
  await set(ref(database, `${ROOT}/3_Motor_Commands/2_Blade_Position`), value);
};

export const setPump = async (value) => {
  await set(ref(database, `${ROOT}/3_Motor_Commands/3_Pump`), value);
};

export const toggleEmergencyStop = async () => {
  const snap = await get(emergencyRef);
  const current = snap.exists() ? snap.val() : 0;
  await set(emergencyRef, current === 1 ? 0 : 1);
};

// Live listeners
export const listenRobotMovements = (callback) => {
  return onValue(robotMovementRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
};

export const listenSensorData = (callback) => {
  return onValue(sensorDataRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
};

export const listenMotorCommands = (callback) => {
  return onValue(motorCommandsRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
};

export const listenEmergencyStop = (callback) => {
  return onValue(emergencyRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : 0);
  });
};

export { database, ROOT };
import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  listenRobotMovements,
  listenSensorData,
  listenMotorCommands,
  listenEmergencyStop,
  setRobotDirection,
  setRobotSpeed,
  setBlade,
  setBladePosition,
  setPump,
  toggleEmergencyStop,
} from "./firebase";

/* ── Mini area chart ── */
function MiniChart({ data, color, gradId }) {
  if (data.length === 0) {
    return <div className="chart-empty">Waiting for data…</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.38} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="ts" hide />
        <YAxis
          tick={{ fontSize: 9, fill: "#6b7280" }}
          axisLine={false} tickLine={false} width={28}
        />
        <Tooltip
          contentStyle={{ background: "#0c1a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, padding: "6px 10px" }}
          labelStyle={{ color: "#6b7280", marginBottom: 2 }}
          itemStyle={{ color }}
          formatter={(v) => [v, ""]}
        />
        <Area
          type="monotone" dataKey="value"
          stroke={color} strokeWidth={2}
          fill={`url(#${gradId})`} dot={false} animationDuration={400}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Main app ── */
function App() {
  const [robotMovements,  setRobotMovementsState]  = useState({});
  const [sensorData,      setSensorDataState]       = useState({});
  const [motorCommands,   setMotorCommandsState]    = useState({});
  const [emergencyStop,   setEmergencyStopState]    = useState(0);
  const [alerts,          setAlerts]                = useState([]);
  const [backendStatus,   setBackendStatus]         = useState({ grass_detected: false, grass_count: 0, last_updated: "" });

  /* chart history */
  const [voltageHistory, setVoltageHistory] = useState([]);
  const [tempHistory,    setTempHistory]    = useState([]);
  const [humHistory,     setHumHistory]     = useState([]);
  const [currHistory,    setCurrHistory]    = useState([]);

  const alertHistoryRef = useRef(new Set());

  /* Firebase listeners */
  useEffect(() => {
    const u1 = listenRobotMovements((d) => setRobotMovementsState(d));
    const u2 = listenSensorData((d)     => setSensorDataState(d));
    const u3 = listenMotorCommands((d)  => setMotorCommandsState(d));
    const u4 = listenEmergencyStop((d)  => setEmergencyStopState(d));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  /* Backend poll */
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res  = await fetch("http://localhost:5000/detect_status");
        const data = await res.json();
        setBackendStatus(data);
        if (data.grass_detected) pushAlert(`Grass detected · Count: ${data.grass_count}`, "success");
      } catch { /* backend offline */ }
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  /* Chart history updater */
  useEffect(() => {
    const ts      = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const voltage = getNumber(sensorData["2_Voltage"]);
    const temp    = getNumber(sensorData["4_Temperature"]);
    const hum     = getNumber(sensorData["5_Humidity"]);
    const current = getNumber(sensorData["1_Current"]);
    if (voltage > 0) setVoltageHistory(p => [...p.slice(-29), { ts, value: voltage }]);
    if (temp    > 0) setTempHistory(   p => [...p.slice(-29), { ts, value: temp    }]);
    if (hum     > 0) setHumHistory(    p => [...p.slice(-29), { ts, value: hum     }]);
    if (current > 0) setCurrHistory(   p => [...p.slice(-29), { ts, value: current }]);
  }, [sensorData]);

  /* Obstacle alert */
  useEffect(() => {
    if (String(robotMovements["2_Object_Detected"] || "0") === "1") {
      const side    = String(robotMovements["3_What_Side"] || "N");
      const sideMap = { L: "Left", R: "Right", F: "Front", B: "Back", N: "Unknown" };
      pushAlert(`Obstacle on ${sideMap[side] || side} side — robot stopped`, "danger");
    }
  }, [robotMovements]);

  useEffect(() => { checkSensorAlerts(); }, [sensorData]);

  const pushAlert = (message, type = "info") => {
    const key = `${type}-${message}`;
    if (alertHistoryRef.current.has(key)) return;
    alertHistoryRef.current.add(key);
    const id = Date.now() + Math.random();
    setAlerts(p => [{ id, message, type }, ...p.slice(0, 6)]);
    setTimeout(() => {
      setAlerts(p => p.filter(a => a.id !== id));
      alertHistoryRef.current.delete(key);
    }, 5000);
  };

  const getNumber = (v) => {
    if (v === undefined || v === null) return 0;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const checkSensorAlerts = () => {
    const current     = getNumber(sensorData["1_Current"]);
    const voltage     = getNumber(sensorData["2_Voltage"]);
    const water       = String(sensorData["3_Water_Level"]   || "");
    const temp        = getNumber(sensorData["4_Temperature"]);
    const hum         = getNumber(sensorData["5_Humidity"]);
    const bladeRpm    = getNumber(sensorData["6_Blade_RPM"]);
    const battVoltage = getNumber(sensorData["7_Battery_Voltage"]);
    const battPercent = getNumber(sensorData["8_Battery_Percent"]);
    const battStatus  = String(sensorData["9_Battery_Status"] || "");
    if (current > 3)                  pushAlert(`High current: ${current} A`, "danger");
    if (current > 0 && current < 0.3) pushAlert(`Low current: ${current} A`, "warning");
    if (voltage > 15)                 pushAlert(`High voltage: ${voltage} V`, "danger");
    if (voltage > 0 && voltage < 9)   pushAlert(`Low voltage: ${voltage} V`, "warning");
    const wUpper = water.toUpperCase();
    if      (wUpper.includes("DRY"))  pushAlert(`Water level: ${water}`, "danger");
    else if (wUpper.includes("LOW"))  pushAlert(`Water level: ${water}`, "warning");
    else if (wUpper.includes("FULL")) pushAlert(`Water level: ${water}`, "success");
    if (temp > 40)                    pushAlert(`High temperature: ${temp} °C`, "danger");
    if (hum  > 80)                    pushAlert(`High humidity: ${hum} %`, "warning");
    if (bladeRpm === 0 && Number(motorCommands["1_Blade"]) === 1) pushAlert(`Blade ON but RPM is 0`, "warning");
    if (battVoltage < 10.5)           pushAlert(`Low battery voltage: ${battVoltage} V`, "warning");
    if (battPercent < 30)             pushAlert(`Low battery: ${battPercent}%`, "warning");
    const bs = battStatus.toUpperCase();
    if      (bs === "LOW")    pushAlert("Battery: LOW", "danger");
    else if (bs === "MEDIUM") pushAlert("Battery: MEDIUM", "warning");
    else if (bs === "FULL")   pushAlert("Battery: FULL", "success");
  };

  const currentSpeed = getNumber(robotMovements["4_Robot_Speed"] || 100);
  const bladeState   = Number(motorCommands["1_Blade"] || 0);
  const pumpState    = Number(motorCommands["3_Pump"]  || 0);
  const isEmergency  = Number(emergencyStop) === 1;
  const speedPct     = ((currentSpeed - 10) / 240) * 100;

  const increaseSpeed = () => setRobotSpeed(Math.min(currentSpeed + 10, 250));
  const decreaseSpeed = () => setRobotSpeed(Math.max(currentSpeed - 10, 10));
  const dir           = (v) => setRobotDirection(v);
  const startBPos     = (v) => setBladePosition(v);
  const stopBPos      = ()  => setBladePosition("S");

  const sensorItems = [
    { label: "Current",      value: sensorData["1_Current"],         unit: " A",  dot: "green"  },
    { label: "Voltage",      value: sensorData["2_Voltage"],         unit: " V",  dot: "orange" },
    { label: "Water Level",  value: sensorData["3_Water_Level"],     unit: "",    dot: "blue"   },
    { label: "Temperature",  value: sensorData["4_Temperature"],     unit: " °C", dot: "red"    },
    { label: "Humidity",     value: sensorData["5_Humidity"],        unit: " %",  dot: "blue"   },
    { label: "Blade RPM",    value: sensorData["6_Blade_RPM"],       unit: "",    dot: "green"  },
    { label: "Battery V",    value: sensorData["7_Battery_Voltage"], unit: " V",  dot: "orange" },
    { label: "Battery %",    value: sensorData["8_Battery_Percent"], unit: "%",   dot: "orange" },
    { label: "Batt. Status", value: sensorData["9_Battery_Status"],  unit: "",    dot: "green"  },
  ];

  const statusItems = [
    { label: "Direction",  value: robotMovements["1_Robot_Direction"] || "S" },
    { label: "Obstacle",   value: robotMovements["2_Object_Detected"]  || "0" },
    { label: "Obs. Side",  value: robotMovements["3_What_Side"]        || "N" },
    { label: "Speed",      value: currentSpeed },
    { label: "Blade",      value: bladeState === 1 ? "ON" : "OFF" },
    { label: "Pump",       value: pumpState  === 1 ? "ON" : "OFF" },
  ];

  const lastV = (arr) => arr.length ? arr[arr.length - 1].value : null;

  return (
    <div className="app">

      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🤖</div>
          <div>
            <h1>Agritech Field Robot</h1>
            <p>Grass Detection · Robot Control · Sensor Dashboard</p>
          </div>
        </div>

        <div className="header-pills">
          <div className="hpill">
            <div className="online-dot"></div>
            <span>Online</span>
          </div>
          {backendStatus.grass_detected && (
            <div className="hpill grass">🌿 Grass ×{backendStatus.grass_count}</div>
          )}
          <div className="hpill">Speed <strong>{currentSpeed}</strong></div>
          <div className={`hpill ${bladeState ? "on" : ""}`}>Blade <strong>{bladeState ? "ON" : "OFF"}</strong></div>
          <div className={`hpill ${pumpState  ? "on" : ""}`}>Pump  <strong>{pumpState  ? "ON" : "OFF"}</strong></div>
        </div>

        <button
          className={`emg-btn ${isEmergency ? "active" : ""}`}
          onClick={toggleEmergencyStop}
        >
          {isEmergency ? "⚠ EMERGENCY ACTIVE" : "Emergency Stop"}
        </button>
      </header>

      {/* ALERTS */}
      <div className="alerts-wrap">
        {alerts.map((a) => (
          <div key={a.id} className={`alert-item ${a.type}`}>
            <div className="a-dot"></div>
            {a.message}
          </div>
        ))}
      </div>

      {/* MAIN 3-COLUMN */}
      <div className="main-grid">

        {/* LEFT */}
        <div className="col-left">

          <div className="card">
            <div className="card-head">
              <div className="cdot green"></div>
              <span className="ctitle">Direction</span>
            </div>
            <div className="card-body">
              <div className="dpad">
                <div className="dpad-row">
                  <div className="dpad-space"></div>
                  <button className="dpad-btn" onClick={() => dir("F")}>▲</button>
                  <div className="dpad-space"></div>
                </div>
                <div className="dpad-row">
                  <button className="dpad-btn" onClick={() => dir("L")}>◀</button>
                  <button className="dpad-btn stop" onClick={() => dir("S")}>■</button>
                  <button className="dpad-btn" onClick={() => dir("R")}>▶</button>
                </div>
                <div className="dpad-row">
                  <div className="dpad-space"></div>
                  <button className="dpad-btn" onClick={() => dir("B")}>▼</button>
                  <div className="dpad-space"></div>
                </div>
              </div>
              <div className="info-row">
                <span className="dim">Active direction</span>
                <span className="chip">{robotMovements["1_Robot_Direction"] || "S"}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="cdot orange"></div>
              <span className="ctitle">Speed</span>
            </div>
            <div className="card-body">
              <div className="speed-row">
                <button className="spd-btn" onClick={decreaseSpeed}>−</button>
                <span className="spd-num">{currentSpeed}</span>
                <button className="spd-btn" onClick={increaseSpeed}>+</button>
              </div>
              <div className="spd-track"><div className="spd-fill" style={{ width: `${speedPct}%` }}></div></div>
              <div className="dim center mt6">Min 10 · Max 250</div>
            </div>
          </div>

        </div>

        {/* CENTER */}
        {/* <div className="col-center">
          <div className="card video-card">
            <div className="card-head">
              <div className="cdot red blink"></div>
              <span className="ctitle">Live Grass Detection</span>
              <div className="badge-grass ml-auto">
                {backendStatus.grass_detected ? `🌿 ${backendStatus.grass_count} detected` : "No grass"}
              </div>
            </div>
            <div className="video-wrap">
              <img
                src="http://localhost:5000/video_feed"
                alt="Live Detection"
                className="video-feed"
              />
            </div>
            <div className="video-footer dim">
              Updated: {backendStatus.last_updated || "--"}
            </div>
          </div>
        </div> */}

        {/* RIGHT */}
        <div className="col-right">

          <div className="card">
            <div className="card-head">
              <div className="cdot purple"></div>
              <span className="ctitle">Motor Commands</span>
            </div>
            <div className="card-body">
              <div className="tog-row">
                <span className="tog-label">Blade</span>
                <div className="tog-grp">
                  <button className={`tog on ${bladeState===1?"act":""}`} onClick={() => setBlade(1)}>ON</button>
                  <button className={`tog off ${bladeState===0?"act":""}`} onClick={() => setBlade(0)}>OFF</button>
                </div>
              </div>
              <div className="tog-row">
                <span className="tog-label">Pump</span>
                <div className="tog-grp">
                  <button className={`tog on ${pumpState===1?"act":""}`} onClick={() => setPump(1)}>ON</button>
                  <button className={`tog off ${pumpState===0?"act":""}`} onClick={() => setPump(0)}>OFF</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="cdot orange"></div>
              <span className="ctitle">Blade Position</span>
            </div>
            <div className="card-body">
              <div className="bpos-row">
                <button className="bpos-btn up"
                  onMouseDown={() => startBPos("U")} onMouseUp={stopBPos}
                  onMouseLeave={stopBPos} onTouchStart={() => startBPos("U")} onTouchEnd={stopBPos}>
                  ▲ UP
                </button>
                <button className="bpos-btn stp"
                  onMouseDown={() => startBPos("S")} onMouseUp={stopBPos}
                  onMouseLeave={stopBPos} onTouchStart={() => startBPos("S")} onTouchEnd={stopBPos}>
                  ■ STOP
                </button>
                <button className="bpos-btn dn"
                  onMouseDown={() => startBPos("D")} onMouseUp={stopBPos}
                  onMouseLeave={stopBPos} onTouchStart={() => startBPos("D")} onTouchEnd={stopBPos}>
                  ▼ DOWN
                </button>
              </div>
              <div className="dim mt6">
                Command: <strong style={{ color: "var(--accent)" }}>{motorCommands["2_Blade_Position"] || "S"}</strong>
              </div>
            </div>
          </div>

          <div className={`card ${isEmergency ? "card-danger" : ""}`}>
            <div className="card-head">
              <div className={`cdot ${isEmergency ? "red blink" : "green"}`}></div>
              <span className="ctitle">Safety</span>
            </div>
            <div className="card-body">
              <button
                className={`emg-full ${isEmergency ? "act" : ""}`}
                onClick={toggleEmergencyStop}
              >
                {isEmergency ? "⚠ Disable Emergency Stop" : "Enable Emergency Stop"}
              </button>
              <div className="dim mt6">
                Status: <strong style={{ color: isEmergency ? "var(--red)" : "var(--accent)" }}>
                  {isEmergency ? "EMERGENCY ACTIVE" : "Normal Operation"}
                </strong>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CHARTS */}
      <div className="charts-grid">

        <div className="card">
          <div className="card-head">
            <div className="cdot orange"></div>
            <span className="ctitle">Voltage</span>
            <span className="clive orange ml-auto">{lastV(voltageHistory) != null ? lastV(voltageHistory) + " V" : "--"}</span>
          </div>
          <div className="card-body nopt">
            <MiniChart data={voltageHistory} color="#f59e0b" gradId="gvolt" />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="cdot red"></div>
            <span className="ctitle">Temperature</span>
            <span className="clive red ml-auto">{lastV(tempHistory) != null ? lastV(tempHistory) + " °C" : "--"}</span>
          </div>
          <div className="card-body nopt">
            <MiniChart data={tempHistory} color="#f43f5e" gradId="gtemp" />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="cdot blue"></div>
            <span className="ctitle">Humidity</span>
            <span className="clive blue ml-auto">{lastV(humHistory) != null ? lastV(humHistory) + " %" : "--"}</span>
          </div>
          <div className="card-body nopt">
            <MiniChart data={humHistory} color="#38bdf8" gradId="ghum" />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="cdot green"></div>
            <span className="ctitle">Current</span>
            <span className="clive green ml-auto">{lastV(currHistory) != null ? lastV(currHistory) + " A" : "--"}</span>
          </div>
          <div className="card-body nopt">
            <MiniChart data={currHistory} color="#22c55e" gradId="gcurr" />
          </div>
        </div>

      </div>

      {/* BOTTOM */}
      <div className="bottom-grid">

        <div className="card">
          <div className="card-head">
            <div className="cdot blue"></div>
            <span className="ctitle">Sensor Data</span>
          </div>
          <div className="card-body">
            <div className="sensor-grid">
              {sensorItems.map(({ label, value, unit, dot }) => (
                <div className="sensor-item" key={label}>
                  <div className={`cdot ${dot} sm`}></div>
                  <span className="s-lbl">{label}</span>
                  <span className="s-val">
                    {value !== undefined && value !== null && value !== "" ? `${value}${unit}` : "--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="cdot green"></div>
            <span className="ctitle">Robot Status</span>
          </div>
          <div className="card-body">
            <div className="sensor-grid status-g">
              {statusItems.map(({ label, value }) => (
                <div className="sensor-item" key={label}>
                  <div className="cdot green sm"></div>
                  <span className="s-lbl">{label}</span>
                  <span className="s-val">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default App;

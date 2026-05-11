export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createDroneProfileSession(profile, battery, sequence) {
  const startedAt = new Date();
  const capacity = Number(battery.nominalCapacity) || 2;
  const voltageBase = battery.chemistry === "LiFePO4" ? 3.35 : 3.78;
  const temperatureBase = battery.status === "critical" ? 39 : battery.status === "warning" ? 34 : 29;
  const totalDuration = profile.actions.reduce((sum, action) => sum + action.duration, 0);
  let elapsed = 0;
  const readings = profile.actions.flatMap((action) => {
    const points = Math.max(2, Math.round(action.duration / 15));
    const actionReadings = Array.from({ length: points }, (_, index) => {
      const actionProgress = index / Math.max(1, points - 1);
      const missionProgress = (elapsed + action.duration * actionProgress) / totalDuration;
      const pulse = Math.sin(actionProgress * Math.PI) * action.load;
      return {
        time: Math.round(elapsed + action.duration * actionProgress),
        action: action.name,
        voltage: Number(clamp(voltageBase + 0.18 - missionProgress * 0.52 - action.load * 0.04, 2.85, 4.28).toFixed(2)),
        current: Number((profile.currentBase * action.load + pulse * 2.4).toFixed(2)),
        temperature: Number((temperatureBase + missionProgress * profile.temperatureRise + pulse * 2.2).toFixed(1))
      };
    });
    elapsed += action.duration;
    return actionReadings;
  });
  const maxTemperature = Math.max(...readings.map((reading) => reading.temperature));
  const avgVoltage = readings.reduce((sum, reading) => sum + reading.voltage, 0) / readings.length;
  const previousSOH = Number(battery.latestSOH) || 100;
  const soh = clamp(previousSOH - profile.stress * 0.7 - sequence * 0.15, 78, 100);
  const status = maxTemperature >= 45 ? "critical" : maxTemperature >= 38 || soh < 82 ? "warning" : "healthy";
  const testId = sequence + 1;

  return {
    battery: {
      ...battery,
      latestCapacity: Number((capacity * (soh / 100)).toFixed(2)),
      latestSOH: Number(soh.toFixed(1)),
      totalTests: (Number(battery.totalTests) || 0) + 1,
      lastTestAt: startedAt.toISOString(),
      status
    },
    session: {
      sessionId: `${battery.batteryId}-DRONE-${testId}`,
      batteryId: battery.batteryId,
      testId,
      uid: Date.now(),
      type: `${profile.name.toLowerCase()} mission`,
      startTime: startedAt.toISOString(),
      ambientTemperature: temperatureBase,
      capacity,
      re: 0,
      rct: 0,
      status,
      sourceFile: "local drone profile",
      summary: {
        soh: Number(soh.toFixed(1)),
        estimatedSoc: 92,
        maxTemperature,
        avgVoltage: Number(avgVoltage.toFixed(2)),
        samples: readings.length
      },
      readings
    },
    liveReading: {
      batteryId: battery.batteryId,
      mode: "drone-profile",
      status,
      soh: Number(soh.toFixed(1)),
      stream: readings
    }
  };
}

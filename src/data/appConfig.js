import { RadioTower, ShieldCheck } from "lucide-react";

export const statusLabel = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical"
};

export const appUser = {
  name: "Battery Test User",
  role: "User",
  access: ["dashboard", "entry", "profiles", "traceability", "reports"]
};

export const droneProfiles = [
  {
    id: "surveillance",
    name: "Surveillance Drone",
    icon: RadioTower,
    load: "Hover, camera sweep, return, and controlled landing",
    currentBase: 8,
    temperatureRise: 8,
    stress: 0.82,
    actions: [
      { name: "Start motors", duration: 30, load: 1.1 },
      { name: "Lift off", duration: 60, load: 1.45 },
      { name: "Hold altitude", duration: 120, load: 1.05 },
      { name: "Camera sweep left", duration: 60, load: 1.18 },
      { name: "Camera sweep right", duration: 60, load: 1.18 },
      { name: "Return path", duration: 90, load: 1.25 },
      { name: "Descend", duration: 60, load: 0.82 },
      { name: "Touch down", duration: 30, load: 0.55 }
    ]
  },
  {
    id: "racing",
    name: "Racing Drone",
    icon: ShieldCheck,
    load: "Hard lift, sprint, banking, burst, and fast descend",
    currentBase: 14,
    temperatureRise: 14,
    stress: 1.22,
    actions: [
      { name: "Arm and start", duration: 20, load: 1.25 },
      { name: "Hard lift", duration: 45, load: 1.9 },
      { name: "Forward sprint", duration: 75, load: 2.2 },
      { name: "Left bank", duration: 45, load: 1.75 },
      { name: "Right bank", duration: 45, load: 1.75 },
      { name: "Throttle burst", duration: 60, load: 2.35 },
      { name: "Brake and turn", duration: 45, load: 1.65 },
      { name: "Fast descend", duration: 45, load: 1.05 }
    ]
  }
];

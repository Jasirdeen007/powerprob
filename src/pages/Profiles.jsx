import { Activity, BatteryCharging, Gauge, Search, Zap } from "lucide-react";
import MetricCard from "../components/MetricCard";

function Profiles({ profiles, selectedProfileId, onSelectProfile, selectedBattery, batteries, onBatteryChange, onStartTest }) {
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const battery = batteries.find((item) => item.batteryId === selectedBattery) ?? batteries[0];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Drone Profiles</h1>
          <p>Select a drone mission and run its action load against the registered battery.</p>
        </div>
        <span className="status healthy">{battery?.batteryId}</span>
      </div>
      <section className="profiles-layout">
        <div className="profile-grid">
          {profiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <button
                key={profile.id}
                className={`profile-card ${selectedProfile.id === profile.id ? "selected" : ""}`}
                onClick={() => onSelectProfile(profile.id)}
              >
                <span className="profile-icon"><Icon size={22} /></span>
                <strong>{profile.name}</strong>
                <span>{profile.load}</span>
              </button>
            );
          })}
        </div>
        <section className="panel profile-detail">
          <div className="panel-head">
            <h2>{selectedProfile.name}</h2>
            <label className="search-box">
              <Search size={17} />
              <select value={selectedBattery} onChange={(event) => onBatteryChange(event.target.value)}>
                {batteries.map((item) => <option key={item.batteryId}>{item.batteryId}</option>)}
              </select>
            </label>
          </div>
          <div className="profile-specs">
            <MetricCard icon={BatteryCharging} label="Battery" value={battery?.chemistry ?? "-"} detail={`${battery?.nominalCapacity ?? 0} Ah nominal`} />
            <MetricCard icon={Gauge} label="Mission Steps" value={selectedProfile.actions.length} detail={selectedProfile.load} />
            <MetricCard icon={Activity} label="Base Load" value={`${selectedProfile.currentBase.toFixed(1)} A`} detail="Action load changes current draw" />
          </div>
          <div className="action-list">
            {selectedProfile.actions.map((action) => (
              <article key={action.name}>
                <strong>{action.name}</strong>
                <span>{action.duration}s - {action.load.toFixed(2)}x load</span>
              </article>
            ))}
          </div>
          <button className="start-test" onClick={() => onStartTest(selectedProfile, battery)} disabled={!battery}>
            <Zap size={18} /> Run Drone Test
          </button>
        </section>
      </section>
    </>
  );
}

export default Profiles;

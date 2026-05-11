import { useState } from "react";
import { PlusCircle } from "lucide-react";

function BatteryEntry({ data, onAddBattery }) {
  const [form, setForm] = useState({
    batteryId: "",
    chemistry: "Li-ion",
    manufacturer: "Genesis PowerProbe",
    location: "Coimbatore Test Bench",
    nominalCapacity: "2.0",
    status: "healthy"
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const id = form.batteryId.trim().toUpperCase();
    if (!id) return;
    onAddBattery({
      batteryId: id,
      chemistry: form.chemistry,
      manufacturer: form.manufacturer,
      location: form.location,
      nominalCapacity: Number(form.nominalCapacity) || 0,
      latestCapacity: Number(form.nominalCapacity) || 0,
      latestSOH: 100,
      totalTests: 0,
      lastTestAt: new Date().toISOString(),
      status: form.status
    });
    setForm((current) => ({ ...current, batteryId: "" }));
  }

  return (
    <section className="panel wide">
      <div className="panel-head">
        <h2>Battery Detail Entry</h2>
        <span>{data.batteries.length} registered batteries</span>
      </div>
      <form className="entry-form" onSubmit={handleSubmit}>
        <label>
          Battery ID
          <input value={form.batteryId} onChange={(event) => updateField("batteryId", event.target.value)} placeholder="B0100" />
        </label>
        <label>
          Chemistry
          <select value={form.chemistry} onChange={(event) => updateField("chemistry", event.target.value)}>
            <option>Li-ion</option>
            <option>LiFePO4</option>
            <option>NMC</option>
            <option>LCO</option>
          </select>
        </label>
        <label>
          Manufacturer
          <input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} />
        </label>
        <label>
          Test Location
          <input value={form.location} onChange={(event) => updateField("location", event.target.value)} />
        </label>
        <label>
          Nominal Capacity Ah
          <input type="number" step="0.1" min="0" value={form.nominalCapacity} onChange={(event) => updateField("nominalCapacity", event.target.value)} />
        </label>
        <label>
          Initial Status
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <button type="submit"><PlusCircle size={18} /> Add Battery</button>
      </form>
      <div className="entry-list">
        {data.batteries.slice(0, 8).map((battery) => (
          <article key={battery.batteryId}>
            <strong>{battery.batteryId}</strong>
            <span>{battery.chemistry} - {battery.totalTests} sessions - {battery.latestSOH.toFixed(1)}% SOH</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default BatteryEntry;

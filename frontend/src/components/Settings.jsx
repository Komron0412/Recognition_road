import React, { useEffect, useState } from 'react';

const Settings = () => {
    const [settings, setSettings] = useState({
        road_zone_x_percent: 0.6,
        roi_x: 0,
        roi_y: 0,
        roi_w: 100,
        roi_h: 100
    });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/settings/')
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error("Error fetching settings:", err));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: parseFloat(value) }));
    };

    const handleSave = () => {
        fetch('http://127.0.0.1:8000/api/settings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        })
            .then(res => res.json())
            .then(() => setMsg('Settings Saved Successfully!'))
            .catch(err => setMsg('Error saving settings'));
    };

    return (
        <div style={{ padding: '20px', color: 'black', background: 'white', maxWidth: '600px', margin: 'auto' }}>
            <h2>System Settings</h2>

            <div style={{ marginBottom: '20px' }}>
                <label>Road Zone Line (X Percent): {settings.road_zone_x_percent}</label>
                <input
                    type="range"
                    min="0" max="1" step="0.05"
                    name="road_zone_x_percent"
                    value={settings.road_zone_x_percent}
                    onChange={handleChange}
                    style={{ width: '100%' }}
                />
                <small>Adjust where the road starts (Left 0.0 to Right 1.0)</small>
            </div>

            {/* Simple ROI inputs for now - could be a drag selector later */}
            <h3>Traffic Light ROI (Top Left Analysis)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                    <label>ROI X: </label>
                    <input type="number" name="roi_x" value={settings.roi_x} onChange={handleChange} />
                </div>
                <div>
                    <label>ROI Y: </label>
                    <input type="number" name="roi_y" value={settings.roi_y} onChange={handleChange} />
                </div>
                <div>
                    <label>ROI Width: </label>
                    <input type="number" name="roi_w" value={settings.roi_w} onChange={handleChange} />
                </div>
                <div>
                    <label>ROI Height: </label>
                    <input type="number" name="roi_h" value={settings.roi_h} onChange={handleChange} />
                </div>
            </div>

            <button onClick={handleSave} style={{ marginTop: '20px', padding: '10px 20px', background: 'blue', color: 'white' }}>
                Save Settings
            </button>
            {msg && <p style={{ color: 'green' }}>{msg}</p>}
        </div>
    );
};

export default Settings;

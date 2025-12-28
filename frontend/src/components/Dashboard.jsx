import React, { useEffect, useState } from 'react';

const Dashboard = () => {
    const [violations, setViolations] = useState([]);

    const fetchViolations = () => {
        fetch('http://127.0.0.1:8000/api/violations/')
            .then(res => res.json())
            .then(data => setViolations(data))
            .catch(err => console.error("Error fetching violations:", err));
    };

    useEffect(() => {
        fetchViolations();
    }, []);

    const deleteViolation = (id) => {
        if (!window.confirm("Are you sure you want to delete this violation?")) return;

        fetch(`http://127.0.0.1:8000/api/violations/${id}/`, {
            method: 'DELETE',
        })
            .then(res => {
                if (res.ok) {
                    fetchViolations(); // Refresh list
                } else {
                    alert("Failed to delete violation");
                }
            })
            .catch(err => console.error("Error deleting:", err));
    };

    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h2>Violation History</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black', background: 'white' }}>
                <thead>
                    <tr style={{ background: '#ddd', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th style={{ padding: '10px' }}>Type</th>
                        <th style={{ padding: '10px' }}>Time</th>
                        <th style={{ padding: '10px' }}>Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    {violations.map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{v.id}</td>
                            <td style={{ padding: '10px' }}>{v.violator_name}</td>
                            <td style={{ padding: '10px' }}>{v.violation_type}</td>
                            <td style={{ padding: '10px' }}>{new Date(v.timestamp).toLocaleString()}</td>
                            <td style={{ padding: '10px' }}>
                                <video
                                    width="200"
                                    height="150"
                                    controls
                                    style={{ borderRadius: '8px' }}
                                >
                                    <source src={`http://127.0.0.1:8000/media/${v.video_file}`} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </td>
                            <td style={{ padding: '10px' }}>
                                <button
                                    onClick={() => deleteViolation(v.id)}
                                    style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Dashboard;

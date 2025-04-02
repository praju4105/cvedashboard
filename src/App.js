import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import './App.css'; // Your original CSS file
import logo from './assests/download.png'; // Ensure this path is correct

// Helper function to get initial theme (checks local storage first)
const getInitialTheme = () => {
    const storedTheme = localStorage.getItem('cveDashboardTheme');
    // Default to 'light' if nothing stored or invalid value
    return storedTheme === 'dark' ? 'dark' : 'light';
};

// Key for local storage for seen CVEs
const SEEN_CVE_IDS_KEY = 'seenCveIds';

function App() {
    const [cves, setCves] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});
    const [isLoading, setIsLoading] = useState(true); // --- Loading State ---
    const [theme, setTheme] = useState(getInitialTheme); // --- Theme State ---
    const [seenCveIds, setSeenCveIds] = useState(() => { // --- Seen CVEs State ---
        try {
            const storedIds = localStorage.getItem(SEEN_CVE_IDS_KEY);
            return storedIds ? new Set(JSON.parse(storedIds)) : new Set();
        } catch (e) {
            console.error("Error reading seen CVE IDs from localStorage", e);
            return new Set(); // Start fresh if storage is corrupted
        }
    });

    // --- Effect for storing theme preference ---
    useEffect(() => {
        localStorage.setItem('cveDashboardTheme', theme);
        // We will apply the theme class to the main container div directly
    }, [theme]);

    // --- Effect for Fetching Data ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('http://localhost:3000/api/cves'); // Ensure API endpoint is correct
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                let data = await response.json();

                let currentCveIds = [];
                if (Array.isArray(data)) {
                    currentCveIds = data.map(cve => cve.cve_id);
                    const newSeenIds = new Set(currentCveIds);

                    // Add 'isNew' flag
                    data = data.map(cve => ({
                        ...cve,
                        // Mark as new if its ID wasn't in the set loaded *before* this fetch
                        isNew: !seenCveIds.has(cve.cve_id)
                    }));

                    // Update localStorage with the *current* set of IDs for the *next* visit
                    try {
                        // Limit stored data size if needed, e.g., only store recent IDs
                        localStorage.setItem(SEEN_CVE_IDS_KEY, JSON.stringify(Array.from(newSeenIds)));
                    } catch (e) {
                         console.error("Error saving seen CVE IDs to localStorage", e);
                    }
                } else {
                    console.warn("Received non-array data from API:", data);
                    data = [];
                }
                setCves(data);

            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to fetch CVE data. Please ensure the API is running and returns valid data.');
                setCves([]);
            } finally {
                setIsLoading(false); // Stop loading
            }
        };

        fetchData();
        // No dependency on seenCveIds here - we want the 'isNew' check based on the state *before* the fetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Filtering and Sorting (Using useMemo for efficiency) ---
    const safeCves = useMemo(() => (Array.isArray(cves) ? cves : []), [cves]);

    const filteredCves = useMemo(() => safeCves.filter(cve =>
        cve.cve_id?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [safeCves, searchTerm]);

    const topCvesByDate = useMemo(() => {
        return [...safeCves].sort((a, b) => {
            const dateA = new Date(a.updated_at);
            const dateB = new Date(b.updated_at);
            if (isNaN(dateA) && isNaN(dateB)) return 0;
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            return dateB - dateA;
        }).slice(0, 5);
    }, [safeCves]);

    const mostSevereCves = useMemo(() => {
         return [...safeCves].sort((a, b) => {
            const scoreA = (Number(a.cvss_score) || 0) + (Number(a.epss_score) || 0);
            const scoreB = (Number(b.cvss_score) || 0) + (Number(b.epss_score) || 0);
            return scoreB - scoreA;
        }).slice(0, 5);
    }, [safeCves]);

    // --- Event Handlers ---
    const toggleExpand = useCallback((id) => { // useCallback for stability if passed down
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const toggleTheme = useCallback(() => { // useCallback
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    }, []);

    // --- CSV Functions (Keep existing) ---
    const escapeCSVField = useCallback((field) => {
         if (field === null || field === undefined) { return ''; }
         const stringField = String(field);
         if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
             const escapedField = stringField.replace(/"/g, '""');
             return `"${escapedField}"`;
         }
         return stringField;
     }, []);

    const convertToCSV = useCallback((data) => {
        if (!data || data.length === 0) { return ''; }
        const headers = ['CVE ID', 'Title', 'Description', 'Status', 'CVSS Score', 'EPSS Score', 'Updated At'];
        const keys = ['cve_id', 'title', 'description', 'status', 'cvss_score', 'epss_score', 'updated_at'];
        const headerRow = headers.map(escapeCSVField).join(',');
        const dataRows = data.map(row =>
            keys.map(key => escapeCSVField(row[key])).join(',')
        );
        return [headerRow, ...dataRows].join('\n');
    }, [escapeCSVField]);

    const downloadCSV = useCallback((csvData, filename) => {
        if (!csvData) { console.warn("No data to download."); return; }
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            console.error("CSV download not supported in this browser.");
            setError("CSV download not fully supported in this browser.");
        }
    }, [setError]); // Added setError dependency

    const handleDownloadFiltered = useCallback(() => {
        const csvData = convertToCSV(filteredCves);
        downloadCSV(csvData, `filtered_cves_${new Date().toISOString().split('T')[0]}.csv`);
    }, [filteredCves, convertToCSV, downloadCSV]);

    const handleDownloadAll = useCallback(() => {
        const csvData = convertToCSV(safeCves); // Use memoized safeCves
        downloadCSV(csvData, `all_cves_${new Date().toISOString().split('T')[0]}.csv`);
    }, [safeCves, convertToCSV, downloadCSV]);
    // --- End CSV Functions ---

    return (
        // Apply theme class directly to the main container
        <div className={`container ${theme}-theme`}>
            {/* Header Section */}
            <header className="header">
                {/* Keep original header structure if preferred */}
                 <img src={logo} alt="Logo" className="logo" />
                 <h1>CVE Dashboard</h1>
                 {/* Add Theme Toggle Button Here */}
                 <button onClick={toggleTheme} className="theme-toggle-button" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
                     {theme === 'light' ? '🌙' : '☀️'} {/* Simple icon toggle */}
                 </button>
            </header>

            {/* --- Loading Indicator --- */}
            {isLoading && <div className="loading-indicator">Loading...</div>}

            {/* Display error ONLY if not loading */}
            {!isLoading && error && <div className="error">{error}</div>}

            {/* Display content ONLY if not loading */}
            {!isLoading && !error && ( // Also hide content on error if desired
                <>
                    <div className="controls-container">
                        <input
                            type="text"
                            placeholder="Search CVE ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input" // Use existing class
                            disabled={isLoading}
                        />
                        <div className="button-group">
                            <button onClick={handleDownloadFiltered} className="download-button" disabled={isLoading || filteredCves.length === 0}>
                                Download Filtered CSV
                            </button>
                            <button onClick={handleDownloadAll} className="download-button" disabled={isLoading || safeCves.length === 0}>
                                Download All CSV
                            </button>
                        </div>
                    </div>

                    <div className="grid-container">
                        {/* Main CVE Table */}
                        <div className="main-content">
                             {/* Added check for safeCves length before filtering */}
                            {safeCves.length > 0 ? (
                                filteredCves.length > 0 ? (
                                    <table>
                                        <thead>
                                            {/* Keep existing thead structure */}
                                            <tr>
                                                <th>CVE ID</th>
                                                <th>Title</th>
                                                <th>Description</th>
                                                <th>Status</th>
                                                <th>CVSS Score</th>
                                                <th>EPSS Score</th>
                                                <th>Updated At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCves.map(cve => (
                                                // Add 'new-cve' class conditionally
                                                <tr key={cve.cve_id} className={cve.isNew ? 'new-cve' : ''}>
                                                    <td>
                                                        {/* Simple dot indicator for new CVEs */}
                                                        {cve.isNew && <span className="new-indicator" title="New since last visit">●</span>}
                                                        {cve.cve_id}
                                                    </td>
                                                    <td>{cve.title || 'N/A'}</td>
                                                    <td
                                                        className={`description-cell ${expandedRows[cve.cve_id] ? 'expanded' : ''}`}
                                                        onClick={() => toggleExpand(cve.cve_id)}
                                                        title="Click to expand/collapse"
                                                    >
                                                        {cve.description ?
                                                            (expandedRows[cve.cve_id] ? cve.description : cve.description.slice(0, 50) + (cve.description.length > 50 ? '...' : ''))
                                                            : 'No description available.'}
                                                    </td>
                                                    <td>{cve.status || 'N/A'}</td>
                                                    <td>{cve.cvss_score ?? 'N/A'}</td>
                                                    <td>{cve.epss_score ?? 'N/A'}</td>
                                                    <td>{cve.updated_at ? new Date(cve.updated_at).toLocaleDateString() : 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                     <p>No CVEs found matching your search "{searchTerm}".</p>
                                )
                            ) : (
                                <p>No CVE data loaded.</p> // Message when initial load is empty
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="sidebar">
                            <h2>Top 5 CVEs by Update Date</h2>
                            {topCvesByDate.length > 0 ? (
                                <ul> {topCvesByDate.map(cve => <li key={cve.cve_id}><strong>{cve.cve_id}</strong> - {cve.title || 'N/A'} ({cve.updated_at ? new Date(cve.updated_at).toLocaleDateString() : 'N/A'})</li>)} </ul>
                            ) : (<p>No CVEs to display.</p>)}

                            <h2>Top 5 Most Severe CVEs</h2>
                            {mostSevereCves.length > 0 ? (
                                <ul> {mostSevereCves.map(cve => <li key={cve.cve_id}><strong>{cve.cve_id}</strong> - CVSS: {cve.cvss_score ?? 'N/A'}, EPSS: {cve.epss_score ?? 'N/A'}</li>)} </ul>
                            ) : (<p>No CVEs to display.</p>)}
                        </div>
                    </div>
                </>
            )}

            {/* Footer Section */}
            <footer className="footer">
                <p>© 2025 CVE Dashboard. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default App;
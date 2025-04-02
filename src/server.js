const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());

const cveData = [
    {
        "cve_id": "CVE-2025-23120",
        "title": "Veeam and IBM Release Patches",
        "description": "RCE in Veeam Backup & Replication hrfhfhetjfetojithqiehiqheihqfqeijhhfiqehiqethjijijftjtjotjotjjjjgijgjgkqjgjgi42j24i4jgkjgqgjgwjngwgnwjngwjngqjtgjqng2jtngqjtngqjong2o4jtng24jgn2jgn2jgn",
        "status": "updated",
        "cvss_score": 9.9,
        "epss_score": 0.00455,
        "updated_at": "2025-03-28T00:28:14.474398Z"
    },
    {
        "cve_id": "CVE-2025-23121",
        "title": "Another CVE",
        "description": "A different issue jjonfqjrnjnfqojgn1jngjnqjgnojgn1oj5gn14g o4og 4gn4gn14jgn4jgn14jgn14jgn",
        "status": "new",
        "cvss_score": 7.5,
        "epss_score": 0.002,
        "updated_at": "2025-03-27T12:00:00.000000Z"
    },
    {
        "cve_id": "CVE-2025-23122",
        "title": "Yet Another CVE",
        "description": "Another unique problem",
        "status": "updated",
        "cvss_score": 8.0,
        "epss_score": 0.005,
        "updated_at": "2025-03-29T18:30:00.000000Z"
    }
];

app.get('/api/cves', (req, res) => {
    res.json(cveData);
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
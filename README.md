# QSR-Enterprise-API
An NPM package for interaction with QSR Automation's Enterprise API.

The module exposes a QSR Class, see [docs/qsr-enterprise-api/0.1.0/QSR.html](/docs/qsr-enterprise-api/0.1.0/QSR.html)

*This package is in need of thorough testing.*

## Quickstart:
```
npm i qsr-enterprise-api
```
```javascript
const QSR = require('qsr-enterprise-api');

const companyUID = 'ABC123';  // Company UID provided by QSR
const qsr = new QSR(companyUID);

// Get all visits for yesterday
const getVisits = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const siteUID = 'ZYX987';  // Site UID 
    const visits = await qsr.getAllVisitUpdates(siteUID, yesterday, today).catch(err => {
        console.error(err);
    })
    
    console.log(visits.length);
};

getVisits();
```



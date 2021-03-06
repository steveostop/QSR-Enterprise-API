/**
 * QSR Class File
 * @author Steve Ostopchuck
 */
const crypto = require('crypto');

/**
 *  Class for interacting with the QSR Enterprize API 
 */
class QSR {
    'use strict'
    /**
     * Create a QSR instance.
     * @param {string} companyUID - Globally unique identifier for a company. This is provided by QSR.
     * @param {Object} [apiKeys] - Optional. API Keys Object.
     * @param {string} [apiKeys.accessKey] - Optional. Access Key provided by QSR. Defaults to environment variable QSR_ACCESSKEY.
     * @param {string} [apiKeys.secretKey] - Optional. Secret Key provided by QSR. Defaults to environment variable QSR_SECRETKEY.
     */
    constructor(companyUID, apiKeys = {
        accessKey: process.env.QSR_ACCESSKEY,
        secretKey: process.env.QSR_SECRETKEY
    }) {
        if (!companyUID) throw "QSR Error: Cannot instantiate object, companyUID missing.";
        if (!apiKeys.accessKey) throw "QSR Error: Cannot instantiate object, apiKeys.accessKey missing.";
        if (!apiKeys.secretKey) throw "QSR Error: Cannot instantiate object, apiKeys.secretKey missing.";
        
        this.companyUID = companyUID;
        this.accessKey = apiKeys.accessKey;
        this.secretKey = apiKeys.secretKey;
        this.axios = require('axios');
        this.axios.defaults.baseURL = 'https://api.dinetime.com'

        this.axios.interceptors.request.use(config => {
            // Step 1: Create a Canonical Request
            const requestMethod = config.method.toUpperCase() || 'GET';
            const canonicalUrl = encodeURIComponent(config.url);
            const params = new URLSearchParams(config.params);
            params.sort();
            const body = (new URLSearchParams(config.data ? config.data : '')).toString();
            const bodyHexHash = crypto.createHash('SHA256').update(body).digest('hex');
            const canonicalRequeast = `${requestMethod}&${canonicalUrl}&${params.toString()}&${bodyHexHash}`;

            // Step 2: Create a String to Sign
            const algorithm = 'HMAC-SHA1';
            const isoDate = (new Date()).toISOString();
            const crHexHash = crypto.createHash('SHA256').update(canonicalRequeast).digest('hex');
            const stringToSign = `${algorithm}&${isoDate}&${this.accessKey}&${crHexHash}`;

            // Step 3: Create the Signature
            const signature = crypto.createHmac('SHA1', this.secretKey).update(stringToSign).digest('hex');

            // Step 4: Add Sigining Inforation to the Request
            const sigVersion = 'dinetime-sv2-hmac-sha1'
            config.headers.Authorization = `${sigVersion} Algorithm=SHA256&Credentials=${this.accessKey}&Signature=${signature}`
            
            // Add other required headers
            config.headers['x-dinetime-timestamp'] = isoDate;
            config.headers['x-dinetime-signature-version'] = sigVersion;

            return config;
        }, err => { return Promise.reject(err) });
    }

    /**
     * Internal error handling function
     * @param {Object} err - The error thrown by axios
     */
    #errorHandler(err) {
        switch (err.response?.status) {
            case 401:
            case 403:
                console.error('QSR Error: Not Authorized')
                break;
            case 404:
                console.error('QSR Error: The visit was not found.');
                break;
            case 405:
                console.error('QSR Error: The visit has already arrived or been seated.');
                break;
            case 410:
                console.error('QSR Error: The WebAhead is no longer considered Active.');
                break;
            case 500:
                console.error('QSR Error: API server error')
                break;
            default:
                break;
        }
        throw err;
    }

    /**
     * Get information of all active sites for a company by CompanyUID.
     * @returns {Site[]} - A collection of Site objects
     */
    async getCompanySites() {
        const config = {
            url: `/Company/${this.companyUID}/Sites`,
            method: 'GET',
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get information for a site by SiteUID.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @returns {Site} - Site object
     */
    async getSite(siteUID) {
        const config = {
            url: `/Site/${siteUID}`,
            method: 'GET',
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get information about Concepts by CompanyUID.
     * @returns {string} - BrandUID - A globally unique identifier for a Brand/Concept
     */
    async getBrands() {
        const config = {
            url: `/Companies/${this.companyUID}/Brands`,
            method: 'GET',
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get SiteUID and CustomerSiteID for all sites within a Company.
     * @param {boolean} onlyActiveSites If true, only records for active sites returned.
     * @returns {string} - CustomerSiteID - Customizable site identifier
     */
    async getCustomerSiteIdMap(onlyActiveSites) {
        const config = {
            url: `/Companies/${this.companyUID}/Sites/CustomerSiteIdMap`,
            method: 'GET',
            params: {}
        };
        if (onlyActiveSites) config.params[getOnlyActiveSites] = true ;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get the list of operating information.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @returns {OperatingInfo[]} - Collection of operating information.
     */
    async getOperatingInfo(siteUID) {
        const config = {
            url: `/Site/${siteUID}/operatingInfo`,
            method: 'GET',
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Gets the list of team members for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @returns {TeamMember[]} - Collection of TeamMember.
     */
    async getTeamMembers(siteUID, startTime, endTime) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers`,
            method: 'GET',
            params: {}
        };
        if (startTime) config.params['startTime'] = startTime.toISOString();
        if (endTime) config.params['endTime'] = endTime.toISOString();
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get the list of all team member events for the specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @param {number} [numPages] - Optional. Limit number of pages (100 records) to return.
     * @returns {TeamMemberEvent[]} - Collection of TeamMemberEvent.
     */
    async getAllTeamMemberEvents(siteUID, startTime, endTime, numPages = 0) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers/Events`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const data = [];
        let response;
        do {
            response = await this.axios.request(config).catch(this.#errorHandler);
            data.push(...response.data.Events)
            config.params.startTime = response.data.TimeStampCutoff;
            numPages--;
        } while (response.data.MoreData && numPages !== 0);
        return data;
    }

    /**
     * Get the paged list of team member events for the specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records.  Page size is 100.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @returns {TeamMemberEventPage} - TeamMemberEventPage.
     */
     async getTeamMemberEvents(siteUID, startTime, endTime) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers/Events`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const data = [];
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Add team members to the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {TeamMember} teamMember - TeamMember object to add
     * @returns {TeamMember[]} - Collection of TeamMember.
     */
    async addTeamMember(siteUID, teamMember) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers`,
            method: 'POST',
            data: teamMember
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Update team members for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} teamMemberId - Globally unique identifier of the TeamMember record.
     * @param {TeamMemeber} teamMemberUpdate - TeamMember object to update from.
     * @returns {TeamMemeber[]} - Collection of TeamMember.
     */
    async updateTeamMember(siteUID, teamMemberId, teamMemberUpdate) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers/${teamMemberId}`,
            method: 'PATCH',
            data: teamMemberUpdate
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Delete team members for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} teamMemberId - Globally unique identifier of the TeamMember record.
     * @returns {boolean} - Returns true if successful.
     */
    async removeTeamMember(siteUID, teamMemberId, teamMemberUpdate) {
        const config = {
            url: `/Site/${siteUID}/TeamMembers/${teamMemberId}`,
            method: 'DELETE',
            data: teamMemberUpdate
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Gets the list of tables for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @returns {Object[]} - Collection of Table objects.
     */
    async getTables(siteUID) {
        const config = {
            url: `/Site/${siteUID}/Tables`,
            method: 'GET'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    } 

    /**
     * Gets the list of table statuses for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time in ISO 8601 format.
     * @param {Date} endTime - End time in ISO 8601 format.
     * @returns {TableStatus[]} - Collection of Table statuses.
     */
    async getTableStatus(siteUID, startTime, endTime) {
        const config = {
            url: `/Site/${siteUID}/Tables/Status`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get the list of all table history updates for a specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @param {number} [numPages] - Optional. Limit number of pages (100 records) to return.
     * @returns {TableHistory[]} - Collection of TableHistory.
     */
    async getAllTableHistory(siteUID, startTime, endTime, numPages = 0) {
        const config = {
            url: `/Site/${siteUID}/Tables/History`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const data = [];
        let response;
        do {
            response = await this.axios.request(config).catch(this.#errorHandler);
            data.push(...response.data.History)
            config.params.startTime = response.data.TimeStampCutoff;
            numPages--;
        } while (response.data.HasMoreData && numPages !== 0);
        return data;
    }

    /**
     * Get the paged list of table history updates for a specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records. Page size is 100.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @returns {TableHiTableHistoryPage} - TableHiTableHistoryPage.
     */
     async getTableHistory(siteUID, startTime, endTime) {
        const config = {
            url: `/Site/${siteUID}/Tables/History`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const data = [];
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get the list of all table events updates for a specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records. 
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @param {number} [numPages] - Optional. Number of pages (100 records) to return.
     * @returns {TableEvent[]} - Collection of TableEvent.
     */
    async getAllTableEvents(siteUID, startTime, endTime, numPages = 0) {
        const config = {
            url: `/Site/${siteUID}/Tables/Events`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const data = [];
        let response;
        do {
            response = await this.axios.request(config).catch(this.#errorHandler);
            data.push(...response.data.Events)
            config.params.startTime = response.data.TimeStampCutoff;
            numPages--;
        } while (response.data.MoreData && numPages !== 0);
        return data;
    }

    /**
     * Get the paged list of table events updates for a specified site within a specified time range. 
     * This is ordered by last server update timestamp of the records. Page size is 100.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} startTime - Start time of updates.
     * @param {Date} endTime - End time of updates.
     * @returns {TableEventPage} - TableEventPage.
     */
     async getTableEvents(siteUID, startTime, endTime) {
        const config = {
            url: `/Site/${siteUID}/Tables/Events`,
            method: 'GET',
            params: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Raise a table event for the specified table at the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Object} info - The table event to post.
     * @param {string} info.eventType - Type of TableEvent. The following are considered acceptable values: CheckPaid, TableScanned, CheckPartialPayment, CourseComplete, CheckPrinted, ItemsOrdered, TableOpened, TableCleared, TableDirtied.
     * @param {string} info.tableName - Name of the specified table.
     * @param {string} info.timestampUtc - Time stamp of the TableEvent in UTC (in ISO8601 format).
     * @param {number} [info.transactionNumber] - Time stamp of the TableEvent in UTC (in ISO8601 format).
     * @param {number} [info.checkAmount] - Time stamp of the TableEvent in UTC (in ISO8601 format).
     * @param {string} [info.id] - Time stamp of the TableEvent in UTC (in ISO8601 format).
     * @returns {boolean} - True if is successful.
     */
    async addTableEvent(siteUID, info = {}) {
        const config = {
            url: `/Site/${siteUID}/Visit/TableEvent`,
            method: 'POST',
            data: {
                EventType: info.eventType,
                TableName: info.tableName,
                TimstampUtc: info.timestampUtc
            }
        };
        if (info.transactionNumber) config.data.TransactionNumber = info.transactionNumber;
        if (info.checkAmount) config.data.CheckAmount = info.checkAmount;
        if (info.id) config.data.ID = info.id;
        const response = await this.axios.request(config).catch(this.#errorHandler);   
        return response.status === 200;
    }


    /**
     * Arrive a Visit.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - Globally unique identifier for a QSR visit record (WebAhead, reservation, or walk-in).
     * @returns {boolean} - Returns true is successful.
     */
    async arriveReservation(siteUID, visitID) {
        const config = {
            url: `/Site/${siteUID}/reservations/${visitID}/Arrive`,
            method: 'POST'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Gets the reservation availability for the specified site, the target business date, and target party size.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Date} date - Target date.
     * @param {number} partySize - Size of the party.
     * @returns {ReservationAvailabilityDay[]} - Collection of ReservationAvailabilityDay, each representing availability for a calendar date. 
     */
    async getReservationAvailability(siteUID, date, partySize) {
        const config = {
            url: `/Site/${siteUID}/reservations/availability`,
            method: 'GET',
            params: {
                date: date.toISOString(),
                partySize: Math.floor(partySize)
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Gets the reservation visit for the specified site and the specified confirmation number.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} confimationNumber - Confirmation number of the reservation.
     * @returns {Visit} - QSR visit record.
     */
    async getReservationByConfirmation(siteUID, confimationNumber) {
        const config = {
            url: `/site/${siteUID}/reservations`,
            method: 'GET',
            params: {
                conf: confimationNumber
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Adds a reservation to the site for the specified date and time.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Object} info - Information for the reservation.
     * @param {Date} info.arrivalTime - Reservation time.
     * @param {number} info.partySize - Party size of the reservation.
     * @param {string} [info.email] - Optional. Email of the guest.
     * @param {string} [info.firstName] - Optional. First name of the guest.
     * @param {string} [info.lastName] - Optional. Last name of the guest.
     * @param {string} [info.guestId] - Optional. Unique identifier of a guest record. 
     * @param {boolean} [info.subedToSms] - Optional. Flag to indicate whether guest is subscribed to SMS marketing. 
     * @param {boolean} [info.subedToEmail] - Optional. Flag to indicate whether guest is subscribed to email marketing. 
     * @param {boolean} [info.subedToQsr] - Optional. Flag to indicate whether guest is subscribed to QSR's marketing. 
     * @param {string} [info.notes] - Optional. Notes of the reservation. 
     * @param {string} [info.pagerId] - Optional. ID number of associated pager. 
     * @param {string} [info.phoneNumber] - Optional. Phone number of the guest, numeric only. 
     * @param {string} [info.phoneNumberString] - Optional. Phone number of the guest, formatted.
     * @param {string} [info.seatingAreaUID] - Optional. Unique identifier of the expected seating area for the reservation.
     * @param {string} [info.notificationType] - Optional. Set Notification Type to None, Call, SMS, or Pager.
     * @returns {Visit} - QSR visit record.
     */
     async addReservation(siteUID, info) {
        const config = {
            url: `/site/${siteUID}/reservations`,
            method: 'GET',
            params: {
                EstimatedArrivalTime: arrivalTime.toISOString(),
                PartySize: Math.floor(info.partSize)
            }
        };
        if (info.email) params.Email = info.email;
        if (info.firstName) params.FirstName = info.firstName;
        if (info.lastName) params.LastName = info.lastName;
        if (info.guestId) params.GuestId = info.guestId;
        if (info.subedToSms) params.IsSubscribedToSmsMarketing = info.subedToSms;
        if (info.subedToEmail) params.IsSubscribedToEmailMarketing = info.subedToEmail;
        if (info.subedToQsr) params.IsSubscribedToQsrMarketing = info.subedToQsr;
        if (info.notes) params.Notes = info.notes;
        if (info.pagerId) params.PagerId = info.pagerId;
        if (info.phoneNumber) params.PhoneNumber = info.phoneNumber;
        if (info.phoneNumberString) params.PhoneNumberString = info.phoneNumberString;
        if (info.seatingAreaUID) params.SeatingAreaUID = info.seatingAreaUID;
        if (info.notificationType) params.NotificationType = info.notificationType;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Adds a reservation to the site for the specified date and time.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitUID - Globally unique identifier for a site.
     * @param {Object} info - Information for the reservation.
     * @param {Date} info.arrivalTime - Reservation time.
     * @param {number} info.partySize - Party size of the reservation.
     * @param {string} [info.notes] - Optional. Notes of the reservation. 
     * @param {string} [info.pagerId] - Optional. ID number of associated pager. 
     * @param {string} [info.phoneNumber] - Optional. Phone number of the guest, numeric only. 
     * @param {string} [info.notificationType] - Optional. Set Notification Type to None, Call, SMS, or Pager.
     * @param {string} [info.foodAllergies] - Optional. The guest's food allergies.
     * @returns {boolean} - True if successful.
     */
     async updateReservation(siteUID, visitID, info) {
        const config = {
            url: `/site/${siteUID}/reservations/${visitID}`,
            method: 'PATCH'
        };
        if (info.arrivalTime) params.EstimatedArrivalTime = info.arrivalTime;
        if (info.partySize) params.PartySize = Math.floor(info.partySize);
        if (info.notes) params.Notes = info.notes;
        if (info.pagerId) params.PagerId = info.pagerId;
        if (info.phoneNumber) params.PhoneNumber = info.phoneNumber;
        if (info.notificationType) params.NotificationType = info.notificationType;
        if (info.foodAllergies) params.FoodAllergies = info.foodAllergies;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Cancel the specified reservation visit for the specified site.
     * Note: Sync bypasses thea vailability check.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitUID - Globally unique identifier for a site.
     * @returns {boolean} - True if successful.
     */
    async removeReservation(siteUID, visitUID) {
        const config = {
            url: `/site/${siteUID}/reservations/${visitID}`,
            method: 'DELETE'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Sync a reservation record to DineTime Enterprise.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {*} externalId - External identifier of the reservation.
     * @param {Object} info - External reservation information.
     * @param {string} info.arrivalTime - Required for new reservation, Optional for exiting.  Reservation Time.
     * @param {number} info.partySize - Party size of the reservation.
     * @param {Guest} info.guest - Required for new reservation, Optional for exiting. Guest record of the reservation.
     * @param {number} info.size - Required for new reservation, Optional for exiting. Party size of the reservation.
     * @param {Date} [info.canceledTime] - Optional. Reservation cancellation timestamp.
     * @param {Object[]} [info.customValues] - Optional. Collection of VisitCustomValue objects representing visit custom value.
     * @param {string} [info.notes] - Optional. Notes of the reservation cancellation timestamp.
     * @param {Object} [info.partyMix] - Optional. Visit party mix data.
     * @param {string} [info.syncSource] - Optional. String representing source of the reservation record.
     * @returns {boolean} - True if successful.
     */
    async syncExternalReservation(siteUID, externalId, info) {
        const config = {
            url: `/site/${siteUID}/externalreservations/${externalId}`,
            method: 'PUT'
        };
        if (info.arrivalTime) params.EstimatedArrivalTime = info.arrivalTime;
        if (info.partySize) params.PartySize = Math.floor(info.partySize);
        if (info.guest) params.Guest = info.guest;
        if (info.size) params.Size = Math.floor(info.size);
        if (info.canceledTime) params.CanceledTime = info.canceledTime;
        if (info.customValues) params.CustomValues = info.customValues;
        if (info.notes) params.Notes = info.notes;
        if (info.partyMix) params.PartyMix = info.partyMix;
        if (info.syncSource) params.SyncSource = info.syncSource;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Adds an arrived WalkIn visit. 
     * Providing Guest.ID or Guest.Loyalty.LoyaltyCardID indicates an existing QSR guest record.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {*} info - WalkIn information.
     * @param {number} info.partySize - Party size of the reservation.
     * @param {string} [info.arrivalTime] - Optional. Arrival Time.
     * @param {string} [info.externalId] - Optional. External identifier of the visit.
     * @param {Guest|string} [info.guest] - Optional. Guest record of the reservation | Guest.ID or Guest.Loyalty.LoyaltyCardID
     * @param {string} [info.notes] - Optional. Notes of the reservation cancellation timestamp.
     * @returns {Visit} - QSR visit record. 
     */
    async addWalkIn(siteUID, info) {
        const config = {
            url: `/Site/${siteUID}/WalkIn`,
            method: 'POST'
        };
        if (info.partySize) params.PartySize = Math.floor(info.partySize);
        if (info.arrivalTime) params.ArrivalTime = info.arrivalTime;
        if (info.externalId) params.ExternalID = info.externalId;
        if (info.guest) params.Guest = info.guest;
        if (info.notes) params.Notes = info.notes;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a list of all sites associated with the partner on the API key.
     * @param {number} [numSites] - Optional.  Number of sites to return. Default all.
     * @returns {Object[]} - Associated sites.
     */
    async getAllPartnerSites(numSites = 0) {
        const config = {
            url: `/Site/Sites`,
            method: 'GET'
        };
        const data = [];
        let response;
        do {
            response = await this.axios.request(config).catch(this.#errorHandler);
            data.push({
                pageData: response.data.pageData,
                siteUID: response.data.SiteUID,
                externalSiteID: response.data.ExternalSiteID
            });
            config.params = { Token: response.data.Token };
            numSites--;
        } while (response.data.HasMore && numSites !== 0);
        return data;
    }

    /**
     * Get a list of all sites associated with the partner on the API key.
     * @param {number} [numSites] - Optional.  Number of sites to return. Default all.
     * @returns {GetPartnerSites} - GetPartnerSites.
     */
     async getPartnerSites(numSites = 0) {
        const config = {
            url: `/Site/Sites`,
            method: 'GET'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Adds a WebAhead, therefore adding the specified party to the Waitlist.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {Object} info - Information object for WebAhead.
     * @param {number} info.partySize - Party Size
     * @param {string} info.phoneNumberString - Formatted phone number string.
     * @param {string} info.lastName - Optional if GuestID is provided.  Last name.
     * @param {string} [info.firstName] - First name
     * @param {string} [info.email] - Email
     * @param {string} [info.guestID] - Unique identifier of a QSR guest record. If GuestID is provided, guest information provided will be applied to the specified guest record.
     * @param {string} [info.estimatedArrivalTime] - Estimated arrival time in ISO 8601 format.
     * @param {boolean} [info.expandGuest] - Specifies whether a guest record should be included in the returned WebAhead data.
     * @param {string} [info.notes] - Notes
     * @param {string} [info.notificationType] - Set Notification Type to None, Call, SMS, or Pager.
     * @param {boolean} [info.isSubedToSms] - Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [info.isSubedToEmail] - Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [info.isSubedToQsr] - Flag to indicate whether guest subscribes to QSR's marketing.
     * @returns {boolean} - True if post is successful.
     */
    async addWalkIn(siteUID, info) {
        const config = {
            url: `/Site/${siteUID}/WebAhead`,
            method: 'POST',
            data: {
                PartySize: Math.floor(info.partSize),
                PhoneNumberString: info.phoneNumberString
            }
        };
        if (info.lastName) params.LastName = info.lastName;
        if (info.email) params.Email = info.email;
        if (info.estimatedArrivalTime) params.EstimatedArrivalTime = info.estimatedArrivalTime;
        if (info.expandGuest) params.ExpandGuest = info.expandGuest;
        if (info.firstName) params.FirstName = info.firstName;
        if (info.guestID) params.GuestID = info.guestID;
        if (info.notes) params.Notes = info.notes;
        if (info.notificationType) params.NotificationType = info.notificationType;
        if (info.isSubedToSms) params.IsSubscribedToSmsMarketing = info.isSubedToSms;
        if (info.isSubedToEmail) params.IsSubscribedToEmailMarketing = info.isSubedToEmail;
        if (info.isSubedToQsr) params.IsSubscribedToQsrMarketing = info.isSubedToQsr;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Get wait list status and quote for web ahead based on party size.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {number} partySize - Party size.
     * @returns {WaitListStatus} - WaitListStatus.
     */
    async getWaitListStatus(siteUID, partySize) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/Status`,
            method: 'GET',
            params: {
                PartySize: Math.floor(partySize)
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get wait list status and quote for web ahead for multiple party sizes.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {number[]} partySizes - Array of party sizes.
     * @returns {WaitListStatus} - WaitListStatus with quotes.
     */
    async getWaitListStatus(siteUID, partySizes = []) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/StatusforPartySize`,
            method: 'GET',
            params: {}
        };
        for (let i = 0; i < partySizes.length; i++) params[`PartySize${i+1}`] = Math.floor(partySizes[i]);   
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get wait list status and quote for web ahead based on party size, for multiple sites.
     * @param {string[]} siteUID - Globally unique identifier for a site.
     * @param {number[]} partySizes - Array of party sizes.
     * @returns {WaitListStatusForSites} - WaitListStatusForSites.
     */
    async getWaitListStatusMultipleSites(siteUIDs = [], partySizes = []) {
        const config = {
            url: `/Site/WebAhead/Status`,
            method: 'GET',
            params: {}
        };
        for (let i = 0; i < siteUIDs.length; i++) params[`SiteUID${i+1}`] = siteUIDs[i];   
        for (let i = 0; i < partySizes.length; i++) params[`PartySize${i+1}`] = Math.floor(partySizes[i]);   
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a WebAhead. By default, only active WebAheads will be returned. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified. 
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @param {string} [expand] - Optional. ???guest??? is currently the only acceptable value. If this parameter is passed, the guest record should be included in the returned WebAhead data.
     * @param {boolean} [inclQuote] - Optional. If True, this will return an additional object named "UpdatedQuote" which contains the most recent updated quote for the party, if it exists.
     * @param {boolean} [all] - Optional. If True, ignores status for current business day and returns all WebAheads created for site local business day.
     * @returns {WebAhead|WebAhead[]} - The requested WebHead(s)
     */
    async getWebAhead(siteUID, visitID, expand, inclQuote, all) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/${visitID}`,
            method: 'GET'
        };
        if (expand) params.expand = expand;
        if (inclQuote) params.ignoreStatusForCurrentBusinessDay = inclQuote;
        if (all) params.includeUpdatedQuote = all;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a WebAhead. By default, only active WebAheads will be returned. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified. 
     * @param {string} confirmationNumber - Confirmation number.
     * @param {boolean} [all] - Optional. If True, eturn all WebAheads created within the current site local business day.
     * @returns {WebAhead|WebAhead[]} - The requested WebHead(s)
     */
    async getWebAheadByConfirmation(confirmationNumber, all) {
        const config = {
            url: `/WebAhead/${confirmationNumber}`,
            method: 'GET'
        };
        if (all) params.ignoreStatusForCurrentBusinessDay = all;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a WebAhead. By default, only active WebAheads will be returned. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified. 
     * @param {number} confirmationNumber - Integer identifier of the visit confirmation number.
     * @param {boolean} [all] - Optional. If True, eturn all WebAheads created within the current site local business day.
     * @returns {WebAhead|WebAhead[]} - The requested WebHead(s)
     */
     async getWebAheadByConfirmationId(confirmationNumberId, all) {
        const config = {
            url: `/WebAhead`,
            method: 'GET',
            params: {
                ConfirmationNumberId: confirmationNumberId
            }
        };
        if (all) params.ignoreStatusForCurrentBusinessDay = all;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Update a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, PartiallyArrived or Notified.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @param {Object} [info] - Information object for WebAhead.
     * @param {number} [info.partySize] - Party Size
     * @param {string} [info.phoneNumberString] - Formatted phone number string.
     * @param {string} [info.lastName] - Optional if GuestID is provided.  Last name.
     * @param {string} [info.firstName] - First name
     * @param {string} [info.email] - Email
     * @param {string} [info.estimatedArrivalTime] - Estimated arrival time in ISO 8601 format.
     * @param {boolean} [info.expandGuest] - Specifies whether a guest record should be included in the returned WebAhead data.
     * @param {string} [info.notes] - Notes
     * @param {boolean} [info.isSubedToSms] - Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [info.isSubedToEmail] - Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [info.isSubedToQsr] - Flag to indicate whether guest subscribes to QSR's marketing.
     * @returns {WebAhead} - The updated WebHead.
     */
    async updateWebAhead(siteUID, visitID, info) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/${visitID}`,
            method: 'PATCH'
        };
        if (info.partySize) data.PartySize = info.partySize;
        if (info.phoneNumberString) data.PhoneNumberString = info.phoneNumberString;
        if (info.lastName) data.LastName = info.lastName;
        if (info.email) data.Email = info.email;
        if (info.estimatedArrivalTime) data.EstimatedArrivalTime = info.estimatedArrivalTime;
        if (info.expandGuest) data.ExpandGuest = info.expandGuest;
        if (info.firstName) data.FirstName = info.firstName;
        if (info.guestID) data.GuestID = info.guestID;
        if (info.notes) data.Notes = info.notes;
        if (info.notificationType) data.NotificationType = info.notificationType;
        if (info.isSubedToSms) data.IsSubscribedToSmsMarketing = info.isSubedToSms;
        if (info.isSubedToEmail) data.IsSubscribedToEmailMarketing = info.isSubedToEmail;
        if (info.isSubedToQsr) data.IsSubscribedToQsrMarketing = info.isSubedToQsr;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Update a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, PartiallyArrived or Notified.
     * @param {string} confirmationNumber - Confirmation number.
     * @param {Object} [info] - Information object for WebAhead.
     * @param {number} [info.partySize] - Party Size
     * @param {string} [info.phoneNumberString] - Formatted phone number string.
     * @param {string} [info.lastName] - Optional if GuestID is provided.  Last name.
     * @param {string} [info.firstName] - First name
     * @param {string} [info.email] - Email
     * @param {string} [info.estimatedArrivalTime] - Estimated arrival time in ISO 8601 format.
     * @param {boolean} [info.expandGuest] - Specifies whether a guest record should be included in the returned WebAhead data.
     * @param {string} [info.notes] - Notes
     * @param {boolean} [info.isSubedToSms] - Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [info.isSubedToEmail] - Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [info.isSubedToQsr] - Flag to indicate whether guest subscribes to QSR's marketing.
     * @returns {WebAhead} - The updated WebHead.
     */
    async updateWebAheadByConfirmation(confirmationNumber, info) {
        const config = {
            url: `/WebAhead/${confirmationNumber}`,
            method: 'PATCH'
        };
        if (info.partySize) data.PartySize = info.partySize;
        if (info.phoneNumberString) data.PhoneNumberString = info.phoneNumberString;
        if (info.lastName) data.LastName = info.lastName;
        if (info.email) data.Email = info.email;
        if (info.estimatedArrivalTime) data.EstimatedArrivalTime = info.estimatedArrivalTime;
        if (info.expandGuest) data.ExpandGuest = info.expandGuest;
        if (info.firstName) data.FirstName = info.firstName;
        if (info.guestID) data.GuestID = info.guestID;
        if (info.notes) data.Notes = info.notes;
        if (info.notificationType) data.NotificationType = info.notificationType;
        if (info.isSubedToSms) data.IsSubscribedToSmsMarketing = info.isSubedToSms;
        if (info.isSubedToEmail) data.IsSubscribedToEmailMarketing = info.isSubedToEmail;
        if (info.isSubedToQsr) data.IsSubscribedToQsrMarketing = info.isSubedToQsr;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Update a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, PartiallyArrived or Notified.
     * @param {number} confirmationNumberId - Integer identifier of the visit confirmation number.
     * @param {Object} [info] - Information object for WebAhead.
     * @param {number} [info.partySize] - Party Size
     * @param {string} [info.phoneNumberString] - Formatted phone number string.
     * @param {string} [info.lastName] - Optional if GuestID is provided.  Last name.
     * @param {string} [info.firstName] - First name
     * @param {string} [info.email] - Email
     * @param {string} [info.estimatedArrivalTime] - Estimated arrival time in ISO 8601 format.
     * @param {boolean} [info.expandGuest] - Specifies whether a guest record should be included in the returned WebAhead data.
     * @param {string} [info.notes] - Notes
     * @param {boolean} [info.isSubedToSms] - Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [info.isSubedToEmail] - Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [info.isSubedToQsr] - Flag to indicate whether guest subscribes to QSR's marketing.
     * @returns {WebAhead} - The updated WebHead.
     */
    async updateWebAheadByConfirmationId(confirmationNumberId, info) {
        const config = {
            url: `/WebAhead/`,
            method: 'PATCH',
            params: {
                ConfirmationNumberID: confirmationNumberId
            }
        };
        if (info.partySize) data.PartySize = info.partySize;
        if (info.phoneNumberString) data.PhoneNumberString = info.phoneNumberString;
        if (info.lastName) data.LastName = info.lastName;
        if (info.email) data.Email = info.email;
        if (info.estimatedArrivalTime) data.EstimatedArrivalTime = info.estimatedArrivalTime;
        if (info.expandGuest) data.ExpandGuest = info.expandGuest;
        if (info.firstName) data.FirstName = info.firstName;
        if (info.guestID) data.GuestID = info.guestID;
        if (info.notes) data.Notes = info.notes;
        if (info.notificationType) data.NotificationType = info.notificationType;
        if (info.isSubedToSms) data.IsSubscribedToSmsMarketing = info.isSubedToSms;
        if (info.isSubedToEmail) data.IsSubscribedToEmailMarketing = info.isSubedToEmail;
        if (info.isSubedToQsr) data.IsSubscribedToQsrMarketing = info.isSubedToQsr;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Cancel a WebAhead. This call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @param {boolean} [checkStatus] - Optional. If true, only a WebAhead not yet arrived will successfully cancel.
     * @returns {boolean} - True if is successful.
     */
    async cancelWebAhead(siteUID, visitID, checkStatus) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/${visitID}/cancel`,
            method: 'POST'
        };
        if (checkStatus) config.params = { checkVisitArrivalStatus: checkStatus };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Cancel a WebAhead. This call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {string} confirmationNumber - Confirmation number.
     * @param {boolean} [checkStatus] - Optional. If true, only a WebAhead not yet arrived will successfully cancel.
     * @returns {boolean} - True if successful.
     */
    async cancelWebAheadByConfirmation(confirmationNumber, checkStatus) {
        const config = {
            url: `/WebAhead/${confirmationNumber}/cancel`,
            method: 'POST'
        };
        if (checkStatus) config.params = { checkVisitArrivalStatus: checkStatus };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Cancel a WebAhead. This call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {number} confirmationNumberId - Integer identifier of the visit confirmation number.
     * @param {boolean} [checkStatus] - Optional. If true, only a WebAhead not yet arrived will successfully cancel.
     * @returns {boolean} - True if successful.
     */
    async cancelWebAheadByConfirmationId(confirmationNumberId, checkStatus) {
        const config = {
            url: `/WebAhead/Cancel`,
            method: 'POST',
            params: {
                confirmationNumberId: confirmationNumberId
            }
        };
        if (checkStatus) config.params.checkVisitArrivalStatus = checkStatus ;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Arrive a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @returns {boolean} - True if successful.
     */
    async arriveWebAhead(siteUID, visitID) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/${visitID}/arrive`,
            method: 'POST'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Arrive a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {string} confirmationNumber - Confirmation number.
     * @returns {boolean} - True if successful.
     */
    async arriveWebAheadByConfirmation(confirmationNumber) {
        const config = {
            url: `/WebAhead/${confirmationNumber}/arrive`,
            method: 'POST'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Arrive a WebAhead. Call will only succeed if the target WebAhead is Active. 
     * A WebAhead is considered Active if in one of the following states: NotYetArrived, Waiting, Partially Arrived or Notified.
     * @param {number} confirmationNumberId - Integer identifier of the visit confirmation number.
     * @returns {boolean} - True if successful.
     */
    async arriveWebAheadByConfirmationId(confirmationNumberId) {
        const config = {
            url: `/WebAhead/Arrive`,
            method: 'POST',
            params: {
                confirmationNumberId: confirmationNumberId
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Enable WebAhead for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @returns {boolean} - True if successful.
     */
    async enableWebAhead(siteUID) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/enable`,
            method: 'POST'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Disable WebAhead for the specified site.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @returns {boolean} - True if successful.
     */
    async disableWebAhead(siteUID) {
        const config = {
            url: `/Site/${siteUID}/WebAhead/disable`,
            method: 'POST'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Retrieve the current quote times at a site for a specific party size or all party sizes.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {number} [partySize] - The Party Size for which quote time is being requested. Quote times for all party sizes 1-12 will be returned if not specified.
     * @returns {PrecalculatedQuotes|PrecalculatedQuotes[]} - PrecalculatedQuotes for a single party size or all party sizes.
     */
    async getPrecalculatedQuotes(siteUID, partySize) {
        const config = {
            url: `/Site/${siteUID}/PrecalculatedQuotes`,
            method: 'GET'
        };
        if (partySize) params = { PartySize: partySize };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Adds a guest record to the company guestbook.
     * @param {Object} data - Guest data to add.
     * @param {string} data.lastName - Last name.
     * @param {string} [data.firstName] - Optional. First name.
     * @param {string} [data.email] - Optional. Email.
     * @param {string} [data.notes] - Optional. Notes.
     * @param {boolean} [data.isAnon] - Optional. Is anonymous guest record.
     * @param {boolean} [data.isSubedToSms] - Optional. Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [data.isSubedToEmail] - Optional. Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [data.isSubedToQsr] - Optional. Flag to indicate whether guest subscribes to QSR's marketing.
     * @param {GuestLoyalty} [data.loyalty] - Optional. Guest loyalty info.
     * @param {GuestPhoneNumber[]} [data.phoneNumbers] - Optional. Collection of GuestPhoneNumber objects
     * @param {GuestAddress[]} [data.addresses] - Optional. Collection of GuestAddress objects
     * @param {GuestCustomValue[]} [data.customValues] - Optional. Collection of GuestCustomValue objects
     * @param {string} [syncSource] - Optional. QSR-defined string representing a source of records.
     * @returns {Guest} - Guest.
     */
    async addGuest(data = {}, syncSource) {
        const config = {
            url: `/company/${this.companyUID}/GuestBook`,
            method: 'POST',
            data: {
                LastName: data.lastName
            }
        };
        if (syncSource) params = { SyncSource: syncSource };
        if (data.firstName) config.data.FirstName = data.firstName;
        if (data.email) config.data.Email = data.email;
        if (data.notes) config.data.Notes = data.notes;
        if (data.isAnon) config.data.IsAnonymous = data.isAnon;
        if (data.isSubedToSms) config.data.IsSubscribedToSmsMarketing = data.isSubedToSms;
        if (data.isSubedToEmail) config.data.IsSubscribedToEmailMarketing = data.isSubedToEmail;
        if (data.isSubedToQsr) config.data.IsSubscribedToQsrMarketing = data.isSubedToQsr;
        if (data.loyalty) config.data.Loyalty = data.loyalty;
        if (data.phoneNumbers) config.data.PhoneNumbers = data.phoneNumbers;
        if (data.addresses) config.data.Addresses = data.addresses;
        if (data.customValues) config.data.CustomValues = data.customValues;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Updates the specified guest record.
     * @param {string} guestId - A globally unique identifier for a QSR guest record.
     * @param {Object} [data] - Optional. Guest data to add.
     * @param {string} [data.lastName] - Optional. Last name.
     * @param {string} [data.firstName] - Optional. First name.
     * @param {string} [data.email] - Optional. Email.
     * @param {string} [data.notes] - Optional. Notes.
     * @param {boolean} [data.isAnon] - Optional. Is anonymous guest record.
     * @param {boolean} [data.isSubedToSms] - Optional. Flag to indicate whether guest subscribes to SMS marketing.
     * @param {boolean} [data.isSubedToEmail] - Optional. Flag to indicate whether guest subscribes to email marketing.
     * @param {boolean} [data.isSubedToQsr] - Optional. Flag to indicate whether guest subscribes to QSR's marketing.
     * @param {GuestLoyalty} [data.loyalty] - Optional. Guest loyalty info.
     * @param {GuestPhoneNumber[]} [data.phoneNumbers] - COptional. ollection of GuestPhoneNumber objects
     * @param {GuestAddress[]} [data.addresses] - Optional. Collection of GuestAddress objects
     * @param {GuestCustomValue[]} [data.customValues] - Optional. Collection of GuestCustomValue objects
     * @param {string} [syncSource] - Optional. Optional. QSR-defined string representing a source of records.
     * @returns {boolean} - True if successful.
     */
    async updateGuest(guestId, data = {}, syncSource) {
        const config = {
            url: `/company/${this.companyUID}/GuestBook/${guestId}`,
            method: 'PATCH'
        };
        if (syncSource) params = { SyncSource: syncSource };
        if (data.firstName) config.data.FirstName = data.firstName;
        if (data.email) config.data.Email = data.email;
        if (data.notes) config.data.Notes = data.notes;
        if (data.isAnon) config.data.IsAnonymous = data.isAnon;
        if (data.isSubedToSms) config.data.IsSubscribedToSmsMarketing = data.isSubedToSms;
        if (data.isSubedToEmail) config.data.IsSubscribedToEmailMarketing = data.isSubedToEmail;
        if (data.isSubedToQsr) config.data.IsSubscribedToQsrMarketing = data.isSubedToQsr;
        if (data.loyalty) config.data.Loyalty = data.loyalty;
        if (data.phoneNumbers) config.data.PhoneNumbers = data.phoneNumbers;
        if (data.addresses) config.data.Addresses = data.addresses;
        if (data.customValues) config.data.CustomValues = data.customValues;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Deletes the specified guest record.
     * @param {string} guestId - A globally unique identifier for a QSR guest record.
     * @param {string} [syncSource] - Optional. Optional. QSR-defined string representing a source of records.
     * @returns {boolean} - True if successful.
     */
    async removeGuest(guestId, syncSource) {
        const config = {
            url: `/company/${this.companyUID}/GuestBook/${guestId}`,
            method: 'DELETE'
        };
        if (syncSource) params = { SyncSource: syncSource };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Search guestbook by the specified filters.
     * Returns paged search results ordered by last name field,
     * specified by parameters: info.guestsPerPage and info.pageNumber.
     * @param {Object} info - Search parameters
     * @param {string} [info.guestId] - Optional. A globally unique identifier for a QSR guest record.
     * @param {string} [info.firstName] - Optional. First name.
     * @param {string} [info.lastName] - Optional. Last name.
     * @param {string} [info.loyaltyCardID] - Optional. Loyality card ID.
     * @param {string} [info.email] - Optional. Email.
     * @param {string} [info.city] - Optional. City.
     * @param {string} [info.state] - Optional. State.
     * @param {string} [info.postalCode] - Optional. Postal code.
     * @param {string} [info.mobilePhoneNumber] - Optional. Mobile phone number.
     * @param {string} [info.guestsPerPage] - Optional. Number of guest records per page.
     * @param {string} [info.pageNumber] - Optional. Number representing the requested page of results.
     * @returns {Guest[]} - Collection of Guest. 
     */
    async searchGuestbook(info = {}) {
        const config = {
            url: `/company/${this.companyUID}/GuestBook`,
            method: 'GET',
            params: {}
        };
        if (info.guestId) config.params.GuestId = info.guestId;
        if (info.firstName) config.params.FirstName = info.firstName;
        if (info.lastName) config.params.LastName = info.lastName;
        if (info.loyaltyCardID) config.params.LoyaltyCardID = info.loyaltyCardID;
        if (info.email) config.params.Email = info.email;
        if (info.city) config.params.City = info.city;
        if (info.state) config.params.State = info.state;
        if (info.postalCode) config.params.PostalCode = info.postalCode;
        if (info.mobilePhoneNumber) config.params.MobilePhoneNumber = info.mobilePhoneNumber;
        if (info.guestsPerPage) config.params.GuestsPerPage = info.guestsPerPage;
        if (info.pageNumber) config.params.PageNumber = info.pageNumber;

        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data.Guests;
    }

    /**
     * Arrive a Visit.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @returns {boolean} - True if successful.
     */
    async arriveVisit(siteUID, visitID) {
        const config = {
            url: `/Site/${siteUID}/Visit/${visitID}/Arrive`,
            method: 'POST',
            params: {
                SiteUID: siteUID,
                VisitID: visitID
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * This endpoint is for third party apps or services to update the distance and position that a prospective visit is from a site. 
     * The data is stored in the SiteEventQueue.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - A globally unique identifier for a QSR visit record.
     * @param {Object} info - Proximiy info.
     * @param {string} [info.source] - Optional. The source of the guest proximity data.
     * @param {number} [info.latitude] - Optional. Any decimal 0 to 90. South latitudes will be negative.
     * @param {number} [info.longitude] - Optional. Any decimal 0 to 180. West longitudes will be negative.
     * @param {number} [info.distance] - Optional. Can be any decimal.
     * @returns {boolean} - True if successful.
     */
    async updateVisitProximity(siteUID, visitID) {
        const config = {
            url: `/Site/${siteUID}/Visit/${visitID}/Proximity`,
            method: 'PATCH',
            data: {
                SiteUID: siteUID,
                VisitID: visitID,
                Timestamp: (new Date()).toISOString()
            }
        };
        if (info.source) config.data.Source = info.source;
        if (info.latitude) config.data.Latitude = info.latitude;
        if (info.longitude) config.data.Longitude = info.longitude;
        if (info.distance) config.data.Distance = info.distance;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.status === 200;
    }

    /**
     * Get all visit updates for a specified site within a specified time range, 
     * excluding updates made by the specified 'syncSource'. 
     * This is ordered by last update timestamp of the visit records.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} startTime - Start time of updates.
     * @param {string} stopTime - End time of updates.
     * @param {string} [syncSource] - Exclude results made by specified 'syncSource'
     * @returns {Visit[]} - Collection of Visit.
     */
    async getAllVisitUpdates(siteUID, startTime, stopTime, syncSource) {
        const config = {
            url: `/Site/${siteUID}/Visits`,
            method: 'GET',
            params: {
                SiteUID: siteUID,
                start: startTime.toISOString(),
                stop: stopTime.toISOString()
            }
        };
        if (syncSource) config.params.SyncSource = syncSource;
        const data = [];
        let response;
        do {
            response = await this.axios.request(config).catch(this.#errorHandler);
            data.push(...response.data.Visits)
            config.params.start = (new Date(response.data.TimestampCutoff)).toISOString();
        } while (response.data.MoreData);
        return data;
    }

    /**
     * Get the paged list of visit updates for a specified site within a specified time range, 
     * excluding updates made by the specified 'syncSource'. 
     * This is ordered by last update timestamp of the visit records. Page size is 30.
     * If the total number of visits exceeds 30: 
     *   - The first 30 records are returned.
     *   - 'MoreData' is "True"
     *   - 'TimeStampCutoff' is the last update timestamp of the last record returned.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} startTime - Start time of updates.
     * @param {string} stopTime - End time of updates.
     * @param {string} [syncSource] - Exclude results made by specified 'syncSource'
     * @returns {VisitPollResponse} - Paged results for Visits.
     */
     async getVisitUpdates(siteUID, startTime, stopTime, syncSource) {
        const config = {
            url: `/Site/${siteUID}/Visits`,
            method: 'GET',
            params: {
                SiteUID: siteUID,
                start: startTime.toISOString(),
                stop: stopTime.toISOString()
            }
        };
        if (syncSource) config.params.SyncSource = syncSource;
        const data = [];
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a visit by its external ID.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} externalUID - External ID of the target QSR visit record.
     * @returns {Visit} - Visit.
     */
    async getVisitByExternalId(siteUID, externalUID) {
        const config = {
            url: `/Site/${siteUID}/Visit/ExternalID/${externalUID}`,
            method: 'GET'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get a visit by ID.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - Unique identifier of the target QSR visit record.
     * @returns {Visit} - Visit.
     */
    async getVisit(siteUID, visitID) {
        const config = {
            url: `/Site/${siteUID}/Visit/${visitID}`,
            method: 'GET'
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get an "open" visit by guest???s Loyalty Card ID 
     * An "open" visit is a visit that is not completed and not canceled.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} loyalityCardID - Loyalty card ID of the guest for the target visits.
     * @param {string} [status] - Only "open" is currently accepted.
     * @returns {Visit} - Visit.
     */
    async getVisitByLoyalityCard(siteUID, loyalityCardID, status) {
        const config = {
            url: `/Site/${siteUID}/Visit`,
            method: 'GET',
            params: {
                LoyaltyCard: loyalityCardID
            }
        };
        if (status) params.status = status;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get an "open" visit by guest???s phone number.
     * An "open" visit is a visit that is not completed and not canceled.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} phoneNumber - Phone number of the guest for the target visits. Only US numbers can be used. Accepted formats include: E.164 format, national format. Example: ???+12223334444???, ???(222) 333-4444???, ???2223334444???.
     * @param {sring} countryCode - Country code of the phone number of the guest for the target visits. Accepted values include ISO 3166-1 alpha-2. Example: US for the United States, and GB for the United Kingdom.
     * @param {string} [status] - Only "open" is currently accepted.
     * @returns {Visit} - Visit.
     */
    async getVisitByLoyalityCard(siteUID, phoneNumber, countryCode, status) {
        const config = {
            url: `/Site/${siteUID}/Visit`,
            method: 'GET',
            params: {
                PhoneNumber: phoneNumber,
                CountryCode: countryCode
            }
        };
        if (status) params.status = status;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Get an "open" visit by guest???s pager number.
     * An "open" visit is a visit that is not completed and not canceled.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} pagerID - The pager number associated with the visit.
     * @param {string} [status] - Only "open" is currently accepted.
     * @returns {Visit} - Visit.
     */
    async getVisitByLoyalityCard(siteUID, pagerID, status) {
        const config = {
            url: `/Site/${siteUID}/Visit`,
            method: 'GET',
            params: {
                PagerID: pagerID
            }
        };
        if (status) params.status = status;
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }

    /**
     * Update visit Party Mix.
     * Note: The total guest count of all party mix values must equal the party size of the visit.
     * @param {string} siteUID - Globally unique identifier for a site.
     * @param {string} visitID - Unique identifier of the target QSR visit record.
     * @param {string} partyMix - Type and count of the party mixes.
     * @returns {PartyMix} - Party Mix.
     */
    async updatePartyMix(siteUID, visitID, partyMix) {
        const config = {
            url: `/Site/${siteUID}/Visit/${visitID}/PartyMix`,
            method: 'POST',
            params: {
                partyMix: partyMix
            }
        };
        const response = await this.axios.request(config).catch(this.#errorHandler);
        return response.data;
    }
}

module.exports = QSR;


/** Type Definitions */

/**
 * QSR Visit record
 * @typedef {Object} Visit 
 * @property {string} ArrivalTime - Arrival time in ISO 8601 format.
 * @property {string} CanceledTime - Canceled time in ISO 8601 format.
 * @property {string} CompletedTime - Completed time in ISO 8601 format.
 * @property {string} ConfirmationNumber - Confirmation number.
 * @property {string} CreationTime - Creation time in ISO 8601 format.
 * @property {VisitCustomValue[]} CustomValues - Collection of VisitCustomValue objects representing the visit custom value.
 * @property {string} EstimatedArrivalTime - Estimated arrival time in ISO 8601 format.
 * @property {string} ExternalID - External identifier of the visit record from a 3rd party.
 * @property {Guest} Guest - A guest record tied to current QSR visit record. 
 * @property {string} GuestID - A globally unique identifier for the QSR guest record tied to the current QSR visit record.
 * @property {string} ID - A globally unique identifier for a QSR visit record.
 * @property {number} IID - An integer type identifier for a QSR visit record.
 * @property {string} Notes - Notes.
 * @property {string} NotificationType - Set Notification Type to None, Call, SMS, or Pager.
 * @property {string} PagedTime - Paged time in ISO 8601 format.
 * @property {string} PagerID - ID number of associated pager.
 * @property {VisitPartyMix} PartyMix - Visit party mix data.
 * @property {VisitPreassignedTable[]} PreassignedTables - Collection of VisitPreassignedTable objects representing preassigned tables with the visit.
 * @property {Quote} Quote - Quote-related information.
 * @property {VisitSeatedTable[]} SeatedTables - Collection of VisitSeatedTable objects representing seated tables with the visit.
 * @property {string} SeatedTime - Seated time in ISO 8601 format.
 * @property {string} SeatingAreaID - A globally unique identifier for a QSR seating area.
 * @property {string} SeatingAreaName - Seating area name
 * @property {number} Size - Cover count
 * @property {string} Status - Status of current QSR visit record. The following are considered acceptable values: NotYetArrived, PartiallyArrived, Waiting, NoShow, WalkAway, Notified, PartiallySeated, Seated, AlmostFinished, Payment, Completed, CheckStarted, Canceled.
 * @property {string} Type - Type of current QSR visit record. The following are considered acceptable values: WalkIn, CallAhead, Reservation, Carryout.
 * @property {string} VisitSource - Origination of the visit.
 */

/**
 * QSR visit custom record.
 * @typedef {Object} VisitCustomValue
 * @property {string} Name - Name of the visit custom record.
 * @property {string} Value - Value of the visit custom record.
 */

/**
 * QSR VisitSeatedTable record representing a seated table for a visit.
 * @typedef {Object} VisitSeatedTable
 * @property {string} StartTime - Start time in ISO 8601 format. Time when the visit is seated at the table.
 * @property {string} EndTime - End time in ISO 8601 format. Time when the visit leaves the table.
 * @property {boolean} IsCurrent - Flag to indicate whether this record is current.
 * @property {boolean} IsActive - Flag to indicate whether this record is active.
 * @property {string} TableID - A globally unique identifier for a QSR table record.
 * @property {string} TableName - Name of the seated table.
 */

/**
 * QSR VisitPreassignedTable record representing a preassigned table for a visit.
 * @typedef {Object} VisitPreassignedTable
 * @property {string} StartTime - Start time in ISO 8601 format. Time when the visit is seated at the table.
 * @property {string} EndTime - End time in ISO 8601 format. Time when the visit leaves the table.
 * @property {boolean} IsCurrent - Flag to indicate whether this record is current.
 * @property {boolean} IsActive - Flag to indicate whether this record is active.
 * @property {string} TableID - A globally unique identifier for a QSR table record.
 * @property {string} TableName - Name of the seated table.
 */

/**
 * @typedef {Object} VisitPartyMix
 * @property {VisitPartyMixEntry[]} Mixes - Collection of VisitPartyMixEntry. 
 */

/**
 * @typedef {Object} VisitPartyMixEntry
 * @property {number} Count - Count of the party mix type.
 * @property {string} Type - Type of the party mix. The following are considered acceptable values: Adult, Child, Infant, Senior.
 */

/**
 * @typedef {Object} TableHistory
 * @property {string} CleanedTime - Cleaned time of the table, in ISO 8601 format.
 * @property {string} CreatedTime - Creation time of the table, in ISO 8601 format.
 * @property {string} DirtiedTime - Dirty time of the table, in ISO 8601 format.
 * @property {string} FloorPlanName - Name of the related floorplan for the table history record.
 * @property {string} ID - Unique identifier of the table.
 * @property {boolean} IsActive - Boolean flag to represent whether the table is active.
 * @property {number} MaximumSeatCount - Maximum seat count of the table.
 * @property {number} MiniumumSeatCount - Minimum seat count of the table.
 * @property {string} Name - Name of the table.
 * @property {string} OperatingPeriodName - Name of the related operating period for the table history record.
 * @property {number} SeatCount - Seat count of the table.
 * @property {string} ShiftName - Name of the related shift for the table history record.
 */

/**
 * @typedef {Object} TableEvent
 * @property {string} Category - Category of the event.
 * @property {TableEventContent} Content - Content of the event.
 * @property {string} LastUpdate - Last update timestamp of the event, in ISO 8601 format.
 * @property {string} ServerLastUpdate - Server last update timestamp of the event, in ISO 8601 format.
 * @property {string} SyncSource - Sync source of the event.
 * @property {string} Type - Type of event.
 * @property {number} UID - Globally unique identifier of the event.
 * @property {number} Version - Version of the event.
 */

/**
 * @typedef {Object} TableEventContent
 * @property {FloorPlanSnapshot} FloorPlan - Snapshot of the floorplan information at the time of the event.
 * @property {ShiftSnapshot} Shift - Snapshot of the shift information at the time of the event.
 * @property {StationSnapshot} Station - Snapshot of the related stations information at the time of the event. 
 * @property {TableSnapshot} Table - Snapshot of the table information at the time of the event.
 */

/**
 * @typedef {Object} FloorPlanSnapshot
 * @property {string} Name - Name of the floorplan.
 * @property {string} UID - Globally unique identifier of the floorplan record.
 */

/**
 * @typedef {Object} ShiftSnapshot
 * @property {string} Name - Name of the shift.
 * @property {string} UID - Globally unique identifier of the shift record.
 */

/**
 * @typedef {Object} StationSnapshot
 * @property {string} Name - Name of the station.
 * @property {string} UID - Globally unique identifier of the station record.
 */

/**
 * @typedef {Object} TableSnapshot
 * @property {boolean} EndSeats - Flag to indicate whether table has endseat. "True" means active.
 * @property {string} LastUpdate - The last update timestamp of the table record, in ISO 8601 format.
 * @property {number} MaximumSeatCount - Maximum seat count of the table.
 * @property {number} MiniumumSeatCount - Minimum seat count of the table.
 * @property {string} Name - Name of the table.
 * @property {number} QsrTableShapeID - QSR-defined integer ID representing the shape of the table.
 * @property {number} SeatCount - Seat count of the table.
 * @property {TableStatisticSnapshot} Statistics - TableStatisticSnapshot object of the table.
 * @property {string} UID - Globally unique identifier of the event.
 */

/**
 * @typedef {Object} TableStatisticSnapshot
 * @property {string} OpenedTime - The open timestamp of the table record, in ISO 8601 format.
 * @property {string} ClosedTime - The close timestamp of the table record, in ISO 8601 format.
 */

/**
 * @typedef {Object} ReservationAvailabilityDay
 * @property {string} Date - Target date of the ReservationAvailabilityDay record, in ISO 8601 format. Note: This field should be treated as site local business date and should never parsed as a DateTime.
 * @property {ReservationAvailabilitySession[]} Sessions - Collection of ReservationAvailabilitySession, each representing availability for a session within a day.
 */

/**
 * @typedef {Object} ReservationAvailabilitySession
 * @property {string} SessionName - Name of the session record.
 * @property {ReservationAvailabilitySeatingArea[]} SeatingAreas - Collection of ReservationAvailabilitySeatingArea, each representing availability for a seating area within a session.
 */

/**
 * @typedef {Object} ReservationAvailabilitySeatingArea
 * @property {string} GuestMessage - Message shown to guests when guests book a reservation with the seating area and the session.
 * @property {string} SeatingAreaName - Name of the seating area.
 * @property {string} SeatingAreaUID - Unique identifier of the seating area.
 * @property {ReservationAvailabilityTimeSlot[]} Times - Collection of ReservationAvailabilityTimeSlot, each representing availability for a calendar date. 
 */

/**
 * @typedef {Object} ReservationAvailabilityTimeSlot
 * @property {boolean} IsAvailable - If time slot is available, "True." Otherwise, "False."
 * @property {string} Time - It represents time of the time slot, in ISO 8601 format.
 * @property {boolean} OnlineSuspended - If online reservations have been temporarily suspended by the restaurant, "True." Otherwise, "False."
 */

/**
 * @typedef {Object} Site
 * @property {string} SiteUID - A globally unique identifier for a site that will be provided by QSR.
 * @property {string} CustomerSiteID - Customizable site identifier.
 * @property {number} IID - An integer type identifier for a QSR visit record..
 * @property {string} CompanyUID - A globally unique identifier for a company that will be provided by QSR.
 * @property {string} CreationTime - Creation time in ISO 8601 format..
 * @property {string} Name - Site name.
 * @property {string} ContactNumber - Site contact phone number.
 * @property {string} Hours - Site operation hours text.
 * @property {string} Address - Address.
 * @property {string} City - City.
 * @property {string} County - Country.
 * @property {string} State - State.
 * @property {string} Postal - Postal code.
 * @property {string} Country - Country.
 * @property {string} TimeZoneId - Name of site time zone in Olson time zone list..
 * @property {number} Latitude - Latitude of site location.
 * @property {number} Longitude - Longitude of site location.
 * @property {string} BrandUID - A globally unique identifier for a Brand/Concept that will be provided by QSR.
 * @property {string} DisplayName - Descriptive alternate site name.
 * @property {string} PrimaryCuisine - Name of the main type cuisine associated with the site.
 * @property {string[]} Cuisines - Name of cuisines associated with the site.
 * @property {string} LastUpdate - The timestamp of the last update in ISO 8601 format.
 */

/**
 * @typedef {Object} OperatingInfo
 * @property {Days[]} Days - Collection of operating days data.
 * @property {Sessions[]} Sessions - Collection of Sessions data. See Sessions.
 * @property {string} Session - Name of the corresponding session.
 * @property {string} StartTime - Beginning time of the operating period, in ISO 8601 format.
 * @property {string} Status - Operating status of the operating period. The following are considered accepted values: ???Open???, ???Closed??? and ???Unknown???.
 */

/**
 * @typedef {Object} Days
 * @property {string} ID - Identifier for the Day record.
 * @property {Sessions[]} Schedule - Collection of schedule data.
 * @property {string} Session - Name of the corresponding session.
 * @property {string} StartTime - Beginning time of the operating period, in ISO 8601 format.
 * @property {string} Status - Operating status of the operating period. The following are considered accepted values: ???Open???, ???Closed??? and ???Unknown???.
 */

/**
 * @typedef {Object} Sessions
 */

/**
 * @typedef {Object} TeamMember
 * @property {string} CardId - Card ID of the TeamMember record.
 * @property {string} CreatedTime - The creation timestamp of the TeamMember record, in ISO 8601 format.
 * @property {string} Email - Email of the TeamMember record.
 * @property {string} ExternalId - External ID of the TeamMember record.
 * @property {string} FirstName - FirstName of the TeamMember record.
 * @property {string} HomePhone - HomePhone of the TeamMember record.
 * @property {boolean} IsActive - Flag indicating whether the TeamMember record is active. "True" means active.
 * @property {string} LastName - LastName of the TeamMember record.
 * @property {string} MobilePhone - MobilePhone of the TeamMember record.
 * @property {string} Notes - Notes of the TeamMember record.
 * @property {number} ServerID - Integer ID of the TeamMember record.
 * @property {string} UID - Globally unique identifier of the TeamMember record.
 */

/**
 * @typedef {Object} TeamMemberEvent
 * @property {string} Category - Category of the event.
 * @property {TeamMemberEventContent} Content - Content of the event.
 * @property {string} LastUpdate - Last update timestamp of the event, in ISO 8601 format.
 * @property {string} ServerLastUpdate - Server last update timestamp of the event, in ISO 8601 format.
 * @property {string} SyncSource - Sync source of the event. See Standard Parameters & DTOs.
 * @property {string} Type - Type of event.
 * @property {string} UID - Globally unique identifier of the event.
 * @property {string} Version - Version of the event.
 */

/**
 * @typedef {Object} TeamMemberEventContent
 * @property {FloorPlanSnapshot} FloorPlan - Snapshot of the floorplan information at the time of the event.
 * @property {ShiftSnapshot} Shift - Snapshot of the shift information at the time of the event.
 * @property {StationSnapshot} Station - Snapshot of the related stations information at the time of the event. 
 * @property {TeamMemberSnapshot} TeamMember - Snapshot of the team member information at the time of the event. 
 */

/**
 * @typedef {Object} TeamMemberSnapshot
 * @property {string} CardId - Card ID of the TeamMember record.
 * @property {string} CreatedTime - The creation timestamp of the TeamMember record, in ISO 8601 format.
 * @property {string} Email - Email of the TeamMember record.
 * @property {string} ExternalId - External ID of the TeamMember record.
 * @property {string} FirstName - FirstName of the TeamMember record.
 * @property {string} HomePhone - HomePhone of the TeamMember record.
 * @property {number} Id - number ID of the TeamMember record.
 * @property {number} ImageId - number ID of the image of the TeamMember record.
 * @property {string} LastName - LastName of the TeamMember record.
 * @property {string} MobilePhone - MobilePhone of the TeamMember record.
 * @property {string} Notes - Notes of the TeamMember record.
 * @property {number} SiteID - number ID of the site for the TeamMember record.
 * @property {string} UID - Globally unique identifier of the TeamMember record.
 */

/**
 * Quote related information.
 * @typedef {Object} Quote
 * @property {string} ConsumerQuoteString - Quote string presented to guest/consumer.
 * @property {number} QuoteHigh - High value of quote range.
 * @property {number} QuoteLow - Low value of quote range.
 * @property {string} SiteQuoteString - Quote string presented to site.
 */

/**
 * QSR guest record. 
 * @typedef {Object} Guest
 * @property {GuestAddress[]} Addresses - Collection of GuestAddress objects representing the guest address records.
 * @property {GuestCustomValue[]} CustomValues - Collection of GuestCustomValue objects representing the guest custom value.
 * @property {string} Email - Email.
 * @property {string} FirstName - First name.
 * @property {string} ID - A globally unique identifier for a QSR guest record.
 * @property {boolean} IsAnonymous - Is anonymous guest record.
 * @property {boolean} IsSubscribedToEmailMarketing - Flag to indicate whether a guest subscribes to email marketing.
 * @property {boolean} IsSubscribedToQsrMarketing - Flag to indicate whether a guest subscribes to QSR???s marketing.
 * @property {boolean} IsSubscribedtoSmsMarketing - Flag to indicate whether a guest subscribes to SMS marketing.
 * @property {string} LastName - Last name.
 * @property {GuestLoyalty} Loyalty - Guest loyalty info.
 * @property {string} Notes - Notes.
 * @property {GuestPhoneNumber[]} PhoneNumbers - Collection of GuestPhoneNumber objects representing the guest phone number records. 
 * @property {string} NotificationType - Set NotificationType to 'None 'or 'SMS' to indicate guest's notification preference.
 */

/**
 * @typedef {Object} GuestAddress
 * @property {string} Address - Address.
 * @property {string} Address2 - Address line 2.
 * @property {string} City - City.
 * @property {string} County - County.
 * @property {string} Postal - Postal.
 * @property {string} State - State.
 * @property {string} Country - Country.
 * @property {number} Sort - Sort order.
 */

/**
 * @typedef {Object} GuestCustomValue
 * @property {string} Name - Name of the guest custom record.
 * @property {string} Value - Value of the guest custom record.
 */

/**
 * @typedef {Object} GuestLoyalty
 * @property {string} LoyaltyCardID - Loyalty card ID
 */

/**
 * @typedef {Object} GuestPhoneNumber
 * @property {string} ID - A globally unique identifier for a QSR guest phone record.
 * @property {string} PhoneNumber - Phone number.
 * @property {string} PhoneNumberString - Formatted phone number string..
 * @property {string} Type - Type of phone number. The following are considered acceptable values: Mobile, Home, Work, Other.
 * @property {number} Sort - Sort order.
 */

/**
 * @typedef {Object} TableStatus
 * @property {boolean} IsDirty - True flag indicates table is dirty.
 * @property {string} OpenedTime - The open timestamp of the table status in ISO 8601 format.
 * @property {string} ClosedTime - The close timestamp of the table status in ISO 8601 format.
 * @property {string} DirtyTime - Dirty time of the table in ISO 8601 format.
 * @property {string} CleanedTime - Cleaned time of the table in ISO 8601 format.
 * @property {string} LastSeatedTime - Time of last seating in ISO 8601 format.
 * @property {string} LastCompletedTime - Time table was last complete in ISO 8601 format.
 * @property {string} LastAvailableTime - Last time the table was available in ISO 8601 format.
 * @property {string} Status - Current status of the table.
 * @property {string} ID - Identification number of the table.
 * @property {string} LastUpdate - The timestamp of the last update of table status in ISO 8601 format.
 * @property {string} Name - The table name.
 * @property {number} SeatCount - The number of guests seated at the table.
 * @property {number} MinimumSeatCount - The minimum number of guests that may be seated at table.
 * @property {number} MaximumSeatCount - The maximum number of guests that may be seated at table.
 * @property {boolean} IsActive - True flag indicates table is active.
 * @property {string} SeatingAreaId - The area identification number in which the table is located.
 * @property {boolean} HasMoreData - True flag indicates there is more table status data available.
 * @property {string} CutOffDate - The cut off timestamp in ISO 8601 format.
 */

/**
 * @typedef {Object} WebAhead
 * @property {string} ID - A globally unique identifier for a QSR visit record.
 * @property {string} SiteUID - Globally unique identifier for a site. This is provided by QSR.
 * @property {string} NotificationType - Set Notification Type to None, Call, SMS, or Pager.
 * @property {number} PlaceInWaitList - 1-based position of a current WebAhead visit in the wait list.
 * @property {string} Type - Type of current QSR visit record. The following are considered acceptable values: WalkIn, CallAhead, Reservation.
 * @property {string} Status - Status of a current QSR visit record. The following are considered acceptable values: NotYetArrived, PartiallyArrived, Waiting, NoShow, WalkAway, Notified, PartiallySeated, Seated, AlmostFinished, Payment, Completed, CheckStarted, and Canceled.
 * @property {number} Size - Cover count
 * @property {string} ConfirmationNumber - Confirmation number
 * @property {number} ConfirmationNumberID - number identifier of the visit confirmation number.
 * @property {string} Notes - Notes
 * @property {string} CreationTime - Creation time in ISO 8601 format.
 * @property {string} EstimatedArrivalTime - Estimated arrival time in ISO 8601 format.
 * @property {string} ArrivalTime - Arrival time in ISO 8601 format.
 * @property {string} PagedTime - Paged time in ISO 8601 format.
 * @property {Quote} Quote - Quote-related information.
 * @property {UpdatedQuote} UpdatedQuote - The party's most recently updated Quote information with a GeneratedDateTime in ISO 8601 format.
 * @property {VisitPreassignedTable[]} PreassignedTables - Collection of VisitPreassignedTable objects representing preassigned tables.
 * @property {VisitCustomValue[]} CustomValues - Collection of VisitCustomValue objects representing visit custom value.
 * @property {Guest} Guest - A QSR guest record tied to a current QSR visit record.
 * @property {string} GuestID - A globally unique identifier for the QSR guest record tied to a current QSR WebAhead record.
 * @property {string} SeatingAreaID - A globally unique identifier for a QSR seating area.
 * @property {string} SeatingAreaName - Seating area name.
 * @property {string} SeatedTime - Seated time in ISO 8601 format.
 * @property {string} CompletedTime - Completed time in ISO 8601 format.
 * @property {VisitSeatedTable[]} SeatedTables - Collection of VisitSeatedTime objects representing seated tables.
 */

/**
 * @typedef {Object} WaitListStatus
 * @property {string} SiteUID - A globally unique identifier for a site that will be provided by QSR.
 * @property {string} WebAheadStatus - Status of site WebAhead operations. The following are considered acceptable values: Disabled, NotAccepting, Available.
 * @property {number} NumberWaitingVisits - Number of current waiting visits on site.
 * @property {Quote} Quote - Current quote information.
 * @property {Status[]} Statuses - Current quote information.
 */

/**
 * @typedef {Object} Status
 * @property {number} PartySize - Number of guests in party.
 * @property {Quote[]} Quote - Collention of Quotes.
 * @property {string} WebAheadStatus - Status of site WebAhead operations. The following are considered acceptable values: Disabled, NotAccepting, Available.
 * @property {string} WebAheadStatusText - Status of site WebAhead operations in text form. Possible values are: Disabled, NotAccepting, Available.
 */

/**
 * @typedef {Object} WaitListStatusForSites
 * @property {WaitListStatus} WaitListStatusList - List of WaitListStatus for specified sites.
 */

/**
 * @typedef {Object} PreCalculatedQuotes
 * @property {PrecalculatedQuotePerPartySize[]} Quotes - Collection of PrecalculatedQuotes representing quotes per party size.
 */

/**
 * @typedef {Object} PrecalculatedQuotePerPartySize
 * @property {PreCalculatedQuote[]} quote - Collection PrecalculatedQuote data
 * @property {number} partySize - Number of guests within a party for which the quote applies.
 */

/**
 * @typedef {Object} PrecalculatedQuote
 * @property {number} quoteLow - Low quote range value as determined by your quote settings.
 * @property {number} quoteHigh - High quote range value as determined by your quote settings.
 * @property {string} siteQuoteString - "Exact Quote Label" configured for the quote time.
 * @property {string} consumerQuoteString - "Quote Range Label" configured for the quote time.
 * @property {number} exactQuote - Exact quote value generated by the system.
 * @property {number} checkBackTime - Unused by QSR applications .Configurable value to provide to party to check back on.
 * @property {number} autoNoShowTime - Unused by QSR applications .Configurable value for when to automatically no show a visit after check back time.
 * @property {string} guestChitString - Configurable quote text to print on guest printer receipt.
 */

/**
 * @typedef {Object} PartyMix
 * @property {string} ID - Globally unique identifier of a site.
 * @property {number} IID - Integer ID.
 * @property {string} LastUpdate - The timestamp of the last update in ISO 8601 format.
 * @property {string} ServerLastUpdate - Server last update timestamp of the event in ISO 8601 format.
 * @property {Guest[]} Guest - Collection of Guest.
 * @property {string} GuestID - Unique identifier of a guest record.
 * @property {string} Type - The type of.
 * @property {string} Status - The current status of.
 * @property {number} Size - Cover count.
 * @property {SeatedTables[]} SeatedTables - Collection of SeatedTables.
 * @property {VisitPreassignedTable[]} PreassignedTables - Collection of VisitPreassignedTable
 * @property {Quote} Quote - Quote related information.
 * @property {string} CreationTime - The creation timestamp of
 * @property {string} EstimatedArrivalTime - Reservation time in ISO 8601 format.
 * @property {string} ArrivalTime - Arrival time in ISO 8601 format.
 * @property {string} PagedTime - Paged time in ISO 8601 format.
 * @property {string} SeatedTime - Seated time in ISO 8601 format.
 * @property {string} CompletedTime - Completed time in ISO 8601 format.
 * @property {string} CanceledTime - Reservation cancellation timestamp in ISO 8601 format.
 * @property {string} ConfirmationNumber - Confirmation number.
 * @property {number} ConfirmationNumberId - Integer identifier of the visit confirmation number.
 * @property {string} SeatingAreaId - A globally unique identifier for a QSR seating area.
 * @property {string} SeatingAreaName - Seating area name.
 * @property {string} Notes - Notes.
 * @property {CustomValues[]} CustomValues - Collection of CustomValues.
 * @property {string} ExternalID - External ID.
 * @property {string} PartyMix - Type and count of the party mixes.
 * @property {VisitPartyMixEntry[]} Mixes - Collection of VisitPartyMixEntry.
 */

/**
 * @typedef {Object} SeatedTables
 * @property {string} TableID - A globally unique identifier for a QSR table record.
 * @property {string} TableName - Name of the seated table.
 * @property {string} StartTime - Start time in ISO 8601 format. Time when the visit is seated at the table.
 * @property {string} EndTime - End time in ISO 8601 format. Time when the visit leaves the table.
 * @property {boolean} IsActive - Flag to indicate whether this record is active.
 * @property {boolean} IsCurrent - Flag to indicate whether this record is current.
 */

/**
 * @typedef {Object} CustomValues
 * @property {string} Name - Name of the guest custom record.
 * @property {string} Value - Value of the guest custom record.
 */

/** 
 * @typedef {Object} VisitPollResponse
 * @property {Visit[]} Visits - Collection of Visit objects representing the requested page of matching guest records.
 * @property {boolean} MoreData - 'True' indicates that the number of total results exceeds 30.
 * @property {string} TimestampCutoff - The last update timestamp of the last record in the returned result set in ISO 8601 format.
 */

/**
 * @typedef {Object} TableHiTableHistoryPage
 * @property {TableHistory[]} History - Collection of TableHistory objects representing the requested page of TableHistory records.
 * @property {boolean} HasMoreData - "True" indicates that the number of total results exceeds 100.
 * @property {string} CutOffDate - The last update timestamp of the last record in the returned result set, in ISO 8601 format.
 */

/**
 * @typedef {Object} TeamMemberEventPage
 * @property {TeamMemberEvent[]} Events - Collection of TeamMemberEvent objects representing the requested page of matching team member event records.
 * @property {boolean} MoreData - "True" indicates that the number of total results exceeds 100.
 * @property {string} DownloadCutoff - The last update timestamp of the last record in the returned result set, in ISO 8601 format.
 */

/**
 * @typedef {Object} TableEventPage
 * @property {TableEvent[]} Events - Collection of TableEvent objects representing the requested page of TableEvent records.
 * @property {boolean} MoreData - "True" indicates that the number of total results exceeds 100.
 * @property {string} DownloadCutoff - The last update timestamp of the last record in the returned result set, in ISO 8601 format.
 */

/**
 * @typedef {Object} GetPartnerSites
 * @property {string} PageData - Content of the page.
 * @property {string} SiteUID - Globally unique identifier for a site. This is provided by QSR.
 * @property {string} ExternalSiteID - External ID of the site.
 * @property {boolean} HasMore - Indicates if additional page(s) are available. True or False.
 * @property {string} Token - A token which can be provided as the Token URL parameter to retrieve the next page of sites.
 */
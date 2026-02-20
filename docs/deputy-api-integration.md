# Deputy API Integration Research

## Official API Documentation
- **Developer Portal:** https://developer.deputy.com/
- **API Support Email:** apisupport@deputy.com

## 1. User/Employee Sync (Auto-Create Users)

Deputy provides rich employee data via V2 API:

```
GET https://{install}.{geo}.deputy.com/api/management/v2/employees
```

**Available Fields:** firstName, lastName, displayName, email1/email2, phone1/phone2, position, role (Employee/Supervisor/Admin), primaryLocation, workplaces (multi-location assignments), startDate, terminationDate, externalLinkId (for mapping to StoreScore user ID)

**Pagination:** Cursor-based (`?cursor=...`). V1 Resource API returns max 500 records per request.

**Field Masks:** `?fieldMask=firstName,lastName,displayName,email1,primaryLocation`

## 2. Location/Area Data

**Locations (Company Resource):**
```
POST /api/v1/resource/Company/QUERY
```
Fields: Id, CompanyName, TradingName, CompanyNumber, Code, Active, IsWorkplace, ParentCompany (hierarchy support), Address, Contact

**Areas (OperationalUnit Resource):**
```
POST /api/v1/resource/OperationalUnit/QUERY
```
Fields: Id, OperationalUnitName, Company (parent location), Active, WorkType, ParentOperationalUnit

**Mapping:** Company → StoreScore stores, OperationalUnit → departments, ParentCompany → regions/districts

## 3. Scheduling Data (Roster Resource)

```
GET /api/v1/supervise/roster  (recent shifts: -12h to +36h)
POST /api/v1/resource/Roster/QUERY  (full query)
```

Fields: Id, Employee, OperationalUnit, Date, StartTime/EndTime (Unix), TotalTime, Cost, Mealbreak, Published, Open, ConfirmStatus (Not Required/Required/Confirmed/Declined), MatchedByTimesheet

## 4. Timesheet Data (Actual Hours, Attendance)

```
POST /api/v1/resource/Timesheet/QUERY
```

Fields: Id, Employee, OperationalUnit, Date, StartTime/EndTime (actual clock in/out), TotalTime, Cost, Mealbreak, IsInProgress, IsLeave, TimeApproved, TimeApprover, Discarded, Roster (linked scheduled shift), EmployeeComment

**No-Show Detection:** Compare Roster (scheduled) vs Timesheet (actual). Roster with no matched Timesheet = no-show.

## 5. Webhooks (Real-Time Events)

```
POST /api/v1/resource/Webhook/  (create)
```

**Key Topics for StoreScore:**

| Topic | Use Case |
|-------|----------|
| `Employee.Insert` | Auto-create user in StoreScore |
| `Employee.Update` | Sync user changes |
| `Employee.Delete` | Deactivate StoreScore user |
| `Timesheet.Insert` | Clock-in event |
| `Timesheet.Update` | Clock-out, approval |
| `Roster.Publish` | Schedule published |
| `Company.Insert` | New location created |
| `Company.Update` | Location changed |

**Security:** `X-Deputy-Secret` header with SHA256 HMAC (Enterprise), `X-Deputy-Webhook-Callback`, `X-Deputy-Generation-Time`

**Important:** Events while webhook is disabled are lost (not queued).

## 6. Authentication (OAuth 2.0)

**Register app:** https://once.deputy.com/my/oauth_clients

**Auth flow:**
1. Redirect user to `https://once.deputy.com/my/oauth/login?client_id=...&redirect_uri=...&response_type=code&scope=longlife_refresh_token`
2. Exchange code: `POST https://once.deputy.com/my/oauth/access_token` (code expires in 10 min)
3. Access token lifetime: 24 hours, refresh token: long-lived
4. Include `Authorization: Bearer {token}` on API requests
5. Validate: `GET /api/v1/me`

**Permanent tokens** available for single-tenant/testing.

## 7. Rate Limits

Not publicly documented. Recommend:
- 2-5 requests/second throttling
- Use bulk QUERY endpoints (500 records/request)
- Use webhooks over polling
- Handle HTTP 429 with exponential backoff

## 8. Partner Program

- Marketplace submission via Google Form
- "People Sync" category most relevant
- Integration labeled "3RD PARTY" in marketplace
- At least 6 months deprecation notice for API changes
- Contact: apisupport@deputy.com

## Recommended Integration Architecture

### Phase 1: Location & User Sync
1. OAuth2 connect — StoreScore admin authorizes Deputy
2. Pull Company (locations) → map to StoreScore stores
3. Pull employees → auto-create StoreScore users with roles
4. Register webhooks for Employee.Insert/Update/Delete, Company.Insert/Update

### Phase 2: Staffing Analytics
1. Pull Roster data → scheduled hours per location
2. Pull Timesheet data → actual hours worked per location
3. Correlate staffing hours with walk scores
4. Use Timesheet.Update and Roster.Publish webhooks for real-time data

### Phase 3: Attendance Correlation
1. No-show detection (Roster vs Timesheet gaps)
2. Surface staffing metrics alongside walk scores in analytics
3. Insights like "stores with < X staffing hours/week score Y% lower"

## Key API Endpoints Summary

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Get employees | `/api/management/v2/employees` | GET |
| Get single employee | `/api/management/v2/employees/{id}` | GET |
| Query employees (V1) | `/api/v1/resource/Employee/QUERY` | POST |
| Get locations | `/api/v1/resource/Company/QUERY` | POST |
| Get areas/departments | `/api/v1/resource/OperationalUnit/QUERY` | POST |
| Get timesheets | `/api/v1/resource/Timesheet/QUERY` | POST |
| Get scheduled shifts | `/api/v1/resource/Roster/QUERY` | POST |
| Get recent shifts | `/api/v1/supervise/roster` | GET |
| Validate token | `/api/v1/me` | GET |
| Create webhook | `/api/v1/resource/Webhook/` | POST |

---

*Research completed February 2026*

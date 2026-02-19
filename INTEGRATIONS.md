# StoreScore — Integration & Data Connection Roadmap

> Referenced from [ROADMAP.md](./ROADMAP.md) — this document covers the strategy for connecting StoreScore to Ace Hardware's data ecosystem and external platforms.

---

## Ace Hardware Data Ecosystem

### How the data flows today

```
Customers → Eagle POS (in-store) → Ace Corporate/Acenet → Mango Report
                                          ↓
                                    MANGOAPI (internal)
                                          ↓
                                    Mango Report (analytics)
```

### Key systems

| System | What It Is | API Status |
|--------|-----------|------------|
| **Eagle POS** (Epicor) | Point-of-sale system in every Ace store | Open REST/OData APIs available via Epicor. Third-party integrations exist (Modern Retail, Jitterbit). Every UI function is available as a Service/API. |
| **Mango Report** | Analytics/reporting tool for Ace franchisees. Generates completion scores, sales data, out-of-stock reports. | **Closed ecosystem.** MANGOAPI is internal (Eagle ↔ Mango only). No public third-party API today. Exports Excel workbooks. Future API hinted. |
| **Acenet** | Ace Corporate's internal platform. Central hub connecting Eagle, Mango, OSPREY. | **Corporate-only.** Would require Ace partnership for access. |

---

## Integration Phases

### Phase I: Manual Entry + CSV Import (Launch — No Dependencies)

**Status:** Models built, ready for UI

Day-one solution. Zero external dependencies. Works immediately.

**Data sources:**
- Store managers manually input key metrics (weekly sales, transaction counts, staffing hours)
- Finance team uploads CSV exports from Eagle reports
- Mango Report Excel workbooks exported and uploaded to StoreScore

**What we support:**
- `IntegrationConfig` model — stores connection settings per org (type: manual, csv, api, webhook)
- `StoreDataPoint` model — flexible key/value data storage per store with timestamps
- CSV upload endpoint with column mapping
- Manual data entry forms in the walk UI

**Supported data types:**
| Metric | Source | Entry Method |
|--------|--------|-------------|
| Weekly sales | Eagle CSV export | CSV upload |
| Transaction count | Eagle CSV export | CSV upload |
| Average ticket | Eagle CSV export | CSV upload |
| Staffing hours | Manager input | Manual entry |
| Out-of-stock % | Mango Excel export | CSV upload |
| Completion score | Mango Excel export | CSV upload |
| Customer complaints | Manager input | Manual entry |

---

### Phase II: Eagle API (Epicor REST) — Direct POS Integration

**Status:** Planned (requires franchisee authorization)

**Approach:** Use Epicor's open REST/OData API architecture to pull sales data directly from each store's Eagle instance.

**Options:**
1. **Direct Epicor API** — Each franchisee authorizes StoreScore to access their Eagle instance. Epicor provides OpenAPI/Swagger endpoints for all POS functionality.
2. **Modern Retail Integration API** — Third-party middleware specifically built for Epicor Eagle. Designed for mobile apps and external platform connections.
3. **Jitterbit iPaaS** — Epicor's official integration partner. Connects Eagle to any cloud-based system.

**Data available via Eagle API:**
- Real-time sales data (daily/weekly/monthly)
- Transaction history and counts
- Inventory levels
- Product mix and category performance
- Customer traffic patterns
- Margin data

**Requirements:**
- Epicor developer account / API credentials
- Per-franchisee authorization (each store's Eagle instance)
- Possibly Epicor partnership conversation for bulk access
- Webhook receiver for real-time data pushes

**Architecture:**
```
Eagle POS (per store)
    ↓ REST API / OData
StoreScore Celery Worker
    ↓ Scheduled pull (nightly)
StoreDataPoint records
    ↓
Dashboard + Analytics
    ↓
Walk score ↔ Sales correlation
```

---

### Phase II.5: Deputy Staffing Integration

**Status:** Planned (Deputy API confirmed available)

**What it is:** Deputy is the workforce management platform used by Northwest Ace for scheduling and clock-in/clock-out across all stores. It provides the **staffing hours** piece of the quality–staffing–sales triangle.

**API overview:**
- RESTful JSON API — nearly every UI function is available via API
- Base URL: `https://{install}.{geo}.deputy.com/api/v1/`
- All data queries use `POST /resource/{ObjectName}/QUERY` with JSON filter payloads
- 500-record pagination limit per response
- Webhooks available for real-time events (clock-in/out, shift changes)

**Authentication:**
- **Phase 1 (single franchisee):** Permanent Bearer Token — generated in Deputy admin portal, no OAuth flow needed
- **Phase 2 (multi-franchisee):** OAuth 2.0 authorization code flow with Client ID/Secret

**Key data to pull:**

| Deputy Resource | Data | StoreScore Use |
|----------------|------|----------------|
| **Timesheet** | Clock in/out times, total hours, breaks, cost, location | Daily/weekly staff hours per store |
| **Roster** | Scheduled shifts (employee + area + time) | Planned vs. actual staffing comparison |
| **TimesheetPayReturn** | Pay rules, labor costs, overtime | Cost-per-hour analysis |
| **Employee** | Name, employment data, availability | Headcount per store |
| **OperationalUnit (Area)** | Location/area hierarchy | Maps to StoreScore stores |
| **Leave** | Leave requests, balances | Adjusted staffing levels |
| **SalesData** | Custom sales metrics | Could supplement Eagle POS data |

**Architecture:**
```
Deputy API (per franchise install)
    ↓ POST /resource/Timesheet/QUERY
StoreScore Celery Worker (nightly pull)
    ↓
StoreDataPoint records (metric: "staffing_hours", "labor_cost", etc.)
    ↓
Dashboard + Analytics
    ↓
Quality score ↔ Staffing hours ↔ Sales correlation
```

**Real-time option:** Deputy webhooks fire on `Timesheet.Save` (clock-in/out events), enabling live staffing level monitoring without polling.

**Mapping:** Deputy `OperationalUnit` → StoreScore `Store` (configured via `IntegrationConfig.config` JSON field)

**What this enables:**
- "Store X had 45 staff hours this week, achieved a quality score of 88%, and generated $52K in sales"
- Optimal staffing level analysis per store
- Understaffing alerts correlated with quality drops
- Labor cost per quality point benchmarking

**Requirements:**
- Deputy admin access from Northwest Ace to generate API token
- Map Deputy OperationalUnit IDs to StoreScore store records
- Add `deputy` to `IntegrationConfig.Provider` choices
- Add `deputy_api` to `StoreDataPoint.Source` choices

---

### Phase III: Mango Report Integration

**Status:** Planned (waiting for public API or partnership)

**Current reality:** Mango's MANGOAPI is internal-only (Eagle ↔ Mango). No public third-party API exists today. However, Mango has "laid the groundwork for future integrations."

**Approach options (in order of feasibility):**

1. **Automated Excel import** — Mango generates Excel workbooks with sales, out-of-stock, and completion data. Build a scheduled upload mechanism or email-to-import pipeline.

2. **Partnership conversation** — StoreScore complements Mango (walk quality + AI insights vs. POS analytics). A partnership could unlock data sharing without competing.

3. **Future public API** — If/when Mango opens a public API, integrate directly.

**Data available from Mango:**
- Completion scores
- Out-of-stock metrics
- Sales performance vs. benchmarks
- Vendor program compliance
- Seasonal planning data

---

### Phase IV: Ace Corporate Partnership

**Status:** Future (requires demonstrated value)

**The real unlock.** If StoreScore demonstrates value across multiple franchisees, Ace's innovation team may be interested in a partnership that feeds Acenet data more directly.

**What this could enable:**
- Corporate-wide benchmarking (how does Northwest compare to other franchisees?)
- Standardized walk templates pushed from corporate
- Aggregate quality trends across the Ace network
- Corporate compliance reporting
- Integration with Ace's training and development programs

**Path to get here:**
1. Prove value with Northwest (3-6 months of walk data + AI insights)
2. Expand to 2-3 more franchisees
3. Approach Ace Corporate innovation/technology team with data showing impact on store quality and sales
4. Propose pilot program for corporate integration

---

## Data Model Architecture

### IntegrationConfig
Per-organization integration settings. Supports multiple connection types.

```
IntegrationConfig
├── organization (FK)
├── integration_type: manual | csv | api | webhook
├── name: "Eagle POS - Salem Store"
├── provider: eagle | mango | acenet | custom
├── config (JSON): API keys, endpoints, schedules
├── is_active: bool
├── last_sync_at: datetime
└── timestamps
```

### StoreDataPoint
Flexible time-series data storage. Any metric, any store, any date.

```
StoreDataPoint
├── store (FK)
├── organization (FK, via OrgScopedModel)
├── metric: "weekly_sales" | "transaction_count" | "oos_percentage" | ...
├── value (Decimal)
├── date (Date)
├── source: manual | csv_import | eagle_api | mango_import
├── integration (FK to IntegrationConfig, nullable)
├── metadata (JSON): raw data, import batch ID, etc.
└── timestamps
```

### Correlation queries (future)
```sql
-- Walk score vs. weekly sales for a store
SELECT w.completed_date, w.total_score, d.value as weekly_sales
FROM walks_walk w
JOIN stores_storedatapoint d
  ON w.store_id = d.store_id
  AND d.metric = 'weekly_sales'
  AND d.date = DATE_TRUNC('week', w.completed_date)
WHERE w.store_id = '{store_id}'
ORDER BY w.completed_date;
```

---

## Key Principle

> **Never make the platform dependent on external integrations.** They're a power-up, not a prerequisite. StoreScore delivers value from day one with manual walk scoring and AI summaries. Data integrations amplify that value by enabling score-to-sales correlation, but the core product works without them.

---

## Links

- [Main Roadmap](./ROADMAP.md)
- [Epicor Eagle API Docs](https://www.epicor.com/en-us/retail/eagle/) — OpenAPI/Swagger, REST + OData
- [Modern Retail — Eagle Integration API](https://www.modernretail.com/) — Third-party Eagle middleware
- [Jitterbit — Epicor Integration](https://www.jitterbit.com/solutions/epicor-integration/) — iPaaS for Eagle
- [Mango Report](https://mangoreport.com/) — Ace analytics platform
- [Deputy API Docs](https://developer.deputy.com/docs/getting-started-with-the-deputy-api) — Workforce management API
- [Deputy OAuth 2.0](https://developer.deputy.com/docs/using-oauth-20) — Authentication guide
- [Deputy Webhooks](https://developer.deputy.com/docs/webhook-overview) — Real-time event subscriptions
- [Deputy Timesheet API](https://developer.deputy.com/docs/retrieving-timesheets-from-deputy) — Clock-in/out data

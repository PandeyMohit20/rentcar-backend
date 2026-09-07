# UAT DUMMY FLEET SEED REPORT

## Environment

Database: Local development MySQL; loopback connection verified; credentials omitted.
Backend: http://localhost:5000/api/v1
No production environment accessed.

## Vendor / Branch

Vendor ID: 564ebf45-1cae-4ca1-a29e-d4794733b57c
Vendor: Test Vendor 3936A9796012
Branch ID: d5f9c996-6a74-47d0-b2e3-2a75688486a9
Branch: Branch-3936A9796012
Reused existing vendor: YES
Reused existing branch/location: YES
Reused existing Toyota Camry: YES, dc96154a-7035-481b-b335-8fccb6f4d310; original registration/vendor/branch preserved.

## Cars

Total UAT cars: 15 (14 created, 1 reused and updated).
Available: 15
Maintenance: 0
Inactive: 0

| Brand | Model | Registration | Car ID | Status | Fuel | Transmission | Seats | Active pricing rows / daily INR | Images | Features |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| Maruti Suzuki | Swift | UAT-MH01-0001 | cfde7ac8-b29a-48c7-a949-70ad29e78659 | available | petrol | manual | 5 | 1 / 1800 | 1 | 5 |
| Maruti Suzuki | Baleno | UAT-MH01-0002 | 9f2313e6-f2e1-438c-bf8a-32a6b6503d62 | available | petrol | automatic | 5 | 1 / 2000 | 1 | 5 |
| Hyundai | i20 | UAT-MH01-0003 | 080cbda9-d5fe-4e6d-bf04-a25e2755a9a7 | available | petrol | automatic | 5 | 1 / 2100 | 1 | 5 |
| Hyundai | Creta | UAT-MH01-0004 | 7c002acf-5ad6-4179-86a2-80281deb2f19 | available | diesel | automatic | 5 | 2 / 3200, 3400 | 1 | 5 |
| Hyundai | Venue | UAT-MH01-0005 | 10a38e07-f769-4816-8aba-967185ad206e | available | petrol | automatic | 5 | 1 / 2500 | 1 | 5 |
| Tata | Nexon | UAT-MH01-0006 | ad8e18a1-8e70-4197-b950-46f057a484e1 | available | diesel | automatic | 5 | 1 / 2800 | 1 | 5 |
| Tata | Punch | UAT-MH01-0007 | 8b961fab-6eee-4858-819c-8c4c339f6216 | available | petrol | manual | 5 | 1 / 2300 | 1 | 5 |
| Mahindra | XUV700 | UAT-MH01-0008 | c78a7595-0544-406b-987d-7133dae108d7 | available | diesel | automatic | 7 | 1 / 4200 | 1 | 5 |
| Mahindra | Scorpio N | UAT-MH01-0009 | 93913ed5-db88-4e4a-b943-95fb8911101a | available | diesel | automatic | 7 | 1 / 4000 | 1 | 5 |
| Kia | Seltos | UAT-MH01-0010 | cab40dbd-71be-4ea1-89f2-9df0e719d63b | available | diesel | automatic | 5 | 1 / 3300 | 1 | 5 |
| Honda | City | UAT-MH01-0011 | e4a00579-9bdc-4931-b099-4e75e3940e5c | available | petrol | automatic | 5 | 1 / 3000 | 1 | 5 |
| Toyota | Innova Crysta | UAT-MH01-0012 | 563fb074-8272-4dd1-a378-51141f9e899f | available | diesel | manual | 7 | 1 / 4500 | 1 | 5 |
| Toyota | Fortuner | UAT-MH01-0013 | f98fa5b7-daf8-4f09-b46d-a15d14e64ad8 | available | diesel | automatic | 7 | 1 / 6500 | 1 | 5 |
| Toyota | Camry | REG-3936A9796012 | dc96154a-7035-481b-b335-8fccb6f4d310 | available | hybrid | automatic | 5 | 1 / 5500 | 4 | 6 |
| MG | Hector | UAT-MH01-0015 | 68dec66f-f98a-42e7-880a-2166065c76f3 | available | petrol | automatic | 5 | 1 / 3800 | 1 | 5 |

## Pricing

Cars with active pricing: 15 / 15
Active pricing rows: 16 (15 new; Camry's existing row updated).
Pricing interval: September 1, 2026, 00:00 IST onward; open-ended effectiveTo=null except Creta's first period.
Currencies: INR
Cars missing pricing: 0
Multiple pricing periods car: Hyundai Creta only. September 1 through September 30, 23:59:59.999 IST = INR 3,200/day; October 1 onward = INR 3,400/day. Both period-selection tests PASS; no overlaps.
Hourly, daily, weekly, monthly, extra-hour, extra-km and deposit fields use the requested fixture rates and backend field names. Camry is INR 550/hour, 5,500/day, deposit 15,000. All authoritative rates and IDs are in uat-fleet-result.json.

## Images

Cars with images: 15
Uploaded PNG files: 18
Multi-image car: Toyota Camry
Image count: 4 (Front, Side, Rear, Interior)
Primary image: YES, Front
Exactly one primary: YES (each car); Camry primary switching and restoration PASS.
Actual valid labeled PNG placeholders: YES; all HTTP 200, image/png and PNG signatures verified.
Browser rendering: FAIL. Responses carry Cross-Origin-Resource-Policy: same-origin; Chromium blocks Admin cross-origin image loads with net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. Existing helmet() configuration in src/app.js:34 precedes the media route at src/app.js:48. No application/header changes made.

## Features

Feature records created: 75
Existing records preserved: 1 (Camry's x feature)
Feature mappings / car-owned records: 76
Every car has five requested features; Camry has six including its preserved existing feature. This model stores features directly per car, without a shared feature mapping table.

## Availability

Normally available cars: 15
Blocked test car: Hyundai Venue; September 20, 2026, 10:00 IST to September 22, 2026, 10:00 IST; block check PASS.
Final verified customer interval: September 8, 2026, 10:00 IST to September 9, 2026, 10:00 IST.
An existing Camry payment-pending hold initially excluded it, so September 23?24 was also verified. The hold expired naturally before the final rerun; all 15 passed the original interval. No existing bookings or holds were modified.

## Customer Discovery

Catalog UAT cars returned: 15
Availability search UAT cars: 15
Brand / fuelType / transmission / seatingCapacity / branch filters: PASS
Customer browser discovery: PASS

## Quote Verification

Swift: PASS
Creta: PASS
Camry: PASS
Fortuner: PASS
All 15 cars: PASS
Quote token, quote ID, duration, authoritative pricing/deposit, INR currency, expiry and available=true: verified.
No active pricing record error remaining: NO
Customer Camry trusted quote display: PASS; displayed subtotal, deposit and payable amount match the actual backend response. Token absent from URL and localStorage. No quote tokens logged or saved.
Quotes expire; request a fresh quote for a later booking attempt.

## Admin Verification

Fleet list: PASS (API and browser)
Car detail: PASS (API and browser)
Pricing: PASS (API and browser)
Images: API/records/primary PASS; browser image rendering FAIL
Features: PASS (API and browser)
Availability: PASS (API and browser)

## Idempotency

PASS: final rerun created 0 cars, prices, features, images or availability rows; updated 0 car/pricing records. All car/pricing/feature/image/availability IDs matched the pre-rerun snapshot. Existing 15 cars, 16 pricing rows, 75 requested features and 18 images were reused. Camry primary switching was tested and restored.

## Files Added/Changed

Only fixture tooling, reports, fixture images and uploaded fixture media were added in this task. Exact list:

- scripts/seed-uat-fleet.js
- scripts/uat-fleet-data.js
- scripts/generate-uat-fleet-images.ps1
- scripts/UAT-FLEET.md
- scripts/uat-fleet-result.json
- scripts/uat-fleet-ui-result.json
- scripts/UAT-FLEET-SEED-REPORT.md
- scripts/fixtures/uat-fleet/honda-city-front.png
- scripts/fixtures/uat-fleet/hyundai-creta-front.png
- scripts/fixtures/uat-fleet/hyundai-i20-front.png
- scripts/fixtures/uat-fleet/hyundai-venue-front.png
- scripts/fixtures/uat-fleet/kia-seltos-front.png
- scripts/fixtures/uat-fleet/mahindra-scorpio-n-front.png
- scripts/fixtures/uat-fleet/mahindra-xuv700-front.png
- scripts/fixtures/uat-fleet/maruti-suzuki-baleno-front.png
- scripts/fixtures/uat-fleet/maruti-suzuki-swift-front.png
- scripts/fixtures/uat-fleet/mg-hector-front.png
- scripts/fixtures/uat-fleet/tata-nexon-front.png
- scripts/fixtures/uat-fleet/tata-punch-front.png
- scripts/fixtures/uat-fleet/toyota-camry-front.png
- scripts/fixtures/uat-fleet/toyota-camry-interior.png
- scripts/fixtures/uat-fleet/toyota-camry-rear.png
- scripts/fixtures/uat-fleet/toyota-camry-side.png
- scripts/fixtures/uat-fleet/toyota-fortuner-front.png
- scripts/fixtures/uat-fleet/toyota-innova-crysta-front.png
- uploads/cars/1788802722011-785201d53c0718.png
- uploads/cars/1788802722352-7e94bd36c0ec88.png
- uploads/cars/1788802722665-1fa5ba32c60b58.png
- uploads/cars/1788802722991-948655eb6ec4e.png
- uploads/cars/1788802723319-a65b9c5af06c68.png
- uploads/cars/1788802723669-73df0a8205b4e8.png
- uploads/cars/1788802724017-90bd708a731918.png
- uploads/cars/1788802724366-f2999423f73f78.png
- uploads/cars/1788802724643-93fdd5e3b200c8.png
- uploads/cars/1788802724936-a96ac1901d6188.png
- uploads/cars/1788802725253-b5b7e51e41d818.png
- uploads/cars/1788802725571-fa3879cdcaa6.png
- uploads/cars/1788802725892-9b0ec1a902f5.png
- uploads/cars/1788802726245-ff2acf3c388fc8.png
- uploads/cars/1788802726292-6514f60261957.png
- uploads/cars/1788802726353-4d3029ae1cbb28.png
- uploads/cars/1788802726404-58abf2e11e7298.png
- uploads/cars/1788802726860-04cdae22acff68.png
- test-results/uat-fleet-admin-images.png
- test-results/uat-fleet-customer-quote.png

Existing src/utils/jwt.js, tests/auth-utils.test.js, scripts/recover-local-uat-admin.js, and pre-existing uploads were left unchanged. Admin/frontend repositories were inspected only.

## DB Safety

Schema changed: NO
Migration added: NO
DB reset: NO
Existing non-UAT data deleted: NO
Production business logic changed: NO
Booking/payment/KYC logic changed: NO
Bookings/payments started: NO
Failed attempts removed only their own confirmed uploads through the existing image deletion API; successful fixture rows were retained for safe resumption.

## Validation

Prisma: PASS (npx prisma validate)
Lint: FAIL (npm run lint): four pre-existing quote-style errors and four warnings in scripts/recover-local-uat-admin.js; no changes made to that earlier utility.
New seed JavaScript lint: PASS
Production-environment refusal: PASS
Idempotent rerun: PASS
No reusable production modules changed; payment race suites were not run.

## Final Decision

UAT FLEET READY: NO for full browser/image UAT; fleet/pricing/availability/quote data are ready.
SAFE TO CONTINUE CUSTOMER BOOKING UAT: NO pending the separately scoped media-serving blocker.
Stopped after fleet and quote verification; no bookings or payments initiated.

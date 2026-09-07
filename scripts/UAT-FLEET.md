# Local UAT fleet tooling

Run from `rentcar-backend` with the existing backend running at `http://localhost:5000`:

```powershell
node scripts/seed-uat-fleet.js
```

The command refuses non-development environments, non-loopback databases, mock databases, and simultaneous executions. It uses the existing Windows DPAPI credential at `$env:LOCALAPPDATA/RentCarUAT/admin-credential.xml` to log in as `admin@rentcar.local`. If the credential was changed or removed, refresh that protected credential locally; the fleet script does not reset passwords. No passwords, access tokens, refresh tokens, or signed quotes are logged or included in reports. The verification login is logged out when the run finishes.

The script uses Prisma only for read-only identity/environment checks. All fleet mutations use authenticated, validated Admin API endpoints. No business logic, schema, or migrations are changed. It requires the existing UAT vendor, branch, and Camry identities and stops if they are missing or invalid.

## Fixtures

- Reuses Camry `dc96154a-7035-481b-b335-8fccb6f4d310`, retaining registration, vendor, and branch.
- Creates 14 other cars using deterministic `UAT-MH01-xxxx` registrations. Index 0014 is reserved for the reused Camry.
- Uses the rates and metadata in `uat-fleet-data.js`.
- Every car is available and has active INR pricing starting September 1, 2026, midnight IST, with no end date.
- Creta alone has two periods: September 1–30 at INR 3,200/day and October 1 onward at INR 3,400/day. The September end is 23:59:59.999 IST, avoiding overlap with October.
- Adds five supported, car-owned features per car; existing unrelated feature rows are preserved.
- Adds one clearly labeled PNG placeholder per car and four for Camry. Placeholders are illustrations for tests, not vehicle photographs.
- Adds a Venue block for September 20, 10:00 IST through September 22, 10:00 IST.
- Checks catalogue filters, availability, all 15 quotes, both Creta periods, each Admin subresource, PNG signatures, and exactly one primary image per car.

## Re-running and recovery

Registrations identify cars, effective start dates identify pricing periods, feature names identify per-car features, image alt text identifies uploads, and a unique reason identifies the Venue block. Existing matches are reused. Unexpected identities or additional pricing rows stop the run for review. The Camry's existing single pricing row is updated to the specified fixture rates and interval.

Car status is checked separately from metadata. The current backend treats a PATCH containing `status` as a status-only operation, so this script omits status from metadata updates and verifies the returned metadata.

On failure, confirmed images uploaded by that attempt are deleted through the normal image API. Existing images are never removed. Successful car, pricing, feature, and availability writes remain so a rerun can resume. A network failure whose upload response was lost may require manual review for an orphan file; the script never deletes unidentified files. The local source PNGs remain reusable.

The default trip is September 8–9, 2026, 10:00 IST. If it is in the past, verification selects a future trip. Existing bookings are never changed: if a hold conflicts, the script requires at least ten available cars on the requested trip and searches for an additional common quote interval. It reports both intervals.

## Verification artifacts and known blockers

- `uat-fleet-result.json`: safe API data, IDs, rates, quote breakdowns, counts, and interval; no quote tokens.
- `uat-fleet-ui-result.json`: browser verification results.
- `UAT-FLEET-SEED-REPORT.md`: full verification report and exact added-file inventory.
- `../test-results/uat-fleet-admin-images.png` and `../test-results/uat-fleet-customer-quote.png`: browser evidence (ignored by Git).

The final rerun preserved every car, pricing, feature, image, and availability ID and created/updated no data records. Primary switching is deliberately exercised on Camry and restored to Front.

Browser verification found an existing media-serving blocker: `src/app.js` installs default `helmet()` before `/uploads/cars`. Uploaded PNGs respond with `Cross-Origin-Resource-Policy: same-origin`; the Admin browser at port 5174 blocks images from port 5000 with `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`. The fixture images themselves pass binary checks and HTTP retrieval. No security headers or frontend code were changed. Full fleet UI readiness remains blocked pending a separately scoped media-serving fix.

Prisma validation passes. New seed JavaScript passes lint. Full `npm run lint` fails on four pre-existing quote-style errors in `scripts/recover-local-uat-admin.js`; that earlier recovery file was left unchanged in this task.

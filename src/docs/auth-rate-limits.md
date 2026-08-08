# Auth Rate Limiting — Recommended Production Limits

Phase 20 does **not** ship a distributed rate limiter (out of scope per the
Phase 19 infrastructure). These are the **recommended** production limits to
implement in a later phase, typically via a Redis-backed middleware or API
gateway.

Rate limits should be keyed by IP + identifier (email/phone) where applicable.

| Endpoint                   | Window       | Limit (per identifier) | Notes                                        |
| -------------------------- | ------------ | ---------------------- | -------------------------------------------- |
| `POST /auth/login`         | 15 minutes   | 5 attempts             | Prevent brute force / credential stuffing    |
| `POST /auth/send-otp`      | 15 minutes   | 3 requests             | Prevent OTP abuse / SMS/email flooding       |
| `POST /auth/verify-otp`    | 15 minutes   | 5 attempts             | Combined with per-OTP `MAX_ATTEMPTS`         |
| `POST /auth/forgot-password`| 1 hour      | 3 requests             | Prevent enumeration + email flooding         |
| `POST /auth/reset-password` | 1 hour      | 3 requests             | Prevent token brute force                    |
| `POST /auth/refresh`       | 15 minutes   | 10 requests            | Prevent token abuse                          |
| `POST /auth/register`      | 1 hour       | 5 requests per IP      | Prevent account creation abuse               |

## Notes

- Do **not** expose these thresholds to clients in API responses.
- On exceeding a limit, return `429 Too Many Requests` with `RATE_LIMITED`.
- Backoff should be applied per account to avoid distributed brute-force.
- Consider a global IP-based cap (e.g. 100 auth requests/hour) as a safety net.
- Failed attempts should be counted independently of successful ones.

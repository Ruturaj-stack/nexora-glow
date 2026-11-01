# Nexora — Recovery, Auth Repair & Functionality Completion (Nov 1, 2026)

Source: user upload "NEXORA COMPLETE PROJECT RECOVERY" brief.

## P1 — Authentication
- [ ] Audit current auth config (env, client init, routes, middleware)
- [ ] Enable email/password auth + verify register/login flows
- [ ] Enable Google + Lovable social providers (configure_social_auth)
- [ ] Verify logout, session restore, protected routes

## P2 — Navigation & routes
- [ ] Verify every sidebar item routes to a real page
- [ ] Verify direct URL access + refresh on each route

## P3 — Top bar, Home, Dashboard
- [ ] Wire/verify every top-bar control
- [ ] Dashboard widgets use real data or truthful states

## P4 — Settings persistence
- [ ] Each settings section loads/saves real values (user_settings)

## P5 — Chat, memory, voice, devices, automation, plugins
- [ ] Verify chat streaming + persistence end-to-end
- [ ] Verify memory CRUD
- [ ] Truthful status for voice/computer/devices/plugins

## P6 — Security, tests, report
- [ ] Run build/typecheck/tests
- [ ] Playwright journey tests (register→login→logout, navigation)
- [ ] Final honest readiness report
- [ ] Security dependency floor update (mandatory)

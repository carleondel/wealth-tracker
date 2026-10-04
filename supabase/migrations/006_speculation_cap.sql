-- Max share (percent of invested capital, cash excluded) that speculative
-- positions (role 'tactica') may reach before the app suggests taking profits.
-- null = use the app default (POLICY.speculationCapPct).
alter table user_settings
  add column if not exists speculation_cap_pct numeric;

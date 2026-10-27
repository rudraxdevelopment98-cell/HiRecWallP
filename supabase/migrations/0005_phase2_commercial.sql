-- =============================================================================
-- HirecWallp — Phase 2 commercial-licence SKU
--
-- Records the licence chosen per purchased item so the verified webhook grants
-- the correct entitlement. Commercial price = personal price ×
-- regions.commercial_multiplier (added in 0004). Default stays 'personal'.
-- =============================================================================

alter table order_items
  add column licence licence_type not null default 'personal';

-- Seed only stable role definitions. No purchasable product is seeded until
-- the actual INR price and product configuration have been approved.
insert into public.roles (code, description) values
 ('student','Default learner role'),
 ('content_editor','Can prepare and maintain educational content'),
 ('admin','Platform administrator'),
 ('owner_admin','Highest-level platform owner')
on conflict (code) do nothing;

CREATE OR REPLACE VIEW public.vw_customers_by_street
WITH (security_invoker = on)
AS
-- Normalized addresses (customer_addresses → addresses)
SELECT
  c.id AS customer_id,
  a.id AS address_id,
  ca.is_default,
  c.name AS customer_name,
  (SELECT phone_number FROM customer_phones WHERE customer_id = c.id AND is_primary = true LIMIT 1) AS phone_primary,
  a.street_name,
  normalize_street_name(a.street_name) AS street_name_normalized,
  a.house_number,
  n.name AS neighborhood_name,
  a.complement,
  a.reference_point
FROM customers c
JOIN customer_addresses ca ON c.id = ca.customer_id
JOIN addresses a ON ca.address_id = a.id
LEFT JOIN neighborhoods n ON a.neighborhood_id = n.id
WHERE c.is_active = true

UNION ALL

-- Denormalized addresses stored directly on customers
SELECT
  c.id AS customer_id,
  NULL::uuid AS address_id,
  true AS is_default,
  c.name AS customer_name,
  c.phone AS phone_primary,
  c.street AS street_name,
  normalize_street_name(c.street) AS street_name_normalized,
  c.number AS house_number,
  n.name AS neighborhood_name,
  c.complement,
  c.reference AS reference_point
FROM customers c
LEFT JOIN neighborhoods n ON c.neighborhood_id = n.id
WHERE c.is_active = true
  AND c.street IS NOT NULL
  AND c.street <> ''
  AND NOT EXISTS (SELECT 1 FROM customer_addresses ca WHERE ca.customer_id = c.id);
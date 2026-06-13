-- Custom SQL migration file, put your code below! --
-- B5: o dono passa a ocupar o slot comprador/vendedor (não mais role='owner').
-- Migra donos existentes (cujo owner_role é buyer/seller) de role='owner'
-- para o seu papel real. Cast obrigatório via text: participant_role e
-- owner_role são enums separados, atribuição direta falha com type error.
-- Donos legados com owner_role='neutral' permanecem role='owner'
-- (participant_role não tem 'neutral') — dado de dev aceitável.
UPDATE "participant" p
SET "role" = c."owner_role"::text::participant_role
FROM "contract" c
WHERE p."contract_id" = c."id"
  AND p."linked_user_id" = c."owner_id"
  AND p."role" = 'owner'
  AND c."owner_role" IN ('buyer', 'seller');

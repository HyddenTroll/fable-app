-- ============================================================
-- FABLE - Migration 0003 : dette technique - crédits
-- Le solde des crédits doit être la SOMME des transactions
-- (vue credit_balances), jamais un compteur mutable.
-- La colonne historique est renommée pour interdire son usage.
-- ============================================================

alter table public.profiles
  rename column credits_balance to credits_legacy_do_not_use;
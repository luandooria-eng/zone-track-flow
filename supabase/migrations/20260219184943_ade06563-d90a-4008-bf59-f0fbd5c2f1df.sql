-- Allow anon to insert vouchers (portal redemption)
-- (guarded: loyalty_vouchers/loyalty_ledger/loyalty_coupons are created
-- outside tracked migrations on some environments; skip cleanly where
-- they don't exist yet)
DO $$ BEGIN
  IF to_regclass('public.loyalty_vouchers') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Allow anon insert vouchers" ON public.loyalty_vouchers
      FOR INSERT TO anon
      WITH CHECK (true)';
  END IF;
END $$;

-- Allow anon to insert ledger entries (portal redemption debit)
DO $$ BEGIN
  IF to_regclass('public.loyalty_ledger') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Allow anon insert ledger" ON public.loyalty_ledger
      FOR INSERT TO anon
      WITH CHECK (true)';
  END IF;
END $$;

-- Allow anon to read/update customers for balance (portal)
CREATE POLICY "Allow anon select customers" ON public.customers
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update customer balance" ON public.customers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to read/update coupons stock
DO $$ BEGIN
  IF to_regclass('public.loyalty_coupons') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Allow anon select coupons" ON public.loyalty_coupons
      FOR SELECT TO anon
      USING (true)';
    EXECUTE 'CREATE POLICY "Allow anon update coupon stock" ON public.loyalty_coupons
      FOR UPDATE TO anon
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;
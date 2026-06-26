-- Allow anon to insert vouchers (portal redemption)
CREATE POLICY "Allow anon insert vouchers" ON public.loyalty_vouchers
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to insert ledger entries (portal redemption debit)
CREATE POLICY "Allow anon insert ledger" ON public.loyalty_ledger
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to read/update customers for balance (portal)
CREATE POLICY "Allow anon select customers" ON public.customers
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update customer balance" ON public.customers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to read/update coupons stock
CREATE POLICY "Allow anon select coupons" ON public.loyalty_coupons
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update coupon stock" ON public.loyalty_coupons
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);